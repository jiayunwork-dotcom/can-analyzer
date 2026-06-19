import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store';
import type { CanFrameDisplay, SortField } from '../types';
import { formatTimestamp, formatId, formatData, applyFilters, sortFrames, frameKey } from '../utils';

const COLUMNS: { key: SortField | 'timestamp' | 'direction' | 'dlc' | 'data' | 'count'; label: string; sortable: boolean }[] = [
  { key: 'timestamp', label: '时间戳', sortable: false },
  { key: 'id', label: 'ID', sortable: true },
  { key: 'direction', label: '方向', sortable: false },
  { key: 'dlc', label: 'DLC', sortable: false },
  { key: 'data', label: '数据', sortable: false },
  { key: 'period', label: '周期(ms)', sortable: true },
  { key: 'count', label: '计数', sortable: true },
  { key: 'last_timestamp', label: '最后更新', sortable: true },
];

export default function MonitorTable() {
  const frames = useAppStore((s) => s.frames);
  const filters = useAppStore((s) => s.filters);
  const dbc = useAppStore((s) => s.dbc);
  const decodedSignals = useAppStore((s) => s.decodedSignals);
  const sortField = useAppStore((s) => s.sortField);
  const sortOrder = useAppStore((s) => s.sortOrder);
  const setSort = useAppStore((s) => s.setSort);
  const selectedFrameId = useAppStore((s) => s.selectedFrameId);
  const setSelectedFrameId = useAppStore((s) => s.setSelectedFrameId);

  const [displayFrames, setDisplayFrames] = useState<CanFrameDisplay[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const frameCountRef = useRef(0);

  useEffect(() => {
    const allFrames = Object.values(frames);
    const filtered = allFrames.filter((f) => applyFilters(f, filters, dbc, decodedSignals));
    const sorted = sortFrames(filtered, sortField, sortOrder);
    frameCountRef.current = sorted.length;
    setDisplayFrames(sorted);
  }, [frames, filters, dbc, decodedSignals, sortField, sortOrder]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatLastUpdate = (lastTimestamp: number): string => {
    const diffUs = now * 1000 - lastTimestamp;
    const diffSec = Math.max(0, diffUs / 1_000_000);
    if (diffSec < 1) {
      return '刚刚';
    }
    if (diffSec < 60) {
      return `${diffSec.toFixed(1)}s 前`;
    }
    if (diffSec < 3600) {
      return `${(diffSec / 60).toFixed(1)}m 前`;
    }
    if (diffSec < 86400) {
      return `${(diffSec / 3600).toFixed(1)}h 前`;
    }
    return `${(diffSec / 86400).toFixed(1)}d 前`;
  };

  return (
    <div className="monitor-table-container">
      <table className="monitor-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && setSort(col.key as SortField)}
              >
                {col.label}
                {col.sortable && sortField === col.key && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayFrames.map((frame) => {
            const key = frameKey(frame.id, frame.is_extended);
            const isSelected = key === selectedFrameId;
            return (
              <tr
                key={key}
                className={`${frame.is_tx ? 'tx' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedFrameId(isSelected ? null : key)}
              >
                <td className="col-timestamp">{formatTimestamp(frame.timestamp)}</td>
                <td className="col-id">{formatId(frame.id, frame.is_extended)}</td>
                <td className={frame.is_tx ? 'col-dir-tx' : 'col-dir-rx'}>
                  {frame.is_tx ? '发送' : '接收'}
                </td>
                <td className="col-dlc">{frame.dlc}</td>
                <td className="col-data">{formatData(frame.data)}</td>
                <td className="col-period">
                  {frame.period > 0 ? (frame.period / 1000).toFixed(2) : '-'}
                </td>
                <td className="col-count">{frame.count}</td>
                <td className="col-last-update">
                  {formatLastUpdate(frame.last_timestamp)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {displayFrames.length === 0 && (
        <div className="empty-state">暂无报文数据，请启动模拟器或加载回放文件</div>
      )}
    </div>
  );
}
