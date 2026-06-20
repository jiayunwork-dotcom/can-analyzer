import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from './store';
import { canApi, subscribeEvents } from './api';
import type { CanFrame, BusStats, AlarmRecord, DbcSignal } from './types';
import AppHeader from './components/AppHeader';
import SimulatorPanel from './components/SimulatorPanel';
import DbcPanel from './components/DbcPanel';
import FilterPanel from './components/FilterPanel';
import MonitorTable from './components/MonitorTable';
import SignalPanel from './components/SignalPanel';
import SendPanel from './components/SendPanel';
import StatsPanel from './components/StatsPanel';
import ChartPanel from './components/ChartPanel';
import PlaybackPanel from './components/PlaybackPanel';
import { frameKey } from './utils';

function AlarmLogBar() {
  const alarms = useAppStore((s) => s.alarms);
  const setSelectedFrameId = useAppStore((s) => s.setSelectedFrameId);
  const clearAlarms = useAppStore((s) => s.clearAlarms);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [alarms]);

  if (alarms.length === 0) return null;

  const handleAlarmClick = (alarm: AlarmRecord) => {
    const key = frameKey(alarm.message_id, false);
    setSelectedFrameId(key);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  return (
    <div className="alarm-log-bar">
      <div className="alarm-log-header">
        <span className="alarm-log-title">⚠ 告警日志</span>
        <button className="btn btn-sm" onClick={clearAlarms}>清除</button>
      </div>
      <div className="alarm-log-list" ref={scrollRef}>
        {alarms.map((alarm) => (
          <div
            key={alarm.id}
            className="alarm-log-item"
            onClick={() => handleAlarmClick(alarm)}
            title="点击定位到对应报文"
          >
            <span className="alarm-log-time">{formatTime(alarm.timestamp)}</span>
            <span className="alarm-log-signal">{alarm.signal_name}</span>
            <span className={`alarm-log-direction ${alarm.direction === 'above_max' ? 'dir-above' : 'dir-below'}`}>
              {alarm.direction === 'above_max' ? '▲ 超上限' : '▼ 超下限'}
            </span>
            <span className="alarm-log-value">{formatAlarmValue(alarm.current_value)}</span>
            <span className="alarm-log-range">[{alarm.min_value}, {alarm.max_value}]</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAlarmValue(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(3);
}

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const addFrame = useAppStore((s) => s.addFrame);
  const setStats = useAppStore((s) => s.setStats);
  const setSimRunning = useAppStore((s) => s.setSimRunning);
  const setSimConfigs = useAppStore((s) => s.setSimConfigs);
  const setDbc = useAppStore((s) => s.setDbc);
  const setDecodedSignals = useAppStore((s) => s.setDecodedSignals);
  const addTracePoint = useAppStore((s) => s.addTracePoint);
  const traceSignals = useAppStore((s) => s.traceSignals);
  const dbc = useAppStore((s) => s.dbc);
  const addAlarm = useAppStore((s) => s.addAlarm);
  const updateFrameLoss = useAppStore((s) => s.updateFrameLoss);
  const frames = useAppStore((s) => s.frames);
  const dbcRef = useRef(dbc);
  const traceSignalsRef = useRef(traceSignals);
  const framesRef = useRef(frames);

  useEffect(() => { dbcRef.current = dbc; }, [dbc]);
  useEffect(() => { traceSignalsRef.current = traceSignals; }, [traceSignals]);
  useEffect(() => { framesRef.current = frames; }, [frames]);

  const onFrame = useCallback(
    async (frame: CanFrame) => {
      const displayFrame = {
        ...frame,
        count: 1,
        period: 0,
        last_timestamp: frame.timestamp,
      };
      addFrame(displayFrame);

      const currentDbc = dbcRef.current;
      if (currentDbc) {
        try {
          const decoded = await canApi.decodeSignals(frame.id, frame.data);
          setDecodedSignals(frame.id, decoded);

          const msg = currentDbc.messages.find((m) => m.id === frame.id);

          for (const sig of decoded) {
            const dbcSig = msg?.signals.find((s: DbcSignal) => s.name === sig.name);
            if (dbcSig && (sig.physical_value < dbcSig.min_value || sig.physical_value > dbcSig.max_value)) {
              const alarm: AlarmRecord = {
                id: `${Date.now()}_${frame.id}_${sig.name}_${Math.random().toString(36).slice(2, 6)}`,
                timestamp: Date.now(),
                signal_name: sig.name,
                current_value: sig.physical_value,
                direction: sig.physical_value > dbcSig.max_value ? 'above_max' : 'below_min',
                message_id: frame.id,
                min_value: dbcSig.min_value,
                max_value: dbcSig.max_value,
              };
              addAlarm(alarm);
            }
          }

          const currentTraces = traceSignalsRef.current;
          for (const trace of currentTraces) {
            if (trace.message_id === frame.id) {
              const sig = decoded.find((s) => s.name === trace.signal_name);
              if (sig) {
                addTracePoint(frame.id, trace.signal_name, frame.timestamp, sig.physical_value);
              }
            }
          }

          if (msg && msg.cycle_time_ms) {
            const key = frameKey(frame.id, frame.is_extended);
            const currentFrames = framesRef.current;
            const existingFrame = currentFrames[key];
            if (existingFrame && existingFrame.last_timestamp > 0) {
              const intervalUs = frame.timestamp - existingFrame.last_timestamp;
              const intervalMs = intervalUs / 1000;
              const expectedMs = msg.cycle_time_ms;
              const isLoss = intervalMs > expectedMs * 3;
              const currentLossInfo = useAppStore.getState().frameLossMap[key];
              const currentLossCount = currentLossInfo?.loss_count || 0;
              updateFrameLoss(key, {
                message_id: frame.id,
                is_extended: frame.is_extended,
                expected_cycle_ms: expectedMs,
                is_loss: isLoss,
                loss_count: isLoss ? currentLossCount + 1 : currentLossCount,
              });
            } else {
              updateFrameLoss(key, {
                message_id: frame.id,
                is_extended: frame.is_extended,
                expected_cycle_ms: msg.cycle_time_ms,
                is_loss: false,
                loss_count: 0,
              });
            }
          }
        } catch {
          // 可能没有对应的 DBC 定义
        }
      }
    },
    [addFrame, setDecodedSignals, addTracePoint, addAlarm, updateFrameLoss]
  );

  const onStats = useCallback(
    (stats: BusStats) => {
      setStats(stats);
    },
    [setStats]
  );

  useEffect(() => {
    const init = async () => {
      try {
        await subscribeEvents(onFrame, onStats);
        const running = await canApi.isSimulatorRunning();
        setSimRunning(running);
        const configs = await canApi.getSimulatorConfigs();
        setSimConfigs(configs);
      } catch (e) {
        console.error('Init failed:', e);
      }
      setInitialized(true);
    };
    init();
  }, []);

  if (!initialized) {
    return <div style={{ padding: 20 }}>正在初始化...</div>;
  }

  return (
    <div className="app-container">
      <AppHeader />
      <div className="app-main">
        <div className="panel-left">
          <SimulatorPanel />
          <DbcPanel />
          <FilterPanel />
        </div>
        <div className="panel-center">
          <MonitorTable />
          <SignalPanel />
          <ChartPanel />
        </div>
        <div className="panel-right">
          <SendPanel />
          <StatsPanel />
          <PlaybackPanel />
        </div>
      </div>
      <AlarmLogBar />
    </div>
  );
}
