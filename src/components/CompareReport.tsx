import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type {
  CompareResult,
  BatchCompareResult,
  MessageCompareResult,
  SignalDiffSummary,
  SignalTrendInfo,
  TrendDirection,
} from '../types';

const CHART_COLORS = [
  '#4ec9b0',
  '#ce9178',
  '#569cd6',
  '#c586c0',
  '#dcdcaa',
  '#9cdcfe',
  '#ff6b6b',
  '#88cc88',
];

interface Props {
  result?: CompareResult;
  batchResult?: BatchCompareResult;
  threshold: number;
  onClose: () => void;
}

export default function CompareReport({ result, batchResult, threshold, onClose }: Props) {
  const [expandedMsgIds, setExpandedMsgIds] = useState<Set<number>>(new Set());
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());

  const isBatch = !!batchResult;
  const compareResults = batchResult?.compare_results || (result ? [result] : []);
  const trendsMap = useMemo(() => {
    const map = new Map<string, SignalTrendInfo>();
    if (batchResult) {
      for (const t of batchResult.trends) {
        map.set(`${t.message_id}_${t.signal_name}`, t);
      }
    }
    return map;
  }, [batchResult]);

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

  const mergedMessages = useMemo(() => {
    if (!isBatch) return null;
    const msgMap = new Map<number, MessageCompareResult[]>();
    for (const r of compareResults) {
      for (const m of r.messages) {
        const arr = msgMap.get(m.message_id) || [];
        arr.push(m);
        msgMap.set(m.message_id, arr);
      }
    }
    const sortedKeys = Array.from(msgMap.keys()).sort((a, b) => a - b);
    return sortedKeys.map((id) => ({
      message_id: id,
      messages: msgMap.get(id)!,
    }));
  }, [compareResults, isBatch]);

  return (
    <div className="compare-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compare-header">
          <h2>{isBatch ? '批量报文比较报告' : '报文比较报告'}</h2>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        {isBatch && batchResult ? (
          <>
            <BatchSummaryHeader
              batchResult={batchResult}
              formatSpan={formatSpan}
            />
            <div className="compare-body">
              {mergedMessages?.map(({ message_id, messages }) => (
                <BatchMessageNode
                  key={message_id}
                  messageId={message_id}
                  messages={messages}
                  compareResults={compareResults}
                  expanded={expandedMsgIds.has(message_id)}
                  expandedSignals={expandedSignals}
                  onToggleMsg={() => toggleMsg(message_id)}
                  onToggleSignal={toggleSignal}
                  threshold={threshold}
                  trendsMap={trendsMap}
                  formatSpan={formatSpan}
                  formatTs={formatTs}
                  formatVal={formatVal}
                />
              ))}
            </div>
          </>
        ) : result ? (
          <>
            <SingleSummaryHeader result={result} formatSpan={formatSpan} />
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
                  formatTs={formatTs}
                  formatVal={formatVal}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SingleSummaryHeader({
  result,
  formatSpan,
}: {
  result: CompareResult;
  formatSpan: (us: number) => string;
}) {
  return (
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
        <div
          className="compare-summary-value"
          style={{
            color:
              result.frame_count_diff > 0
                ? '#ce9178'
                : result.frame_count_diff < 0
                ? '#4ec9b0'
                : '#dcdcaa',
          }}
        >
          {result.frame_count_diff > 0 ? '+' : ''}
          {result.frame_count_diff}
        </div>
      </div>
      <div className="compare-summary-card">
        <div className="compare-summary-label">时间跨度差异</div>
        <div className="compare-summary-value">
          {result.time_span_diff_us > 0 ? '+' : ''}
          {formatSpan(Math.abs(result.time_span_diff_us))}
        </div>
      </div>
      <div className="compare-summary-card">
        <div className="compare-summary-label">共有ID</div>
        <div className="compare-summary-value" style={{ color: '#4ec9b0' }}>
          {result.common_id_count}
        </div>
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
  );
}

function BatchSummaryHeader({
  batchResult,
  formatSpan,
}: {
  batchResult: BatchCompareResult;
  formatSpan: (us: number) => string;
}) {
  return (
    <div className="compare-summary" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
      <div className="compare-summary-card" style={{ border: '2px solid #0e7a40' }}>
        <div className="compare-summary-label">基准文件</div>
        <div className="compare-summary-value">{batchResult.base_file.file_name}</div>
        <div className="compare-summary-meta">
          {batchResult.base_file.total_frames} 帧 | {formatSpan(batchResult.base_file.time_span_us)}
        </div>
      </div>
      {batchResult.compare_results.map((r, i) => (
        <div key={i} className="compare-summary-card">
          <div className="compare-summary-label">对比 #{i + 1}</div>
          <div className="compare-summary-value">{r.compare_file.file_name}</div>
          <div className="compare-summary-meta">
            {r.compare_file.total_frames} 帧 | {formatSpan(r.compare_file.time_span_us)}
          </div>
        </div>
      ))}
      {batchResult.failed_files.length > 0 &&
        batchResult.failed_files.map((f, i) => (
          <div
            key={`fail_${i}`}
            className="compare-summary-card"
            style={{ border: '2px solid #a1260d', backgroundColor: '#3a1a1a' }}
          >
            <div className="compare-summary-label" style={{ color: '#ff6b6b' }}>
              解析失败 #{batchResult.compare_results.length + i + 1}
            </div>
            <div className="compare-summary-value" style={{ color: '#ff6b6b' }}>
              {f.file_name}
            </div>
            <div className="compare-summary-meta" style={{ color: '#ce9178' }}>
              {f.error_message}
            </div>
          </div>
        ))}
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

  const statusTag = msg.only_in_base ? (
    <span className="tag tag-yellow">仅基准</span>
  ) : msg.only_in_compare ? (
    <span className="tag" style={{ backgroundColor: '#569cd6' }}>
      仅对比
    </span>
  ) : null;

  const hasOverThreshold = msg.signal_diffs.some((s) => s.over_threshold_ratio > 0);

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
            {msg.no_match_count > 0 && (
              <span style={{ color: '#ce9178' }}> | 未匹配 {msg.no_match_count}</span>
            )}
          </span>
        )}
      </div>

      {expanded && (
        <div className="compare-msg-body">
          {msg.only_in_base && <div className="compare-empty">该ID仅存在于基准文件中</div>}
          {msg.only_in_compare && <div className="compare-empty">该ID仅存在于对比文件中</div>}

          {msg.has_dbc &&
            msg.signal_diffs.map((sig) => (
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

          {!msg.has_dbc &&
            msg.byte_diffs.length === 0 &&
            !msg.only_in_base &&
            !msg.only_in_compare && (
              <div className="compare-empty">该报文无DBC定义且字节级完全一致</div>
            )}
        </div>
      )}
    </div>
  );
}

interface BatchMessageNodeProps {
  messageId: number;
  messages: MessageCompareResult[];
  compareResults: CompareResult[];
  expanded: boolean;
  expandedSignals: Set<string>;
  onToggleMsg: () => void;
  onToggleSignal: (key: string) => void;
  threshold: number;
  trendsMap: Map<string, SignalTrendInfo>;
  formatSpan: (us: number) => string;
  formatTs: (us: number) => string;
  formatVal: (v: number) => string;
}

function BatchMessageNode({
  messageId,
  messages,
  compareResults,
  expanded,
  expandedSignals,
  onToggleMsg,
  onToggleSignal,
  threshold,
  trendsMap,
  formatTs,
  formatVal,
}: BatchMessageNodeProps) {
  const firstMsg = messages[0];
  const idHex = firstMsg.is_extended
    ? `0x${messageId.toString(16).toUpperCase().padStart(8, '0')}`
    : `0x${messageId.toString(16).toUpperCase().padStart(3, '0')}`;

  const onlyInBaseCount = messages.filter((m) => m.only_in_base).length;
  const onlyInCompareCount = messages.filter((m) => m.only_in_compare).length;
  const hasOverThreshold = messages.some((m) =>
    m.signal_diffs.some((s) => s.over_threshold_ratio > 0)
  );

  const signalNamesSet = new Set<string>();
  for (const m of messages) {
    for (const s of m.signal_diffs) {
      signalNamesSet.add(s.signal_name);
    }
  }
  const signalNames = Array.from(signalNamesSet);

  return (
    <div className="compare-msg-node">
      <div className="compare-msg-header" onClick={onToggleMsg}>
        <span className="compare-msg-arrow">{expanded ? '▼' : '▶'}</span>
        <span className="compare-msg-id">{idHex}</span>
        {firstMsg.message_name && <span className="compare-msg-name">{firstMsg.message_name}</span>}
        {onlyInBaseCount > 0 && (
          <span className="tag tag-yellow">仅基准 {onlyInBaseCount}</span>
        )}
        {onlyInCompareCount > 0 && (
          <span className="tag" style={{ backgroundColor: '#569cd6' }}>
            仅对比 {onlyInCompareCount}
          </span>
        )}
        {hasOverThreshold && <span className="tag tag-red">超阈值</span>}
        <span className="compare-msg-meta">{messages.length} 份对比结果</span>
      </div>

      {expanded && (
        <div className="compare-msg-body">
          {firstMsg.has_dbc && signalNames.length > 0 ? (
            signalNames.map((sigName) => {
              const sigsPerFile: SignalDiffSummary[] = [];
              for (const r of compareResults) {
                const found = r.messages
                  .find((m) => m.message_id === messageId)
                  ?.signal_diffs.find((s) => s.signal_name === sigName);
                sigsPerFile.push(found || (null as unknown as SignalDiffSummary));
              }
              return (
                <BatchSignalRow
                  key={`${messageId}_${sigName}`}
                  msgId={messageId}
                  signalName={sigName}
                  sigsPerFile={sigsPerFile}
                  compareResults={compareResults}
                  expanded={expandedSignals.has(`${messageId}_${sigName}`)}
                  onToggle={() => onToggleSignal(`${messageId}_${sigName}`)}
                  threshold={threshold}
                  trend={trendsMap.get(`${messageId}_${sigName}`)}
                  formatTs={formatTs}
                  formatVal={formatVal}
                />
              );
            })
          ) : (
            <div className="compare-empty">该报文无DBC定义或无信号数据</div>
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
          <span
            className="compare-stat-value"
            style={{ color: isOverThreshold ? '#ce9178' : '#dcdcaa' }}
          >
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
          <span
            className="compare-stat-value"
            style={{ color: sig.over_threshold_ratio > 0 ? '#ce9178' : '#4ec9b0' }}
          >
            {(sig.over_threshold_ratio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="compare-stat-item">
          <span className="compare-stat-label">配对/未匹配</span>
          <span className="compare-stat-value">
            {sig.matched_count}/{sig.no_match_count}
          </span>
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
                    contentStyle={{
                      backgroundColor: '#2d2d30',
                      border: '1px solid #444',
                      fontSize: 11,
                    }}
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
                      <td
                        style={{
                          color:
                            Math.abs(entry.diff) > sig.signal_range * (threshold / 100)
                              ? '#ce9178'
                              : '#dcdcaa',
                        }}
                      >
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

function TrendIndicator({ trend, formatVal }: { trend?: SignalTrendInfo; formatVal: (v: number) => string }) {
  if (!trend) return null;

  const { direction, slope, r_squared } = trend.trend;

  if (direction === 'insufficient_data' as TrendDirection) {
    return (
      <span style={{ color: '#888', fontSize: 12 }}>
        — 数据不足
      </span>
    );
  }

  if (direction === 'improving') {
    return (
      <span style={{ color: '#4ec9b0', fontSize: 12, fontWeight: 600 }}>
        ↓ 持续改善
        <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>
          k={formatVal(slope)} R²={r_squared.toFixed(2)}
        </span>
      </span>
    );
  }

  if (direction === 'worsening') {
    return (
      <span style={{ color: '#ce9178', fontSize: 12, fontWeight: 600 }}>
        ↑ 持续恶化
        <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>
          k={formatVal(slope)} R²={r_squared.toFixed(2)}
        </span>
      </span>
    );
  }

  return (
    <span style={{ color: '#888', fontSize: 12 }}>
      — 波动
      <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>
        R²={r_squared.toFixed(2)}
      </span>
    </span>
  );
}

interface BatchSignalRowProps {
  msgId: number;
  signalName: string;
  sigsPerFile: SignalDiffSummary[];
  compareResults: CompareResult[];
  expanded: boolean;
  onToggle: () => void;
  threshold: number;
  trend?: SignalTrendInfo;
  formatTs: (us: number) => string;
  formatVal: (v: number) => string;
}

function BatchSignalRow({
  signalName,
  sigsPerFile,
  compareResults,
  expanded,
  onToggle,
  threshold,
  trend,
  formatTs,
  formatVal,
}: BatchSignalRowProps) {
  const firstSig = sigsPerFile.find((s) => s !== null);
  const unit = firstSig?.unit || '';
  const signalRange = firstSig?.signal_range || 0;

  const hasOverThreshold = sigsPerFile.some((s) => s && s.over_threshold_ratio > 0);

  const multiChartData = useMemo(() => {
    const timeMap = new Map<number, Record<string, number>>();
    for (let i = 0; i < sigsPerFile.length; i++) {
      const sig = sigsPerFile[i];
      if (!sig) continue;
      const fileLabel = `对比#${i + 1}`;
      for (const e of sig.diff_entries) {
        const t = +(e.base_timestamp / 1_000_000).toFixed(6);
        const row = timeMap.get(t) || { time: t };
        row[fileLabel] = e.diff;
        timeMap.set(t, row);
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  }, [sigsPerFile]);

  const hasData = sigsPerFile.some((s) => s && s.diff_entries.length > 0);

  return (
    <div className="compare-signal-row">
      <div className="compare-signal-header" onClick={onToggle}>
        <span className="compare-msg-arrow">{expanded ? '▼' : '▶'}</span>
        <span className="compare-signal-name">{signalName}</span>
        <span className="compare-signal-unit">{unit}</span>
        {hasOverThreshold && <span className="tag tag-red">超阈值</span>}
      </div>

      <div className="compare-signal-stats" style={{ display: 'block' }}>
        <table className="compare-detail-table" style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th>指标</th>
              {compareResults.map((_, i) => (
                <th key={i}>对比#{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>最大差值</td>
              {sigsPerFile.map((s, i) => (
                <td
                  key={i}
                  style={{
                    color: s && s.over_threshold_ratio > 0 ? '#ce9178' : '#dcdcaa',
                  }}
                >
                  {s ? formatVal(s.max_diff) : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <td>平均差值</td>
              {sigsPerFile.map((s, i) => (
                <td key={i}>{s ? formatVal(s.avg_diff) : '-'}</td>
              ))}
            </tr>
            <tr>
              <td>标准差</td>
              {sigsPerFile.map((s, i) => (
                <td key={i}>{s ? formatVal(s.std_diff) : '-'}</td>
              ))}
            </tr>
            <tr>
              <td>超阈值占比</td>
              {sigsPerFile.map((s, i) => (
                <td
                  key={i}
                  style={{
                    color: s && s.over_threshold_ratio > 0 ? '#ce9178' : '#4ec9b0',
                  }}
                >
                  {s ? `${(s.over_threshold_ratio * 100).toFixed(1)}%` : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <td>配对/未匹配</td>
              {sigsPerFile.map((s, i) => (
                <td key={i}>
                  {s ? `${s.matched_count}/${s.no_match_count}` : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>趋势判定</td>
              <td colSpan={sigsPerFile.length} style={{ textAlign: 'left', paddingLeft: 12 }}>
                <TrendIndicator trend={trend} formatVal={formatVal} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {expanded && (
        <div className="compare-signal-detail">
          {hasData ? (
            <div className="compare-chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={multiChartData}>
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
                    contentStyle={{
                      backgroundColor: '#2d2d30',
                      border: '1px solid #444',
                      fontSize: 11,
                    }}
                    labelFormatter={(v: number) => `时间: ${v.toFixed(6)}s`}
                    formatter={(value: number, name: string) => [value.toFixed(4), name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string) => (
                      <span style={{ color: '#ccc' }}>{value}</span>
                    )}
                  />
                  {sigsPerFile.map((s, i) =>
                    s ? (
                      <Line
                        key={i}
                        type="monotone"
                        dataKey={`对比#${i + 1}`}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        dot={false}
                        strokeWidth={1.5}
                        name={compareResults[i]?.compare_file.file_name || `对比#${i + 1}`}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="compare-empty">无配对数据</div>
          )}
        </div>
      )}
    </div>
  );
}
