use crate::types::{CanFrame, SimMessageConfig, DataGenMode};
use rand::Rng;
use std::time::Instant;

pub struct SimState {
    pub configs: Vec<SimMessageConfig>,
    pub start_time: Instant,
    pub counters: std::collections::HashMap<u32, u32>,
    pub error_rate: f64,
}

impl SimState {
    pub fn new() -> Self {
        Self {
            configs: Vec::new(),
            start_time: Instant::now(),
            counters: std::collections::HashMap::new(),
            error_rate: 0.0,
        }
    }

    pub fn generate_frame(&mut self, config: &SimMessageConfig, timestamp: u64) -> Option<CanFrame> {
        if !config.enabled {
            return None;
        }

        if self.error_rate > 0.0 {
            let mut rng = rand::thread_rng();
            if rng.gen::<f64>() < self.error_rate {
                return None;
            }
        }

        let data = match config.mode {
            DataGenMode::Fixed => config.fixed_data.clone(),
            DataGenMode::Counter => self.generate_counter_data(config),
            DataGenMode::Random => self.generate_random_data(config),
            DataGenMode::Sine => self.generate_sine_data(config, timestamp),
        };

        let dlc = config.dlc.min(data.len() as u8).max(1);
        let mut final_data = data;
        final_data.truncate(dlc as usize);
        while final_data.len() < dlc as usize {
            final_data.push(0);
        }

        Some(CanFrame {
            timestamp,
            id: config.id,
            is_extended: config.is_extended,
            is_tx: false,
            dlc,
            data: final_data,
        })
    }

    fn generate_counter_data(&mut self, config: &SimMessageConfig) -> Vec<u8> {
        let counter = self.counters.entry(config.id).or_insert(config.counter_min);
        let val = *counter;

        *counter += 1;
        if *counter > config.counter_max {
            *counter = config.counter_min;
        }

        let mut data = vec![0u8; config.dlc as usize];
        let byte_start = config.byte_start.min(7) as usize;
        let byte_count = config.byte_count.min(4).min(config.dlc.saturating_sub(config.byte_start)) as usize;

        for i in 0..byte_count {
            if byte_start + i < data.len() {
                data[byte_start + i] = ((val >> (i * 8)) & 0xFF) as u8;
            }
        }

        data
    }

    fn generate_random_data(&self, config: &SimMessageConfig) -> Vec<u8> {
        let mut rng = rand::thread_rng();
        (0..config.dlc).map(|_| rng.gen::<u8>()).collect()
    }

    fn generate_sine_data(&self, config: &SimMessageConfig, timestamp: u64) -> Vec<u8> {
        let t_ms = (timestamp / 1000) as f64;
        let omega = 2.0 * std::f64::consts::PI / (config.sine_period_ms as f64);
        let sine_val = config.sine_offset + config.sine_amplitude * (omega * t_ms).sin();
        let int_val = sine_val.round() as i32;

        let mut data = vec![0u8; config.dlc as usize];
        let byte_start = config.byte_start.min(6) as usize;

        let bytes = int_val.to_le_bytes();
        for i in 0..2usize {
            if byte_start + i < data.len() {
                data[byte_start + i] = bytes[i];
            }
        }

        data
    }
}
