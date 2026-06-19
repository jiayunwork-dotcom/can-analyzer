import { create } from 'zustand';
import type {
  CanFrameDisplay,
  DbcDatabase,
  SimMessageConfig,
  FilterRule,
  SortField,
  SortOrder,
  TraceSignal,
  BusStats,
  RecordedFrame,
  PlaybackState,
  DecodedSignal,
} from './types';

interface AppState {
  simRunning: boolean;
  simConfigs: SimMessageConfig[];
  dbc: DbcDatabase | null;
  dbcFilePath: string | null;
  frames: Record<string, CanFrameDisplay>;
  frameOrder: string[];
  selectedFrameId: string | null;
  decodedSignals: Record<number, DecodedSignal[]>;
  filters: FilterRule[];
  sortField: SortField;
  sortOrder: SortOrder;
  stats: BusStats;
  traceSignals: TraceSignal[];
  isRecording: boolean;
  playbackFrames: RecordedFrame[];
  playbackState: PlaybackState;
  playbackSpeed: number;
  playbackPosition: number;

  setSimRunning: (v: boolean) => void;
  setSimConfigs: (v: SimMessageConfig[]) => void;
  setDbc: (dbc: DbcDatabase | null, path: string | null) => void;
  addFrame: (frame: CanFrameDisplay) => void;
  clearFrames: () => void;
  setSelectedFrameId: (id: string | null) => void;
  setDecodedSignals: (msgId: number, signals: DecodedSignal[]) => void;
  setFilters: (filters: FilterRule[]) => void;
  setSort: (field: SortField) => void;
  setStats: (stats: BusStats) => void;
  resetStats: () => void;
  addTraceSignal: (msgId: number, signalName: string) => void;
  removeTraceSignal: (msgId: number, signalName: string) => void;
  addTracePoint: (msgId: number, signalName: string, timestamp: number, value: number) => void;
  setRecording: (v: boolean) => void;
  setPlaybackFrames: (frames: RecordedFrame[]) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaybackPosition: (pos: number) => void;
}

const TRACE_COLORS = ['#4ec9b0', '#ce9178', '#569cd6', '#c586c0', '#dcdcaa', '#b5cea8'];

export const useAppStore = create<AppState>((set, get) => ({
  simRunning: false,
  simConfigs: [],
  dbc: null,
  dbcFilePath: null,
  frames: {},
  frameOrder: [],
  selectedFrameId: null,
  decodedSignals: {},
  filters: [],
  sortField: 'id',
  sortOrder: 'asc',
  stats: { load_rate: 0, fps: 0, error_count: 0, id_frequencies: {} },
  traceSignals: [],
  isRecording: false,
  playbackFrames: [],
  playbackState: 'stopped',
  playbackSpeed: 1,
  playbackPosition: 0,

  setSimRunning: (v) => set({ simRunning: v }),
  setSimConfigs: (v) => set({ simConfigs: v }),
  setDbc: (dbc, path) => set({ dbc, dbcFilePath: path }),

  addFrame: (frame) =>
    set((state) => {
      const key = `${frame.id}_${frame.is_extended ? 'ext' : 'std'}`;
      const existing = state.frames[key];
      let mergedFrame;
      if (existing) {
        const period = existing.last_timestamp > 0
          ? frame.timestamp - existing.last_timestamp
          : 0;
        mergedFrame = {
          ...frame,
          count: existing.count + 1,
          period,
          last_timestamp: frame.timestamp,
        };
      } else {
        mergedFrame = {
          ...frame,
          count: 1,
          period: 0,
          last_timestamp: frame.timestamp,
        };
      }
      const newFrames = { ...state.frames, [key]: mergedFrame };
      let newOrder = state.frameOrder;
      if (!existing) {
        newOrder = [...state.frameOrder, key];
      }
      return { frames: newFrames, frameOrder: newOrder };
    }),

  clearFrames: () => set({ frames: {}, frameOrder: [], selectedFrameId: null, decodedSignals: {} }),

  setSelectedFrameId: (id) => set({ selectedFrameId: id }),
  setDecodedSignals: (msgId, signals) =>
    set((state) => ({ decodedSignals: { ...state.decodedSignals, [msgId]: signals } })),

  setFilters: (filters) => set({ filters }),

  setSort: (field) =>
    set((state) => ({
      sortField: field,
      sortOrder: state.sortField === field && state.sortOrder === 'asc' ? 'desc' : 'asc',
    })),

  setStats: (stats) => set({ stats }),
  resetStats: () =>
    set({
      stats: { load_rate: 0, fps: 0, error_count: 0, id_frequencies: {} },
    }),

  addTraceSignal: (msgId, signalName) => {
    const state = get();
    const exists = state.traceSignals.find(
      (t) => t.message_id === msgId && t.signal_name === signalName
    );
    if (exists) return;
    if (state.traceSignals.length >= 4) return;
    const color = TRACE_COLORS[state.traceSignals.length % TRACE_COLORS.length];
    set({
      traceSignals: [
        ...state.traceSignals,
        { message_id: msgId, signal_name: signalName, color, points: [] },
      ],
    });
  },

  removeTraceSignal: (msgId, signalName) =>
    set((state) => ({
      traceSignals: state.traceSignals.filter(
        (t) => !(t.message_id === msgId && t.signal_name === signalName)
      ),
    })),

  addTracePoint: (msgId, signalName, timestamp, value) =>
    set((state) => ({
      traceSignals: state.traceSignals.map((t) => {
        if (t.message_id === msgId && t.signal_name === signalName) {
          const cutoff = timestamp - 30000;
          const newPoints = [...t.points.filter((p) => p.timestamp >= cutoff), { timestamp, value }];
          return { ...t, points: newPoints };
        }
        return t;
      }),
    })),

  setRecording: (v) => set({ isRecording: v }),
  setPlaybackFrames: (frames) => set({ playbackFrames: frames }),
  setPlaybackState: (state) => set({ playbackState: state }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setPlaybackPosition: (pos) => set({ playbackPosition: pos }),
}));
