import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { canApi } from '../api';
import type { CompareResult, BatchCompareResult } from '../types';
import CompareReport from './CompareReport';

interface FileInfo {
  path: string;
  name: string;
  frameCount: number;
  timeSpanUs: number;
}

export default function ComparatorPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [baseFile, setBaseFile] = useState<FileInfo | null>(null);
  const [compareFile, setCompareFile] = useState<FileInfo | null>(null);
  const [compareFiles, setCompareFiles] = useState<FileInfo[]>([]);
  const [comparing, setComparing] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [singleResult, setSingleResult] = useState<CompareResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchCompareResult | null>(null);

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

  const loadBatchFiles = async () => {
    const paths = await open({
      multiple: true,
      filters: [{ name: 'ASC Log Files', extensions: ['asc', 'log'] }],
    });
    if (!paths || !Array.isArray(paths) || paths.length === 0) return;

    const validPaths = paths.slice(0, 8);
    const loadedFiles: FileInfo[] = [];

    for (const path of validPaths) {
      try {
        const frames = await canApi.loadRecording(path);
        const name = path.split(/[\\/]/).pop() || path;
        const timeSpanUs = frames.length > 0
          ? frames[frames.length - 1].timestamp - frames[0].timestamp
          : 0;
        loadedFiles.push({ path, name, frameCount: frames.length, timeSpanUs });
      } catch (e) {
        console.error(`Failed to load ${path}:`, e);
      }
    }

    setCompareFiles(loadedFiles);
  };

  const removeCompareFile = (idx: number) => {
    setCompareFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearCompareFiles = () => {
    setCompareFiles([]);
  };

  const handleCompare = async () => {
    if (!baseFile) return;

    if (batchMode) {
      if (compareFiles.length < 2) return;
      if (compareFiles.length > 8) return;

      setComparing(true);
      try {
        const paths = compareFiles.map((f) => f.path);
        const res = await canApi.compareRecordingsBatch(baseFile.path, paths, threshold);
        setBatchResult(res);
      } catch (e) {
        console.error('Batch compare failed:', e);
      } finally {
        setComparing(false);
      }
    } else {
      if (!compareFile) return;

      setComparing(true);
      try {
        const res = await canApi.compareRecordings(
          baseFile.path,
          compareFile.path,
          threshold
        );
        setSingleResult(res);
      } catch (e) {
        console.error('Compare failed:', e);
      } finally {
        setComparing(false);
      }
    }
  };

  const formatSpan = (us: number) => {
    const sec = us / 1_000_000;
    if (sec < 60) return `${sec.toFixed(2)}s`;
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}m ${s}s`;
  };

  const canStart = batchMode
    ? baseFile !== null && compareFiles.length >= 2 && compareFiles.length <= 8 && !comparing
    : baseFile !== null && compareFile !== null && !comparing;

  const overLimitHint = compareFiles.length > 8;

  return (
    <div className="panel-section" style={{ flex: 1, minHeight: 180 }}>
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>比较器</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {batchMode && baseFile && compareFiles.length >= 2 && compareFiles.length <= 8 && (
            <span className="tag tag-green">就绪</span>
          )}
          {!batchMode && baseFile && compareFile && <span className="tag tag-green">就绪</span>}
        </div>
      </div>
      {!collapsed && (
        <div className="panel-section-body">
          <div className="checkbox" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={batchMode}
              onChange={(e) => {
                setBatchMode(e.target.checked);
                if (!e.target.checked) {
                  setCompareFiles([]);
                  setBatchResult(null);
                } else {
                  setCompareFile(null);
                  setSingleResult(null);
                }
              }}
            />
            <label>批量模式</label>
          </div>

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

          {!batchMode ? (
            <>
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
            </>
          ) : (
            <>
              <button
                className="btn btn-sm"
                style={{ width: '100%', marginBottom: 8, marginTop: 4 }}
                onClick={loadBatchFiles}
              >
                加载对比文件 (多选)
              </button>
              {compareFiles.length > 0 && (
                <button
                  className="btn btn-sm"
                  style={{ width: '100%', marginBottom: 8 }}
                  onClick={clearCompareFiles}
                >
                  清空对比文件列表
                </button>
              )}
              {compareFiles.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {compareFiles.map((f, idx) => (
                    <div
                      key={f.path}
                      className="comparator-file-info"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="comparator-file-name" title={f.path}>
                          {idx + 1}. {f.name}
                        </div>
                        <div className="comparator-file-meta">
                          {f.frameCount} 帧 | {formatSpan(f.timeSpanUs)}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => removeCompareFile(idx)}
                        title="移除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {overLimitHint && (
                <div style={{ color: '#ce9178', fontSize: 11, marginBottom: 8 }}>
                  ⚠ 最多只能对比 8 份文件，当前已选择 {compareFiles.length} 份
                </div>
              )}
              {!overLimitHint && compareFiles.length < 2 && compareFiles.length > 0 && (
                <div style={{ color: '#856404', fontSize: 11, marginBottom: 8 }}>
                  ⚠ 批量模式至少需要 2 份对比文件
                </div>
              )}
            </>
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
            disabled={!canStart}
            onClick={handleCompare}
          >
            {comparing ? '比较中...' : batchMode ? `开始批量比较 (${compareFiles.length}份)` : '开始比较'}
          </button>
        </div>
      )}

      {singleResult && (
        <CompareReport
          result={singleResult}
          threshold={threshold}
          onClose={() => setSingleResult(null)}
        />
      )}
      {batchResult && (
        <CompareReport
          batchResult={batchResult}
          threshold={threshold}
          onClose={() => setBatchResult(null)}
        />
      )}
    </div>
  );
}
