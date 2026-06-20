import { useAppStore } from '../store';
import type { DecodedSignal, DbcSignal } from '../types';

export default function SignalPanel() {
  const selectedFrameId = useAppStore((s) => s.selectedFrameId);
  const frames = useAppStore((s) => s.frames);
  const decodedSignals = useAppStore((s) => s.decodedSignals);
  const dbc = useAppStore((s) => s.dbc);
  const addTraceSignal = useAppStore((s) => s.addTraceSignal);
  const removeTraceSignal = useAppStore((s) => s.removeTraceSignal);
  const traceSignals = useAppStore((s) => s.traceSignals);

  if (!selectedFrameId) {
    return null;
  }

  const frame = frames[selectedFrameId];
  if (!frame) return null;

  const msg = dbc?.messages.find((m) => m.id === frame.id);
  const signals: DecodedSignal[] = decodedSignals[frame.id] || [];

  const isTraced = (sigName: string) =>
    traceSignals.some((t) => t.message_id === frame.id && t.signal_name === sigName);

  const getDbcSignal = (sigName: string): DbcSignal | undefined =>
    msg?.signals.find((s) => s.name === sigName);

  const isOutOfRange = (sig: DecodedSignal): boolean => {
    const dbcSig = getDbcSignal(sig.name);
    if (!dbcSig) return false;
    return sig.physical_value < dbcSig.min_value || sig.physical_value > dbcSig.max_value;
  };

  return (
    <div className="signal-panel">
      <div className="signal-panel-header">
        <span>
          信号解码 - {msg?.name || `0x${frame.id.toString(16).toUpperCase()}`}
          {msg?.sender && ` (${msg.sender})`}
        </span>
        <span style={{ fontSize: 11, color: '#888' }}>
          点击信号可添加到图表追踪
        </span>
      </div>

      {!msg && (
        <div className="empty-state">该报文 ID 在 DBC 中无定义</div>
      )}

      {msg && signals.length === 0 && (
        <div className="empty-state">等待报文数据...</div>
      )}

      <div className="signal-list">
        {signals.map((sig) => {
          const traced = isTraced(sig.name);
          const outOfRange = isOutOfRange(sig);
          const dbcSig = getDbcSignal(sig.name);
          return (
            <div
              key={sig.name}
              className={`signal-item ${outOfRange ? 'signal-item-alarm' : ''}`}
              onClick={() => traced ? removeTraceSignal(frame.id, sig.name) : addTraceSignal(frame.id, sig.name)}
              style={{ cursor: 'pointer', opacity: traced ? 1 : 0.85 }}
              title={traced ? '点击从图表移除' : '点击添加到图表追踪'}
            >
              <div className="signal-name">
                {sig.name}
                {outOfRange && (
                  <span className="signal-alarm-icon" title={`超出范围 [${dbcSig?.min_value}, ${dbcSig?.max_value}]`}>
                    ⚠
                  </span>
                )}
              </div>
              <div className={`signal-value ${outOfRange ? 'signal-value-alarm' : ''}`}>
                {sig.enum_label ?? formatNumber(sig.physical_value)}
                {!sig.enum_label && sig.unit && <span className="signal-unit">{sig.unit}</span>}
              </div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                Raw: {sig.raw_value}
                {traced && <span className="tag tag-green" style={{ float: 'right' }}>追踪中</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(3);
}
