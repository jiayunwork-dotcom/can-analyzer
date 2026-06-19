import { useState } from 'react';
import { useAppStore } from '../store';
import { canApi } from '../api';
import type { SimMessageConfig, DataGenMode } from '../types';

function createDefaultConfig(id?: number): SimMessageConfig {
  return {
    id: id ?? 0x100,
    is_extended: false,
    period_ms: 100,
    dlc: 8,
    mode: 'counter',
    fixed_data: [0, 0, 0, 0, 0, 0, 0, 0],
    counter_min: 0,
    counter_max: 255,
    sine_amplitude: 100,
    sine_offset: 127,
    sine_period_ms: 1000,
    byte_start: 0,
    byte_count: 2,
    enabled: true,
  };
}

export default function SimulatorPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const simConfigs = useAppStore((s) => s.simConfigs);
  const setSimConfigs = useAppStore((s) => s.setSimConfigs);
  const simRunning = useAppStore((s) => s.simRunning);
  const [errorRate, setErrorRate] = useState(0);

  const updateConfigs = async (configs: SimMessageConfig[]) => {
    setSimConfigs(configs);
    await canApi.setSimulatorConfigs(configs);
  };

  const addConfig = () => {
    if (simConfigs.length >= 20) return;
    const nextId = simConfigs.length > 0
      ? Math.max(...simConfigs.map((c) => c.id)) + 1
      : 0x100;
    updateConfigs([...simConfigs, createDefaultConfig(nextId)]);
  };

  const removeConfig = (idx: number) => {
    updateConfigs(simConfigs.filter((_, i) => i !== idx));
  };

  const updateConfig = (idx: number, patch: Partial<SimMessageConfig>) => {
    updateConfigs(simConfigs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const handleErrorRateChange = async (v: number) => {
    setErrorRate(v);
    await canApi.setErrorRate(v);
  };

  return (
    <div className="panel-section">
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>模拟器配置</span>
        <span>{simConfigs.length}/20</span>
      </div>
      {!collapsed && (
        <div className="panel-section-body">
          <div className="form-group">
            <label>错误帧概率 (0-0.1)</label>
            <input
              type="number"
              min="0"
              max="0.1"
              step="0.001"
              value={errorRate}
              disabled={simRunning}
              onChange={(e) => handleErrorRateChange(parseFloat(e.target.value) || 0)}
            />
          </div>

          <button
            className="btn btn-primary btn-sm"
            style={{ marginBottom: 10, width: '100%' }}
            onClick={addConfig}
            disabled={simConfigs.length >= 20 || simRunning}
          >
            + 添加报文配置
          </button>

          <div className="sim-config-list">
            {simConfigs.map((cfg, idx) => (
              <div key={idx} className="sim-config-item">
                <div className="sim-config-item-header">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      disabled={simRunning}
                      onChange={(e) => updateConfig(idx, { enabled: e.target.checked })}
                    />
                    启用
                  </label>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => removeConfig(idx)}
                    disabled={simRunning}
                  >
                    删除
                  </button>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>ID (Hex)</label>
                    <input
                      type="text"
                      value={'0x' + cfg.id.toString(16).toUpperCase()}
                      disabled={simRunning}
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace('0x', ''), 16);
                        if (!isNaN(val)) updateConfig(idx, { id: val });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>帧类型</label>
                    <select
                      value={cfg.is_extended ? 'ext' : 'std'}
                      disabled={simRunning}
                      onChange={(e) => updateConfig(idx, { is_extended: e.target.value === 'ext' })}
                    >
                      <option value="std">标准帧(11位)</option>
                      <option value="ext">扩展帧(29位)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>周期 (ms)</label>
                    <input
                      type="number"
                      min="10"
                      max="5000"
                      value={cfg.period_ms}
                      disabled={simRunning}
                      onChange={(e) =>
                        updateConfig(idx, { period_ms: parseInt(e.target.value) || 100 })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>DLC</label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={cfg.dlc}
                      disabled={simRunning}
                      onChange={(e) =>
                        updateConfig(idx, { dlc: Math.max(1, Math.min(8, parseInt(e.target.value) || 8)) })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>数据生成模式</label>
                  <select
                    value={cfg.mode}
                    disabled={simRunning}
                    onChange={(e) => updateConfig(idx, { mode: e.target.value as DataGenMode })}
                  >
                    <option value="fixed">固定值</option>
                    <option value="counter">递增计数器</option>
                    <option value="random">随机值</option>
                    <option value="sine">正弦波</option>
                  </select>
                </div>

                {cfg.mode === 'fixed' && (
                  <div className="form-group">
                    <label>数据字节 (空格分隔 Hex)</label>
                    <input
                      type="text"
                      value={cfg.fixed_data.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}
                      disabled={simRunning}
                      onChange={(e) => {
                        const bytes = e.target.value
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((b) => parseInt(b, 16))
                          .filter((n) => !isNaN(n) && n >= 0 && n <= 255);
                        while (bytes.length < 8) bytes.push(0);
                        updateConfig(idx, { fixed_data: bytes.slice(0, 8) });
                      }}
                    />
                  </div>
                )}

                {cfg.mode === 'counter' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>起始字节</label>
                      <input
                        type="number"
                        min="0"
                        max="7"
                        value={cfg.byte_start}
                        disabled={simRunning}
                        onChange={(e) => updateConfig(idx, { byte_start: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group">
                      <label>字节数</label>
                      <input
                        type="number"
                        min="1"
                        max="4"
                        value={cfg.byte_count}
                        disabled={simRunning}
                        onChange={(e) =>
                          updateConfig(idx, { byte_count: Math.max(1, Math.min(4, parseInt(e.target.value) || 2)) })
                        }
                      />
                    </div>
                  </div>
                )}

                {cfg.mode === 'sine' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>振幅</label>
                        <input
                          type="number"
                          value={cfg.sine_amplitude}
                          disabled={simRunning}
                          onChange={(e) => updateConfig(idx, { sine_amplitude: parseInt(e.target.value) || 100 })}
                        />
                      </div>
                      <div className="form-group">
                        <label>偏移</label>
                        <input
                          type="number"
                          value={cfg.sine_offset}
                          disabled={simRunning}
                          onChange={(e) => updateConfig(idx, { sine_offset: parseInt(e.target.value) || 127 })}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>正弦周期(ms)</label>
                        <input
                          type="number"
                          min="100"
                          value={cfg.sine_period_ms}
                          disabled={simRunning}
                          onChange={(e) =>
                            updateConfig(idx, { sine_period_ms: parseInt(e.target.value) || 1000 })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>起始字节</label>
                        <input
                          type="number"
                          min="0"
                          max="6"
                          value={cfg.byte_start}
                          disabled={simRunning}
                          onChange={(e) => updateConfig(idx, { byte_start: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
