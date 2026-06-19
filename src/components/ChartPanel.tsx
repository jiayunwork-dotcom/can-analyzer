import { useMemo } from 'react';
import { useAppStore } from '../store';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ChartDataPoint {
  time: string;
  timestamp: number;
  [key: string]: number | string;
}

export default function ChartPanel() {
  const traceSignals = useAppStore((s) => s.traceSignals);
  const removeTraceSignal = useAppStore((s) => s.removeTraceSignal);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (traceSignals.length === 0) return [];

    const allTimestamps = new Set<number>();
    traceSignals.forEach((t) => t.points.forEach((p) => allTimestamps.add(p.timestamp)));
    const timestamps = Array.from(allTimestamps).sort((a, b) => a - b).slice(-600);

    return timestamps.map((ts) => {
      const point: ChartDataPoint = {
        timestamp: ts,
        time: ((ts % 60000000) / 1000000).toFixed(2) + 's',
      };
      traceSignals.forEach((trace) => {
        const sigKey = `${trace.message_id}_${trace.signal_name}`;
        const nearest = trace.points.reduce(
          (best, p) =>
            best === null || Math.abs(p.timestamp - ts) < Math.abs(best.timestamp - ts) ? p : best,
          null as { timestamp: number; value: number } | null
        );
        if (nearest && Math.abs(nearest.timestamp - ts) < 500000) {
          point[sigKey] = nearest.value;
        }
      });
      return point;
    });
  }, [traceSignals]);

  if (traceSignals.length === 0) {
    return (
      <div className="chart-panel">
        <div className="chart-panel-header">
          <span style={{ fontWeight: 600, color: '#ccc' }}>信号图形追踪</span>
        </div>
        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          从 DBC 树或信号面板点击信号可添加追踪（最多 4 个）
        </div>
      </div>
    );
  }

  return (
    <div className="chart-panel">
      <div className="chart-panel-header">
        <div className="chart-legend">
          {traceSignals.map((trace) => (
            <div
              key={`${trace.message_id}_${trace.signal_name}`}
              className="chart-legend-item"
              style={{ cursor: 'pointer' }}
              onClick={() => removeTraceSignal(trace.message_id, trace.signal_name)}
              title="点击移除"
            >
              <div className="chart-legend-color" style={{ backgroundColor: trace.color }} />
              <span>{trace.signal_name}</span>
              {trace.points.length > 0 && (
                <span style={{ fontFamily: 'Consolas', color: trace.color }}>
                  {trace.points[trace.points.length - 1].value.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#888' }}>最近 30 秒</span>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="time"
              stroke="#888"
              fontSize={10}
              tick={{ fill: '#888' }}
              interval="preserveStartEnd"
            />
            <YAxis stroke="#888" fontSize={10} tick={{ fill: '#888' }} width={50} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#2d2d30',
                border: '1px solid #444',
                borderRadius: 4,
                fontSize: 11,
              }}
              labelStyle={{ color: '#ccc' }}
            />
            {traceSignals.map((trace) => (
              <Line
                key={`${trace.message_id}_${trace.signal_name}`}
                type="monotone"
                dataKey={`${trace.message_id}_${trace.signal_name}`}
                name={trace.signal_name}
                stroke={trace.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
