use crate::types::*;
use crate::simulator::SimState;
use crate::storage::{FrameStore, StatsTracker};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::fs::File;
use std::sync::Arc;
use tauri::{Emitter, State};

pub struct PeriodicSendState {
    pub keys: HashMap<String, bool>,
}

impl Default for PeriodicSendState {
    fn default() -> Self {
        Self {
            keys: HashMap::new(),
        }
    }
}

pub struct AppStateInner {
    pub sim_running: Mutex<bool>,
    pub sim_state: Mutex<SimState>,
    pub frame_store: Mutex<FrameStore>,
    pub stats_tracker: Mutex<StatsTracker>,
    pub dbc: Mutex<Option<DbcDatabase>>,
    pub recording_file: Mutex<Option<File>>,
    pub periodic_sends: Mutex<PeriodicSendState>,
}

#[derive(Clone)]
pub struct AppState {
    pub inner: Arc<AppStateInner>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(AppStateInner {
                sim_running: Mutex::new(false),
                sim_state: Mutex::new(SimState::new()),
                frame_store: Mutex::new(FrameStore::new()),
                stats_tracker: Mutex::new(StatsTracker::new()),
                dbc: Mutex::new(None),
                recording_file: Mutex::new(None),
                periodic_sends: Mutex::new(PeriodicSendState::default()),
            }),
        }
    }
}

pub fn now_micros() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_micros() as u64)
        .unwrap_or(0)
}

fn process_incoming_frame(state: &AppState, app_handle: &tauri::AppHandle, frame: CanFrame) {
    let frame_clone = frame.clone();

    state.inner.frame_store.lock().add_frame(frame_clone.clone());
    state.inner.stats_tracker.lock().record_frame(frame_clone.id, frame_clone.timestamp);

    if let Some(file) = state.inner.recording_file.lock().as_mut() {
        let _ = crate::recording::write_frame(file, &frame_clone, 1);
    }

    let _ = app_handle.emit("can-frame", frame_clone);
}

