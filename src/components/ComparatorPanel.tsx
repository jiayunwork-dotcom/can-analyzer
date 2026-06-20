import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { canApi } from '../api';
import type { CompareResult } from '../types';
import CompareReport from './CompareReport';

interface FileInfo {
  path: string;
  name: string;
  frameCount: number;
  timeSpanUs: number;
}

export default function ComparatorPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [baseFile, setBaseFile] = useState<FileInfo | null>(null);
  const [compareFile, setCompareFile] = useState<FileInfo | null>(null);
  const [comparing, setComparing] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [result, setResult] = useState<CompareResult | null>(null);

  const loadFile = async (type: 'base' | 'compare') => {
    const path = await open({
      multiple: false,
      filters: [{ name: 'ASC Log Files', extensions: ['asc', 'log'] }],
    });
    if (!path || typeof path !== 'string') return;

    const frames = await canApi.loadRecording(path);
    const name = path.split(/[\\/]/).pop() || path;
    const timeSpanUs = frames.length > 0
      ? frames[frames.length - 1].timestamp - frames[0].timestamp
      : 0;
    const info: FileInfo = { path, name, frameCount: frames.length, timeSpanUs };

    if (type === 'base') {
      setBaseFile(info);
    } else {
      setCompareFile(info);
    }
  };

  const handleCompare = async () => {
    if (!baseFile || !compareFile) return;
    setComparing(true);
    try {
      const res = await canApi.compareRecordings(
        baseFile.path,
        compareFile.path,
        threshold
      );
      setResult(res);
    } catch (e) {
      console.error('Compare failed:', e);
    } finally {
      setComparing(false);
    }
  };

  const formatSpan = (us: number) => {
    const sec = us / 1_000_000;
    if (sec < 60) return `${sec.toFixed(2)}s`;
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}m ${s}s`;
  };

  return (
    <div className="panel-section" style={{ flex: 1, minHeight: 180 }}>
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>比较器</span>
        {baseFile && compareFile && <span className="tag tag-green">就绪</span>}
      </div>
      {!collapsed && (
        <div className="panel-section-body">
          <button
            className="btn btn-sm"
            style={{ width: '100%', marginBottom: 8 }}
            onClick={() => loadFile('base')}
          >
            加载基准文件
          </button>
          {baseFile && (
            <div className="comparator-file-info">
              <div className="comparator-file-name" title={baseFile.path}>
                {baseFile.name}
              </div>
              <div className="comparator-file-meta">
                {baseFile.frameCount} 帧 | {formatSpan(baseFile.timeSpanUs)}
              </div>
            </div>
          )}

          <button
            className="btn btn-sm"
            style={{ width: '100%', marginBottom: 8, marginTop: 4 }}
            onClick={() => loadFile('compare')}
          >
            加载对比文件
          </button>
          {compareFile && (
            <div className="comparator-file-info">
              <div className="comparator-file-name" title={compareFile.path}>
                {compareFile.name}
              </div>
              <div className="comparator-file-meta">
                {compareFile.frameCount} 帧 | {formatSpan(compareFile.timeSpanUs)}
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginTop: 8 }}>
            <label>差值阈值 (% 量程)</label>
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 5)}
            />
          </div>

          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%', marginTop: 4 }}
            disabled={!baseFile || !compareFile || comparing}
            onClick={handleCompare}
          >
            {comparing ? '比较中...' : '开始比较'}
          </button>
        </div>
      )}

      {result && (
        <CompareReport result={result} threshold={threshold} onClose={() => setResult(null)} />
      )}
    </div>
  );
}
