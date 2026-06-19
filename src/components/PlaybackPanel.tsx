import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store';
import { canApi } from '../api';
import { open } from '@tauri-apps/plugin-dialog';
import type { RecordedFrame } from '../types';

export default function PlaybackPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const playbackFrames = useAppStore((s) => s.playbackFrames);
  const setPlaybackFrames = useAppStore((s) => s.setPlaybackFrames);
  const playbackState = useAppStore((s) => s.playbackState);
  const setPlaybackState = useAppStore((s) => s.setPlaybackState);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
  const playbackPosition = useAppStore((s) => s.playbackPosition);
  const setPlaybackPosition = useAppStore((s) => s.setPlaybackPosition);
  const addFrame = useAppStore((s) => s.addFrame);

  const indexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const startTimestampRef = useRef(0);
  const playbackStartRef = useRef(0);

  const loadFile = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: 'ASC Log Files', extensions: ['asc', 'log'] }],
    });
    if (path && typeof path === 'string') {
      const frames = await canApi.loadRecording(path);
      setPlaybackFrames(frames);
      setPlaybackPosition(0);
      indexRef.current = 0;
      setPlaybackState('stopped');
    }
  };

  const scheduleNext = useCallback(() => {
    if (indexRef.current >= playbackFrames.length) {
      setPlaybackState('stopped');
      return;
    }

    const now = performance.now();
    const elapsed = (now - playbackStartRef.current) * playbackSpeed;
    const targetTime = playbackFrames[indexRef.current].timestamp / 1000;

    const delay = Math.max(0, targetTime - elapsed);

    timerRef.current = window.setTimeout(() => {
      const frame = playbackFrames[indexRef.current];
      const displayFrame = {
        timestamp: frame.timestamp,
        id: frame.id,
        is_extended: frame.is_extended,
        is_tx: frame.is_tx,
        dlc: frame.dlc,
        data: frame.data,
        count: 1,
        period: 0,
        last_timestamp: frame.timestamp,
      };
      addFrame(displayFrame);
      setPlaybackPosition(frame.timestamp);
      indexRef.current++;
      scheduleNext();
    }, delay);
  }, [playbackFrames, playbackSpeed, addFrame, setPlaybackPosition, setPlaybackState]);

  const handlePlay = () => {
    if (playbackFrames.length === 0) return;
    if (indexRef.current >= playbackFrames.length) {
      indexRef.current = 0;
    }
    playbackStartRef.current = performance.now() - (playbackPosition / 1000) / playbackSpeed;
    setPlaybackState('playing');
    scheduleNext();
  };

  const handlePause = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPlaybackState('paused');
  };

  const handleStop = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    indexRef.current = 0;
    setPlaybackPosition(0);
    setPlaybackState('stopped');
  };

  const handleSeek = (pos: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    while (indexRef.current > 0 && playbackFrames[indexRef.current - 1]?.timestamp >= pos) {
      indexRef.current--;
    }
    while (indexRef.current < playbackFrames.length && playbackFrames[indexRef.current]?.timestamp < pos) {
      indexRef.current++;
    }
    setPlaybackPosition(pos);
    if (playbackState === 'playing') {
      playbackStartRef.current = performance.now() - (pos / 1000) / playbackSpeed;
      scheduleNext();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const totalDuration = playbackFrames.length > 0
    ? playbackFrames[playbackFrames.length - 1].timestamp
    : 0;

  return (
    <div className="panel-section" style={{ flex: 1, minHeight: 200 }}>
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>回放控制</span>
        {playbackFrames.length > 0 && <span className="tag">{playbackFrames.length} 帧</span>}
      </div>
      {!collapsed && (
        <div className="panel-section-body">
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 10 }}
            onClick={loadFile}
          >
            加载 ASC 回放文件
          </button>

          {playbackFrames.length === 0 ? (
            <div className="empty-state">未加载回放文件</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {playbackState !== 'playing' ? (
                  <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={handlePlay}>
                    ▶ 播放
                  </button>
                ) : (
                  <button className="btn btn-sm" style={{ flex: 1 }} onClick={handlePause}>
                    ⏸ 暂停
                  </button>
                )}
                <button className="btn btn-sm btn-danger" style={{ flex: 1 }} onClick={handleStop}>
                  ⏹ 停止
                </button>
              </div>

              <div className="form-group">
                <label>播放速度</label>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  disabled={playbackState === 'playing'}
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  进度: {(playbackPosition / 1000000).toFixed(2)}s / {(totalDuration / 1000000).toFixed(2)}s
                </label>
                <input
                  type="range"
                  min={0}
                  max={totalDuration}
                  value={playbackPosition}
                  onChange={(e) => handleSeek(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => handleSeek(Math.max(0, playbackPosition - 1000000))}
                >
                  -1s
                </button>
                <button
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => handleSeek(Math.min(totalDuration, playbackPosition + 1000000))}
                >
                  +1s
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
