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
    pub cycle_time_ms: Option<u64>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareFileInfo {
    pub file_name: String,
    pub total_frames: u64,
    pub time_span_us: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalDiffEntry {
    pub base_timestamp: u64,
    pub base_value: f64,
    pub compare_value: f64,
    pub diff: f64,
    pub diff_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalDiffSummary {
    pub signal_name: String,
    pub unit: String,
    pub signal_range: f64,
    pub max_diff: f64,
    pub avg_diff: f64,
    pub std_diff: f64,
    pub over_threshold_ratio: f64,
    pub matched_count: u64,
    pub no_match_count: u64,
    pub diff_entries: Vec<SignalDiffEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByteDiffEntry {
    pub base_timestamp: u64,
    pub byte_index: u8,
    pub base_value: u8,
    pub compare_value: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByteDiffSummary {
    pub byte_index: u8,
    pub diff_count: u64,
    pub total_matched: u64,
    pub diff_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageCompareResult {
    pub message_id: u32,
    pub message_name: String,
    pub is_extended: bool,
    pub base_frame_count: u64,
    pub compare_frame_count: u64,
    pub matched_frame_count: u64,
    pub no_match_count: u64,
    pub has_dbc: bool,
    pub signal_diffs: Vec<SignalDiffSummary>,
    pub byte_diffs: Vec<ByteDiffSummary>,
    pub only_in_base: bool,
    pub only_in_compare: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareResult {
    pub base_file: CompareFileInfo,
    pub compare_file: CompareFileInfo,
    pub frame_count_diff: i64,
    pub time_span_diff_us: i64,
    pub common_id_count: u32,
    pub only_in_base_ids: Vec<u32>,
    pub only_in_compare_ids: Vec<u32>,
    pub messages: Vec<MessageCompareResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareFileError {
    pub file_name: String,
    pub file_path: String,
    pub error_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrendDirection {
    Improving,
    Worsening,
    Fluctuating,
    InsufficientData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendResult {
    pub direction: TrendDirection,
    pub slope: f64,
    pub r_squared: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalTrendInfo {
    pub message_id: u32,
    pub signal_name: String,
    pub trend: TrendResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCompareResult {
    pub base_file: CompareFileInfo,
    pub compare_results: Vec<CompareResult>,
    pub failed_files: Vec<CompareFileError>,
    pub trends: Vec<SignalTrendInfo>,
}
