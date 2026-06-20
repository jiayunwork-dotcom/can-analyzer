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
