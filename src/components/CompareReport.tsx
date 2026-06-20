import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { CompareResult, MessageCompareResult, SignalDiffSummary } from '../types';

interface Props {
  result: CompareResult;
  threshold: number;
  onClose: () => void;
}

export default function CompareReport({ result, threshold, onClose }: Props) {
  const [expandedMsgIds, setExpandedMsgIds] = useState<Set<number>>(new Set());
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());

  const toggleMsg = (id: number) => {
    setExpandedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSignal = (key: string) => {
    setExpandedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatSpan = (us: number) => {
    const sec = us / 1_000_000;
    if (sec < 60) return `${sec.toFixed(2)}s`;
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}m ${s}s`;
  };

  const formatTs = (us: number) => {
    const sec = us / 1_000_000;
    return `${sec.toFixed(6)}s`;
  };

  const formatVal = (v: number) => {
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(4);
  };

  return (
    <div className="compare-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compare-header">
          <h2>报文比较报告</h2>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div className="compare-summary">
          <div className="compare-summary-card">
            <div className="compare-summary-label">基准文件</div>
            <div className="compare-summary-value">{result.base_file.file_name}</div>
            <div className="compare-summary-meta">
              {result.base_file.total_frames} 帧 | {formatSpan(result.base_file.time_span_us)}
            </div>
          </div>
          <div className="compare-summary-card">
            <div className="compare-summary-label">对比文件</div>
            <div className="compare-summary-value">{result.compare_file.file_name}</div>
            <div className="compare-summary-meta">
              {result.compare_file.total_frames} 帧 | {formatSpan(result.compare_file.time_span_us)}
            </div>
          </div>
          <div className="compare-summary-card">
            <div className="compare-summary-label">帧数差异</div>
            <div className="compare-summary-value" style={{ color: result.frame_count_diff > 0 ? '#ce9178' : result.frame_count_diff < 0 ? '#4ec9b0' : '#dcdcaa' }}>
              {result.frame_count_diff > 0 ? '+' : ''}{result.frame_count_diff}
            </div>
          </div>
          <div className="compare-summary-card">
            <div className="compare-summary-label">时间跨度差异</div>
            <div className="compare-summary-value">
              {result.time_span_diff_us > 0 ? '+' : ''}{formatSpan(Math.abs(result.time_span_diff_us))}
            </div>
          </div>
          <div className="compare-summary-card">
            <div className="compare-summary-label">共有ID</div>
            <div className="compare-summary-value" style={{ color: '#4ec9b0' }}>{result.common_id_count}</div>
          </div>
          {result.only_in_base_ids.length > 0 && (
            <div className="compare-summary-card">
              <div className="compare-summary-label">仅基准文件</div>
              <div className="compare-summary-value" style={{ color: '#ce9178' }}>
                {result.only_in_base_ids.length} 个ID
              </div>
            </div>
          )}
          {result.only_in_compare_ids.length > 0 && (
            <div className="compare-summary-card">
              <div className="compare-summary-label">仅对比文件</div>
              <div className="compare-summary-value" style={{ color: '#569cd6' }}>
                {result.only_in_compare_ids.length} 个ID
              </div>
            </div>
          )}
        </div>

        <div className="compare-body">
          {result.messages.map((msg) => (
            <MessageNode
              key={msg.message_id}
              msg={msg}
              expanded={expandedMsgIds.has(msg.message_id)}
              expandedSignals={expandedSignals}
              onToggleMsg={() => toggleMsg(msg.message_id)}
              onToggleSignal={toggleSignal}
              threshold={threshold}
              formatSpan={formatSpan}
              formatTs={formatTs}
              formatVal={formatVal}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface MessageNodeProps {
  msg: MessageCompareResult;
  expanded: boolean;
  expandedSignals: Set<string>;
  onToggleMsg: () => void;
  onToggleSignal: (key: string) => void;
  threshold: number;
  formatSpan: (us: number) => string;
  formatTs: (us: number) => string;
  formatVal: (v: number) => string;
}

function MessageNode({
  msg,
  expanded,
  expandedSignals,
  onToggleMsg,
  onToggleSignal,
  threshold,
  formatTs,
  formatVal,
}: MessageNodeProps) {
  const idHex = msg.is_extended
    ? `0x${msg.message_id.toString(16).toUpperCase().padStart(8, '0')}`
    : `0x${msg.message_id.toString(16).toUpperCase().padStart(3, '0')}`;

  const statusTag = msg.only_in_base
    ? <span className="tag tag-yellow">仅基准</span>
    : msg.only_in_compare
    ? <span className="tag" style={{ backgroundColor: '#569cd6' }}>仅对比</span>
    : null;

  const hasOverThreshold = msg.signal_diffs.some(s => s.over_threshold_ratio > 0);

  return (
    <div className="compare-msg-node">
      <div className="compare-msg-header" onClick={onToggleMsg}>
        <span className="compare-msg-arrow">{expanded ? '▼' : '▶'}</span>
        <span className="compare-msg-id">{idHex}</span>
        {msg.message_name && <span className="compare-msg-name">{msg.message_name}</span>}
        {statusTag}
        {hasOverThreshold && <span className="tag tag-red">超阈值</span>}
        {!msg.only_in_base && !msg.only_in_compare && (
          <span className="compare-msg-meta">
            配对 {msg.matched_frame_count}/{msg.base_frame_count}
            {msg.no_match_count > 0 && <span style={{ color: '#ce9178' }}> | 未匹配 {msg.no_match_count}</span>}
          </span>
        )}
      </div>

      {expanded && (
        <div className="compare-msg-body">
          {msg.only_in_base && <div className="compare-empty">该ID仅存在于基准文件中</div>}
          {msg.only_in_compare && <div className="compare-empty">该ID仅存在于对比文件中</div>}

          {msg.has_dbc && msg.signal_diffs.map((sig) => (
            <SignalRow
              key={`${msg.message_id}_${sig.signal_name}`}
              msgId={msg.message_id}
              sig={sig}
              expanded={expandedSignals.has(`${msg.message_id}_${sig.signal_name}`)}
              onToggle={() => onToggleSignal(`${msg.message_id}_${sig.signal_name}`)}
              threshold={threshold}
              formatTs={formatTs}
              formatVal={formatVal}
            />
          ))}

          {!msg.has_dbc && msg.byte_diffs.length > 0 && (
            <div className="compare-byte-section">
              <div className="compare-byte-title">原始字节级差异（无DBC定义）</div>
              <table className="compare-byte-table">
                <thead>
                  <tr>
                    <th>字节</th>
                    <th>差异数</th>
                    <th>总配对数</th>
                    <th>差异率</th>
                  </tr>
                </thead>
                <tbody>
                  {msg.byte_diffs.map((bd) => (
                    <tr key={bd.byte_index}>
                      <td>B{bd.byte_index}</td>
                      <td>{bd.diff_count}</td>
                      <td>{bd.total_matched}</td>
                      <td style={{ color: bd.diff_ratio > 0.5 ? '#ce9178' : '#dcdcaa' }}>
                        {(bd.diff_ratio * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!msg.has_dbc && msg.byte_diffs.length === 0 && !msg.only_in_base && !msg.only_in_compare && (
            <div className="compare-empty">该报文无DBC定义且字节级完全一致</div>
          )}
        </div>
      )}
    </div>
  );
}

interface SignalRowProps {
  msgId: number;
  sig: SignalDiffSummary;
  expanded: boolean;
  onToggle: () => void;
  threshold: number;
  formatTs: (us: number) => string;
  formatVal: (v: number) => string;
}

function SignalRow({ sig, expanded, onToggle, threshold, formatTs, formatVal }: SignalRowProps) {
  const isOverThreshold = sig.over_threshold_ratio > 0;

  const chartData = useMemo(() => {
    return sig.diff_entries.map((e) => ({
      time: e.base_timestamp / 1_000_000,
      diff: e.diff,
    }));
  }, [sig.diff_entries]);

  const top10 = useMemo(() => {
    return [...sig.diff_entries]
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 10);
  }, [sig.diff_entries]);

  return (
    <div className="compare-signal-row">
      <div className="compare-signal-header" onClick={onToggle}>
        <span className="compare-msg-arrow">{expanded ? '▼' : '▶'}</span>
        <span className="compare-signal-name">{sig.signal_name}</span>
        <span className="compare-signal-unit">{sig.unit}</span>
        {isOverThreshold && <span className="tag tag-red">超阈值</span>}
      </div>

      <div className="compare-signal-stats">
        <div className="compare-stat-item">
          <span className="compare-stat-label">最大差值</span>
          <span className="compare-stat-value" style={{ color: isOverThreshold ? '#ce9178' : '#dcdcaa' }}>
            {formatVal(sig.max_diff)}
          </span>
        </div>
        <div className="compare-stat-item">
          <span className="compare-stat-label">平均差值</span>
          <span className="compare-stat-value">{formatVal(sig.avg_diff)}</span>
        </div>
        <div className="compare-stat-item">
          <span className="compare-stat-label">标准差</span>
          <span className="compare-stat-value">{formatVal(sig.std_diff)}</span>
        </div>
        <div className="compare-stat-item">
          <span className="compare-stat-label">超阈值占比</span>
          <span className="compare-stat-value" style={{ color: sig.over_threshold_ratio > 0 ? '#ce9178' : '#4ec9b0' }}>
            {(sig.over_threshold_ratio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="compare-stat-item">
          <span className="compare-stat-label">配对/未匹配</span>
          <span className="compare-stat-value">{sig.matched_count}/{sig.no_match_count}</span>
        </div>
      </div>

      {expanded && (
        <div className="compare-signal-detail">
          {chartData.length > 0 ? (
            <div className="compare-chart-container">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="time"
                    type="number"
                    tick={{ fontSize: 10, fill: '#888' }}
                    tickFormatter={(v: number) => `${v.toFixed(1)}s`}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#888' }}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#2d2d30', border: '1px solid #444', fontSize: 11 }}
                    labelFormatter={(v: number) => `时间: ${v.toFixed(6)}s`}
                    formatter={(value: number) => [value.toFixed(4), '差值']}
                  />
                  <Line
                    type="monotone"
                    dataKey="diff"
                    stroke={isOverThreshold ? '#ce9178' : '#4ec9b0'}
                    dot={false}
                    strokeWidth={1.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="compare-empty">无配对数据</div>
          )}

          {top10.length > 0 && (
            <div className="compare-top-table">
              <div className="compare-top-title">差值最大的前10帧</div>
              <table className="compare-detail-table">
                <thead>
                  <tr>
                    <th>基准时间</th>
                    <th>基准值</th>
                    <th>对比值</th>
                    <th>差值</th>
                    <th>差值%</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((entry, i) => (
                    <tr key={i}>
                      <td>{formatTs(entry.base_timestamp)}</td>
                      <td>{formatVal(entry.base_value)}</td>
                      <td>{formatVal(entry.compare_value)}</td>
                      <td style={{ color: Math.abs(entry.diff) > sig.signal_range * (threshold / 100) ? '#ce9178' : '#dcdcaa' }}>
                        {formatVal(entry.diff)}
                      </td>
                      <td>{entry.diff_percent.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
