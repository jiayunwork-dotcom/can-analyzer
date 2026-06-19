import { useState, useMemo } from 'react';
import { useAppStore } from '../store';

export default function StatsPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const stats = useAppStore((s) => s.stats);

  const topFrequencies = useMemo(() => {
    const entries = Object.entries(stats.id_frequencies)
      .map(([id, freq]) => ({ id: parseInt(id), freq }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 10);
    const maxFreq = Math.max(1, ...entries.map((e) => e.freq));
    return entries.map((e) => ({ ...e, maxFreq }));
  }, [stats.id_frequencies]);

  const THEORETICAL_MAX_FPS = (500000 / (1 + 11 + 1 + 1 + 4 + 64 + 15 + 1 + 1 + 7)) | 0;

  return (
    <div className="panel-section">
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>总线统计</span>
      </div>
      {!collapsed && (
        <div className="panel-section-body">
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="stat-card" style={{ flex: 1 }}>
              <div className="stat-label">负载率</div>
              <div className="stat-value">{(stats.load_rate * 100).toFixed(1)}%</div>
            </div>
            <div className="stat-card" style={{ flex: 1 }}>
              <div className="stat-label">帧率</div>
              <div className="stat-value">{stats.fps.toFixed(0)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">错误帧</div>
            <div className="stat-value" style={{ color: stats.error_count > 0 ? '#ce9178' : '#4ec9b0' }}>
              {stats.error_count}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label" style={{ marginBottom: 10 }}>
              ID 频率排行 (Top 10)
            </div>
            {topFrequencies.length === 0 ? (
              <div className="empty-state" style={{ padding: 10 }}>暂无数据</div>
            ) : (
              topFrequencies.map(({ id, freq, maxFreq }) => (
                <div key={id} className="freq-bar">
                  <span className="freq-bar-id">0x{id.toString(16).toUpperCase().padStart(3, '0')}</span>
                  <div className="freq-bar-track">
                    <div
                      className="freq-bar-fill"
                      style={{ width: `${(freq / maxFreq) * 100}%` }}
                    />
                  </div>
                  <span className="freq-bar-value">{freq.toFixed(1)}/s</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
