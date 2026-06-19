use crate::types::{CanFrame, CanFrameDisplay, BusStats};
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct FrameStore {
    frames: HashMap<(u32, bool), CanFrameDisplay>,
    order: Vec<(u32, bool)>,
}

impl FrameStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_frame(&mut self, frame: CanFrame) {
        let key = (frame.id, frame.is_extended);
        match self.frames.get_mut(&key) {
            Some(existing) => {
                let period = if existing.last_timestamp > 0 {
                    frame.timestamp.saturating_sub(existing.last_timestamp)
                } else {
                    0
                };
                existing.timestamp = frame.timestamp;
                existing.last_timestamp = frame.timestamp;
                existing.is_tx = frame.is_tx;
                existing.dlc = frame.dlc;
                existing.data = frame.data;
                existing.count = existing.count.saturating_add(1);
                existing.period = period;
            }
            None => {
                let display = CanFrameDisplay {
                    timestamp: frame.timestamp,
                    id: frame.id,
                    is_extended: frame.is_extended,
                    is_tx: frame.is_tx,
                    dlc: frame.dlc,
                    data: frame.data,
                    count: 1,
                    period: 0,
                    last_timestamp: frame.timestamp,
                };
                self.frames.insert(key, display);
                self.order.push(key);
            }
        }
    }

    pub fn get_all(&self) -> Vec<&CanFrameDisplay> {
        self.order.iter().filter_map(|k| self.frames.get(k)).collect()
    }

    pub fn get_map(&self) -> HashMap<String, CanFrameDisplay> {
        self.frames
            .iter()
            .map(|((id, ext), v)| {
                let key = format!("{}_{}", id, if *ext { "ext" } else { "std" });
                (key, v.clone())
            })
            .collect()
    }

    pub fn clear(&mut self) {
        self.frames.clear();
        self.order.clear();
    }
}

#[derive(Debug, Default)]
pub struct StatsTracker {
    frame_count: u64,
    error_count: u64,
    id_counts: HashMap<u32, u64>,
    window_start: u64,
    last_stats: BusStats,
}

impl StatsTracker {
    pub fn new() -> Self {
        Self {
            frame_count: 0,
            error_count: 0,
            id_counts: HashMap::new(),
            window_start: 0,
            last_stats: BusStats {
                load_rate: 0.0,
                fps: 0.0,
                error_count: 0,
                id_frequencies: HashMap::new(),
            },
        }
    }

    pub fn record_frame(&mut self, id: u32, timestamp: u64) {
        if self.window_start == 0 {
            self.window_start = timestamp;
        }
        self.frame_count += 1;
        *self.id_counts.entry(id).or_insert(0) += 1;
    }

    pub fn record_error(&mut self) {
        self.error_count += 1;
    }

    pub fn compute(&mut self, timestamp: u64) -> BusStats {
        let window_us = timestamp.saturating_sub(self.window_start);
        let window_sec = if window_us > 0 {
            window_us as f64 / 1_000_000.0
        } else {
            1.0
        };

        let fps = self.frame_count as f64 / window_sec;
        let bits_per_frame = 1 + 11 + 1 + 1 + 4 + 64 + 15 + 1 + 1 + 7;
        let max_fps = 500_000.0 / bits_per_frame as f64;
        let load_rate = (fps / max_fps).min(1.0);

        let id_frequencies: HashMap<u32, f64> = self
            .id_counts
            .iter()
            .map(|(id, count)| (*id, *count as f64 / window_sec))
            .collect();

        let stats = BusStats {
            load_rate,
            fps,
            error_count: self.error_count,
            id_frequencies,
        };

        self.last_stats = stats.clone();
        stats
    }

    pub fn get_last(&self) -> BusStats {
        self.last_stats.clone()
    }

    pub fn reset(&mut self) {
        self.frame_count = 0;
        self.error_count = 0;
        self.id_counts.clear();
        self.window_start = 0;
        self.last_stats = BusStats {
            load_rate: 0.0,
            fps: 0.0,
            error_count: 0,
            id_frequencies: HashMap::new(),
        };
    }
}
