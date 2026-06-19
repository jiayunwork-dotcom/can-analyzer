import { useState } from 'react';
import { useAppStore } from '../store';
import { canApi } from '../api';
import { parseDataString, formatData } from '../utils';

export default function SendPanel() {
  const [tab, setTab] = useState<'raw' | 'signal'>('raw');
  const [collapsed, setCollapsed] = useState(false);

  const [id, setId] = useState('0x100');
  const [isExt, setIsExt] = useState(false);
  const [dataStr, setDataStr] = useState('00 00 00 00 00 00 00 00');
  const [periodic, setPeriodic] = useState(false);
  const [periodMs, setPeriodMs] = useState(100);
  const [periodicKey, setPeriodicKey] = useState<string | null>(null);

  const [selectedMsgId, setSelectedMsgId] = useState<number | null>(null);
  const [signalValues, setSignalValues] = useState<Record<string, number>>({});

  const dbc = useAppStore((s) => s.dbc);
  const selectedMsg = dbc?.messages.find((m) => m.id === selectedMsgId);

  const parseId = () => parseInt(id.replace('0x', ''), 16) || 0;

  const handleSendOnce = async () => {
    const parsedId = parseId();
    const data = parseDataString(dataStr);
    const padded = [...data];
    while (padded.length < 8) padded.push(0);
    await canApi.sendFrame(parsedId, isExt, padded.slice(0, 8));
  };

  const handleTogglePeriodic = async () => {
    if (periodicKey) {
      await canApi.stopPeriodicSend(periodicKey);
      setPeriodicKey(null);
    } else {
      const parsedId = parseId();
      const data = parseDataString(dataStr);
      const padded = [...data];
      while (padded.length < 8) padded.push(0);
      const key = await canApi.startPeriodicSend(parsedId, isExt, padded.slice(0, 8), periodMs);
      setPeriodicKey(key);
    }
  };

  const handleSignalSend = async () => {
    if (!selectedMsgId) return;
    try {
      const data = await canApi.encodeSignalValues(selectedMsgId, signalValues);
      const msg = dbc?.messages.find((m) => m.id === selectedMsgId);
      await canApi.sendFrame(selectedMsgId, msg?.is_extended || false, data);
    } catch (e) {
      console.error('Encode failed:', e);
    }
  };

  const handleSignalPeriodic = async () => {
    if (!selectedMsgId) return;
    if (periodicKey) {
      await canApi.stopPeriodicSend(periodicKey);
      setPeriodicKey(null);
    } else {
      try {
        const data = await canApi.encodeSignalValues(selectedMsgId, signalValues);
        const msg = dbc?.messages.find((m) => m.id === selectedMsgId);
        const key = await canApi.startPeriodicSend(selectedMsgId, msg?.is_extended || false, data, periodMs);
        setPeriodicKey(key);
      } catch (e) {
        console.error('Encode failed:', e);
      }
    }
  };

  return (
    <div className="panel-section">
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>报文发送</span>
        {periodicKey && <span className="tag tag-green">周期发送中</span>}
      </div>
      {!collapsed && (
        <div className="panel-section-body">
          <div className="tab-bar">
            <div className={`tab-item ${tab === 'raw' ? 'active' : ''}`} onClick={() => setTab('raw')}>
              原始数据
            </div>
            <div className={`tab-item ${tab === 'signal' ? 'active' : ''}`} onClick={() => setTab('signal')}>
              信号编辑
            </div>
          </div>

          <div style={{ padding: '12px 0' }}>
            {tab === 'raw' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>ID (Hex)</label>
                    <input type="text" value={id} onChange={(e) => setId(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>帧类型</label>
                    <select value={isExt ? 'ext' : 'std'} onChange={(e) => setIsExt(e.target.value === 'ext')}>
                      <option value="std">标准帧</option>
                      <option value="ext">扩展帧</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>数据字节 (Hex 空格分隔)</label>
                  <input type="text" value={dataStr} onChange={(e) => setDataStr(e.target.value)} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox">
                      <input type="checkbox" checked={periodic} onChange={(e) => setPeriodic(e.target.checked)} />
                      周期发送
                    </label>
                  </div>
                  {periodic && (
                    <div className="form-group">
                      <label>周期 (ms)</label>
                      <input
                        type="number"
                        min="10"
                        value={periodMs}
                        onChange={(e) => setPeriodMs(parseInt(e.target.value) || 100)}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSendOnce}>
                    发送一次
                  </button>
                  {periodic && (
                    <button
                      className={`btn ${periodicKey ? 'btn-danger' : 'btn-success'}`}
                      style={{ flex: 1 }}
                      onClick={handleTogglePeriodic}
                    >
                      {periodicKey ? '停止周期' : '开始周期'}
                    </button>
                  )}
                </div>
              </>
            )}

            {tab === 'signal' && (
              <>
                {!dbc ? (
                  <div className="empty-state">请先加载 DBC 文件</div>
                ) : (
                  <>
                    <div className="form-group">
                      <label>选择报文</label>
                      <select
                        value={selectedMsgId ?? ''}
                        onChange={(e) => {
                          const id = parseInt(e.target.value);
                          setSelectedMsgId(isNaN(id) ? null : id);
                          setSignalValues({});
                        }}
                      >
                        <option value="">-- 选择 --</option>
                        {dbc.messages.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (0x{m.id.toString(16).toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedMsg && (
                      <>
                        {selectedMsg.signals.map((sig) => (
                          <div className="form-group" key={sig.name}>
                            <label>
                              {sig.name} [{sig.min_value}~{sig.max_value}] {sig.unit}
                            </label>
                            <input
                              type="number"
                              step={sig.factor < 1 ? sig.factor : 1}
                              value={signalValues[sig.name] ?? sig.offset}
                              onChange={(e) =>
                                setSignalValues({ ...signalValues, [sig.name]: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                        ))}

                        <div className="form-row">
                          <div className="form-group">
                            <label className="checkbox">
                              <input type="checkbox" checked={periodic} onChange={(e) => setPeriodic(e.target.checked)} />
                              周期发送
                            </label>
                          </div>
                          {periodic && (
                            <div className="form-group">
                              <label>周期 (ms)</label>
                              <input
                                type="number"
                                min="10"
                                value={periodMs}
                                onChange={(e) => setPeriodMs(parseInt(e.target.value) || 100)}
                              />
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSignalSend}>
                            发送一次
                          </button>
                          {periodic && (
                            <button
                              className={`btn ${periodicKey ? 'btn-danger' : 'btn-success'}`}
                              style={{ flex: 1 }}
                              onClick={handleSignalPeriodic}
                            >
                              {periodicKey ? '停止周期' : '开始周期'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
