import { useState } from 'react';
import { useAppStore } from '../store';
import type { FilterRule, FilterMode } from '../types';

export default function FilterPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const dbc = useAppStore((s) => s.dbc);

  const addFilter = () => {
    const newRule: FilterRule = {
      id: Date.now().toString(),
      mode: 'whitelist',
      ids: [],
      enabled: true,
    };
    setFilters([...filters, newRule]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, patch: Partial<FilterRule>) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  return (
    <div className="panel-section">
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>报文过滤</span>
        <span>{filters.filter((f) => f.enabled).length} 条规则</span>
      </div>
      {!collapsed && (
        <div className="panel-section-body">
          <button
            className="btn btn-primary btn-sm"
            style={{ marginBottom: 10, width: '100%' }}
            onClick={addFilter}
          >
            + 添加过滤规则
          </button>

          {filters.length === 0 && (
            <div className="empty-state">暂无过滤规则</div>
          )}

          {filters.map((f) => (
            <div key={f.id} style={{ marginBottom: 12, padding: 8, background: '#2d2d30', borderRadius: 4 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) => updateFilter(f.id, { enabled: e.target.checked })}
                  />
                  启用
                </label>
                <select
                  value={f.mode}
                  style={{ flex: 1, padding: '3px 6px', fontSize: 11, border: '1px solid #444', background: '#3c3c3c', color: '#e0e0e0', borderRadius: 3 }}
                  onChange={(e) => updateFilter(f.id, { mode: e.target.value as FilterMode })}
                >
                  <option value="whitelist">白名单</option>
                  <option value="blacklist">黑名单</option>
                  <option value="conditional">条件过滤</option>
                </select>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => removeFilter(f.id)}
                >
                  ×
                </button>
              </div>

              {f.mode !== 'conditional' && (
                <input
                  type="text"
                  placeholder="ID 列表 (Hex, 逗号分隔: 0x100, 0x200)"
                  value={(f.ids || []).map((id) => '0x' + id.toString(16).toUpperCase()).join(', ')}
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, border: '1px solid #444', background: '#3c3c3c', color: '#e0e0e0', borderRadius: 3 }}
                  onChange={(e) => {
                    const ids = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => parseInt(s.replace('0x', ''), 16))
                      .filter((n) => !isNaN(n));
                    updateFilter(f.id, { ids });
                  }}
                />
              )}

              {f.mode === 'conditional' && dbc && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <select
                    value={f.message_id ?? ''}
                    style={{ padding: '3px 6px', fontSize: 11, border: '1px solid #444', background: '#3c3c3c', color: '#e0e0e0', borderRadius: 3 }}
                    onChange={(e) => {
                      const msgId = parseInt(e.target.value);
                      updateFilter(f.id, { message_id: msgId, signal_name: undefined });
                    }}
                  >
                    <option value="">选择报文</option>
                    {dbc.messages.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (0x{m.id.toString(16).toUpperCase()})
                      </option>
                    ))}
                  </select>
                  {f.message_id !== undefined && (
                    <>
                      <select
                        value={f.signal_name ?? ''}
                        style={{ padding: '3px 6px', fontSize: 11, border: '1px solid #444', background: '#3c3c3c', color: '#e0e0e0', borderRadius: 3 }}
                        onChange={(e) => updateFilter(f.id, { signal_name: e.target.value || undefined })}
                      >
                        <option value="">选择信号</option>
                        {dbc.messages
                          .find((m) => m.id === f.message_id)
                          ?.signals.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <select
                          value={f.op ?? '>'}
                          style={{ flex: 1, padding: '3px 6px', fontSize: 11, border: '1px solid #444', background: '#3c3c3c', color: '#e0e0e0', borderRadius: 3 }}
                          onChange={(e) =>
                            updateFilter(f.id, { op: e.target.value as FilterRule['op'] })
                          }
                        >
                          <option value=">">{'>'}</option>
                          <option value="<">{'<'}</option>
                          <option value=">=">{'>='}</option>
                          <option value="<=">{'<='}</option>
                          <option value="==">{'=='}</option>
                          <option value="!=">{'!='}</option>
                        </select>
                        <input
                          type="number"
                          placeholder="值"
                          value={f.value ?? ''}
                          style={{ flex: 1, padding: '3px 6px', fontSize: 11, border: '1px solid #444', background: '#3c3c3c', color: '#e0e0e0', borderRadius: 3 }}
                          onChange={(e) =>
                            updateFilter(f.id, { value: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
