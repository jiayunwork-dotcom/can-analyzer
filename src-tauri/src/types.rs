use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanFrame {
    pub timestamp: u64,
    pub id: u32,
    pub is_extended: bool,
    pub is_tx: bool,
    pub dlc: u8,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanFrameDisplay {
    pub timestamp: u64,
    pub id: u32,
    pub is_extended: bool,
    pub is_tx: bool,
    pub dlc: u8,
    pub data: Vec<u8>,
    pub count: u64,
    pub period: u64,
    pub last_timestamp: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DataGenMode {
    Fixed,
    Counter,
    Random,
    Sine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimMessageConfig {
    pub id: u32,
    pub is_extended: bool,
    pub period_ms: u64,
    pub dlc: u8,
    pub mode: DataGenMode,
    pub fixed_data: Vec<u8>,
    pub counter_min: u32,
    pub counter_max: u32,
    pub sine_amplitude: f64,
    pub sine_offset: f64,
    pub sine_period_ms: u64,
    pub byte_start: u8,
    pub byte_count: u8,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbcSignal {
    pub name: String,
    pub start_bit: u8,
    pub bit_length: u8,
    pub is_little_endian: bool,
    pub is_signed: bool,
    pub factor: f64,
    pub offset: f64,
    pub min_value: f64,
    pub max_value: f64,
    pub unit: String,
    pub value_table: HashMap<u64, String>,
    pub is_multiplexor: bool,
    pub multiplexor_value: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbcMessage {
    pub id: u32,
    pub is_extended: bool,
    pub name: String,
    pub dlc: u8,
    pub sender: String,
    pub signals: Vec<DbcSignal>,
    pub has_multiplexor: bool,
    pub multiplexor_signal_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbcDatabase {
    pub messages: Vec<DbcMessage>,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedSignal {
    pub name: String,
    pub raw_value: i64,
    pub physical_value: f64,
    pub unit: String,
    pub enum_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BusStats {
    pub load_rate: f64,
    pub fps: f64,
    pub error_count: u64,
    pub id_frequencies: HashMap<u32, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedFrame {
    pub timestamp: u64,
    pub channel: u8,
    pub id: u32,
    pub is_extended: bool,
    pub is_tx: bool,
    pub dlc: u8,
    pub data: Vec<u8>,
}
