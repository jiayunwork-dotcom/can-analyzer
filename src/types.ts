export interface CanFrame {
  timestamp: number;
  id: number;
  is_extended: boolean;
  is_tx: boolean;
  dlc: number;
  data: number[];
}

export interface CanFrameDisplay extends CanFrame {
  count: number;
  period: number;
  last_timestamp: number;
}

export type DataGenMode = 'fixed' | 'counter' | 'random' | 'sine';

export interface SimMessageConfig {
  id: number;
  is_extended: boolean;
  period_ms: number;
  dlc: number;
  mode: DataGenMode;
  fixed_data: number[];
  counter_min: number;
  counter_max: number;
  sine_amplitude: number;
  sine_offset: number;
  sine_period_ms: number;
  byte_start: number;
  byte_count: number;
  enabled: boolean;
}

export interface DbcSignal {
  name: string;
  start_bit: number;
  bit_length: number;
  is_little_endian: boolean;
  is_signed: boolean;
  factor: number;
  offset: number;
  min_value: number;
  max_value: number;
  unit: string;
  value_table: Record<number, string>;
  is_multiplexor: boolean;
  multiplexor_value: number | null;
}

export interface DbcMessage {
  id: number;
  is_extended: boolean;
  name: string;
  dlc: number;
  sender: string;
  signals: DbcSignal[];
  has_multiplexor: boolean;
  multiplexor_signal_name: string | null;
  cycle_time_ms: number | null;
}

export interface DbcDatabase {
  messages: DbcMessage[];
  version: string;
}

export type FilterMode = 'whitelist' | 'blacklist' | 'conditional';

export interface FilterRule {
  id: string;
  mode: FilterMode;
  ids?: number[];
  signal_name?: string;
  message_id?: number;
  op?: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value?: number;
  enabled: boolean;
}

export interface DecodedSignal {
  name: string;
  raw_value: number;
  physical_value: number;
  unit: string;
  enum_label: string | null;
}

export interface SignalTracePoint {
  timestamp: number;
  value: number;
}

export interface TraceSignal {
  message_id: number;
  signal_name: string;
  color: string;
  points: SignalTracePoint[];
}

export type SortField = 'id' | 'period' | 'last_timestamp' | 'count';
export type SortOrder = 'asc' | 'desc';

export interface BusStats {
  load_rate: number;
  fps: number;
  error_count: number;
  id_frequencies: Record<number, number>;
}

export interface RecordedFrame {
  timestamp: number;
  channel: number;
  id: number;
  is_extended: boolean;
  is_tx: boolean;
  dlc: number;
  data: number[];
}

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export type AlarmDirection = 'above_max' | 'below_min';

export interface AlarmRecord {
  id: string;
  timestamp: number;
  signal_name: string;
  current_value: number;
  direction: AlarmDirection;
  message_id: number;
  is_extended: boolean;
  min_value: number;
  max_value: number;
}

export interface FrameLossInfo {
  message_id: number;
  is_extended: boolean;
  expected_cycle_ms: number;
  loss_count: number;
  is_loss: boolean;
}

export interface CompareFileInfo {
  file_name: string;
  total_frames: number;
  time_span_us: number;
}

export interface SignalDiffEntry {
  base_timestamp: number;
  base_value: number;
  compare_value: number;
  diff: number;
  diff_percent: number;
}

export interface SignalDiffSummary {
  signal_name: string;
  unit: string;
  signal_range: number;
  max_diff: number;
  avg_diff: number;
  std_diff: number;
  over_threshold_ratio: number;
  matched_count: number;
  no_match_count: number;
  diff_entries: SignalDiffEntry[];
}

export interface ByteDiffSummary {
  byte_index: number;
  diff_count: number;
  total_matched: number;
  diff_ratio: number;
}

export interface MessageCompareResult {
  message_id: number;
  message_name: string;
  is_extended: boolean;
  base_frame_count: number;
  compare_frame_count: number;
  matched_frame_count: number;
  no_match_count: number;
  has_dbc: boolean;
  signal_diffs: SignalDiffSummary[];
  byte_diffs: ByteDiffSummary[];
  only_in_base: boolean;
  only_in_compare: boolean;
}

export interface CompareResult {
  base_file: CompareFileInfo;
  compare_file: CompareFileInfo;
  frame_count_diff: number;
  time_span_diff_us: number;
  common_id_count: number;
  only_in_base_ids: number[];
  only_in_compare_ids: number[];
  messages: MessageCompareResult[];
}
