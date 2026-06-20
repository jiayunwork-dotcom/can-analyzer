pub mod types;
pub mod codec;
pub mod dbc;
pub mod simulator;
pub mod storage;
pub mod recording;
pub mod comparator;
pub mod commands;

pub use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::start_simulator,
            commands::stop_simulator,
            commands::is_simulator_running,
            commands::set_simulator_configs,
            commands::get_simulator_configs,
            commands::set_error_rate,
            commands::get_frame_display_map,
            commands::get_frames,
            commands::clear_frames,
            commands::send_frame,
            commands::start_periodic_send,
            commands::stop_periodic_send,
            commands::parse_dbc,
            commands::decode_signals,
            commands::encode_signal_values,
            commands::set_dbc,
            commands::get_stats,
            commands::reset_stats,
            commands::start_recording,
            commands::stop_recording,
            commands::is_recording,
            commands::load_recording,
            commands::compare_recordings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
