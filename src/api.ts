import { invoke } from '@tauri-apps/api/core';
import type {
  CanFrame,
  SimMessageConfig,
  DbcDatabase,
  RecordedFrame,
  BusStats,
  DecodedSignal,
  CompareResult,
} from './types';

export const canApi = {
  startSimulator: () => invoke<void>('start_simulator'),
  stopSimulator: () => invoke<void>('stop_simulator'),
  isSimulatorRunning: () => invoke<boolean>('is_simulator_running'),
  setSimulatorConfigs: (configs: SimMessageConfig[]) =>
    invoke<void>('set_simulator_configs', { configs }),
  getSimulatorConfigs: () => invoke<SimMessageConfig[]>('get_simulator_configs'),
  setErrorRate: (rate: number) => invoke<void>('set_error_rate', { rate }),

  getFrames: () => invoke<CanFrame[]>('get_frames'),
  getFrameDisplayMap: () => invoke<Record<string, CanFrame & { count: number; period: number; last_timestamp: number }>>('get_frame_display_map'),
  clearFrames: () => invoke<void>('clear_frames'),

  sendFrame: (id: number, isExtended: boolean, data: number[]) =>
    invoke<void>('send_frame', { id, isExtended, data }),
  startPeriodicSend: (id: number, isExtended: boolean, data: number[], periodMs: number) =>
    invoke<string>('start_periodic_send', { id, isExtended, data, periodMs }),
  stopPeriodicSend: (key: string) => invoke<void>('stop_periodic_send', { key }),

  parseDbc: (content: string) => invoke<DbcDatabase>('parse_dbc', { content }),
  setDbc: (dbc: DbcDatabase) => invoke<void>('set_dbc', { dbc }),
  decodeSignals: (messageId: number, data: number[]) =>
    invoke<DecodedSignal[]>('decode_signals', { messageId, data }),
  encodeSignalValues: (messageId: number, signalValues: Record<string, number>) =>
    invoke<number[]>('encode_signal_values', { messageId, signalValues }),

  getStats: () => invoke<BusStats>('get_stats'),
  resetStats: () => invoke<void>('reset_stats'),

  startRecording: (filePath: string) => invoke<void>('start_recording', { filePath }),
  stopRecording: () => invoke<void>('stop_recording'),
  isRecording: () => invoke<boolean>('is_recording'),

  loadRecording: (filePath: string) => invoke<RecordedFrame[]>('load_recording', { filePath }),

  compareRecordings: (basePath: string, comparePath: string, thresholdPercent: number) =>
    invoke<CompareResult>('compare_recordings', { basePath, comparePath, thresholdPercent }),
};

export const subscribeEvents = async (
  onFrame: (frame: CanFrame) => void,
  onStats: (stats: BusStats) => void
) => {
  const { listen } = await import('@tauri-apps/api/event');
  await listen<CanFrame>('can-frame', (event) => onFrame(event.payload));
  await listen<BusStats>('bus-stats', (event) => onStats(event.payload));
};