#[tauri::command]
pub fn start_simulator(state: State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    *state.inner.sim_running.lock() = true;
    state.inner.sim_state.lock().start_time = std::time::Instant::now();

    let state_clone = state.inner().clone();
    let app_handle_clone = app_handle.clone();

    std::thread::spawn(move || {
        let mut next_ticks: Vec<(u64, usize)> = Vec::new();

        loop {
            if !*state_clone.inner.sim_running.lock() {
                break;
            }

            let now = now_micros();
            let configs_len = state_clone.inner.sim_state.lock().configs.len();

            for idx in 0..configs_len {
                let (needs_tick, period_us) = {
                    let sim_state = state_clone.inner.sim_state.lock();
                    let config = match sim_state.configs.get(idx) {
                        Some(c) => c,
                        None => continue,
                    };
                    if !config.enabled {
                        continue;
                    }
                    let period_us = config.period_ms * 1000;
                    if period_us == 0 {
                        continue;
                    }

                    let needs_tick = match next_ticks.iter().find(|(_, i)| *i == idx) {
                        Some((tick, _)) => now >= *tick,
                        None => true,
                    };
                    (needs_tick, period_us)
                };

                if needs_tick {
                    let frame_opt = {
                        let mut sim_state = state_clone.inner.sim_state.lock();
                        let config = match sim_state.configs.get(idx) {
                            Some(c) => c.clone(),
                            None => continue,
                        };
                        sim_state.generate_frame(&config, now)
                    };

                    if let Some(frame) = frame_opt {
                        process_incoming_frame(&state_clone, &app_handle_clone, frame);
                    }
                    next_ticks.retain(|(_, i)| *i != idx);
                    next_ticks.push((now + period_us, idx));
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(1));
        }
    });

    let state_clone2 = state.inner().clone();
    let app_handle_clone2 = app_handle.clone();
    std::thread::spawn(move || {
        loop {
            if !*state_clone2.inner.sim_running.lock() {
                let stats = state_clone2.inner.stats_tracker.lock().get_last();
                let _ = app_handle_clone2.emit("bus-stats", stats);
                break;
            }
            let now = now_micros();
            let stats = state_clone2.inner.stats_tracker.lock().compute(now);
            let _ = app_handle_clone2.emit("bus-stats", stats);
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_simulator(state: State<'_, AppState>) -> Result<(), String> {
    *state.inner.sim_running.lock() = false;
    Ok(())
}

#[tauri::command]
pub fn is_simulator_running(state: State<'_, AppState>) -> bool {
    *state.inner.sim_running.lock()
}

#[tauri::command]
pub fn set_simulator_configs(
    state: State<'_, AppState>,
    configs: Vec<SimMessageConfig>,
) -> Result<(), String> {
    state.inner.sim_state.lock().configs = configs;
    Ok(())
}

#[tauri::command]
pub fn get_simulator_configs(state: State<'_, AppState>) -> Vec<SimMessageConfig> {
    state.inner.sim_state.lock().configs.clone()
}

#[tauri::command]
pub fn set_error_rate(state: State<'_, AppState>, rate: f64) -> Result<(), String> {
    state.inner.sim_state.lock().error_rate = rate.max(0.0).min(1.0);
    Ok(())
}

#[tauri::command]
pub fn get_frame_display_map(state: State<'_, AppState>) -> HashMap<String, CanFrameDisplay> {
    state.inner.frame_store.lock().get_map()
}

#[tauri::command]
pub fn get_frames(state: State<'_, AppState>) -> Vec<CanFrameDisplay> {
    state.inner.frame_store.lock().get_all().into_iter().cloned().collect()
}

#[tauri::command]
pub fn clear_frames(state: State<'_, AppState>) -> Result<(), String> {
    state.inner.frame_store.lock().clear();
    state.inner.stats_tracker.lock().reset();
    Ok(())
}

#[tauri::command]
pub fn send_frame(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    id: u32,
    is_extended: bool,
    data: Vec<u8>,
) -> Result<(), String> {
    let timestamp = now_micros();
    let dlc = data.len().min(8) as u8;
    let frame = CanFrame {
        timestamp,
        id,
        is_extended,
        is_tx: true,
        dlc,
        data,
    };
    process_incoming_frame(state.inner(), &app_handle, frame);
    Ok(())
}

#[tauri::command]
pub fn start_periodic_send(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    id: u32,
    is_extended: bool,
    data: Vec<u8>,
    period_ms: u64,
) -> Result<String, String> {
    let key = format!("periodic_{}_{}_{}", id, is_extended, now_micros());
    let key_clone = key.clone();
    state.inner.periodic_sends.lock().keys.insert(key.clone(), true);

    let state_clone = state.inner().clone();
    let app_handle_clone = app_handle.clone();

    std::thread::spawn(move || {
        loop {
            {
                let keys = state_clone.inner.periodic_sends.lock();
                if !keys.keys.get(&key_clone).copied().unwrap_or(false) {
                    break;
                }
            }

            let timestamp = now_micros();
            let dlc = data.len().min(8) as u8;
            let frame = CanFrame {
                timestamp,
                id,
                is_extended,
                is_tx: true,
                dlc,
                data: data.clone(),
            };
            process_incoming_frame(&state_clone, &app_handle_clone, frame);

            std::thread::sleep(std::time::Duration::from_millis(period_ms));
        }
    });

    Ok(key)
}

#[tauri::command]
pub fn stop_periodic_send(state: State<'_, AppState>, key: String) -> Result<(), String> {
    state.inner.periodic_sends.lock().keys.remove(&key);
    Ok(())
}

#[tauri::command]
pub fn parse_dbc(content: String) -> Result<DbcDatabase, String> {
    Ok(crate::dbc::parse_dbc(&content))
}

#[tauri::command]
pub fn decode_signals(
    state: State<'_, AppState>,
    message_id: u32,
    data: Vec<u8>,
) -> Result<Vec<DecodedSignal>, String> {
    let dbc_guard = state.inner.dbc.lock();
    let dbc = dbc_guard.as_ref().ok_or("DBC not loaded")?;
    let msg = dbc
        .messages
        .iter()
        .find(|m| m.id == message_id)
        .ok_or("Message not found in DBC")?;
    Ok(crate::codec::decode_signals(msg, &data))
}

#[tauri::command]
pub fn encode_signal_values(
    state: State<'_, AppState>,
    message_id: u32,
    signal_values: HashMap<String, f64>,
) -> Result<Vec<u8>, String> {
    let dbc_guard = state.inner.dbc.lock();
    let dbc = dbc_guard.as_ref().ok_or("DBC not loaded")?;
    let msg = dbc
        .messages
        .iter()
        .find(|m| m.id == message_id)
        .ok_or("Message not found in DBC")?;
    let base = vec![0u8; 8];
    Ok(crate::codec::encode_signal_values(msg, &signal_values, &base))
}

#[tauri::command]
pub fn set_dbc(state: State<'_, AppState>, dbc: DbcDatabase) -> Result<(), String> {
    *state.inner.dbc.lock() = Some(dbc);
    Ok(())
}

#[tauri::command]
pub fn get_stats(state: State<'_, AppState>) -> BusStats {
    state.inner.stats_tracker.lock().get_last()
}

#[tauri::command]
pub fn reset_stats(state: State<'_, AppState>) -> Result<(), String> {
    state.inner.stats_tracker.lock().reset();
    Ok(())
}

#[tauri::command]
pub fn start_recording(state: State<'_, AppState>, file_path: String) -> Result<(), String> {
    let file = crate::recording::start_recording(&file_path).map_err(|e| e.to_string())?;
    *state.inner.recording_file.lock() = Some(file);
    Ok(())
}

#[tauri::command]
pub fn stop_recording(state: State<'_, AppState>) -> Result<(), String> {
    *state.inner.recording_file.lock() = None;
    Ok(())
}

#[tauri::command]
pub fn is_recording(state: State<'_, AppState>) -> bool {
    state.inner.recording_file.lock().is_some()
}

#[tauri::command]
pub fn load_recording(file_path: String) -> Result<Vec<RecordedFrame>, String> {
    crate::recording::parse_asc_file(&file_path).map_err(|e| e.to_string())
}
