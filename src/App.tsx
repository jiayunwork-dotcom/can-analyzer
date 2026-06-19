import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from './store';
import { canApi, subscribeEvents } from './api';
import type { CanFrame, BusStats } from './types';
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

  const onFrame = useCallback(
    async (frame: CanFrame) => {
      const displayFrame = {
        ...frame,
        count: 1,
        period: 0,
        last_timestamp: frame.timestamp,
      };
      addFrame(displayFrame);

      if (dbc) {
        try {
          const decoded = await canApi.decodeSignals(frame.id, frame.data);
          setDecodedSignals(frame.id, decoded);

          for (const trace of traceSignals) {
            if (trace.message_id === frame.id) {
              const sig = decoded.find((s) => s.name === trace.signal_name);
              if (sig) {
                addTracePoint(frame.id, trace.signal_name, frame.timestamp, sig.physical_value);
              }
            }
          }
        } catch {
          // 可能没有对应的 DBC 定义
        }
      }
    },
    [addFrame, setDecodedSignals, addTracePoint, traceSignals, dbc]
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
    </div>
  );
}
