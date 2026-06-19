import { useAppStore } from '../store';
import { canApi } from '../api';
import { save } from '@tauri-apps/plugin-dialog';

export default function AppHeader() {
  const simRunning = useAppStore((s) => s.simRunning);
  const setSimRunning = useAppStore((s) => s.setSimRunning);
  const isRecording = useAppStore((s) => s.isRecording);
  const setRecording = useAppStore((s) => s.setRecording);
  const clearFrames = useAppStore((s) => s.clearFrames);
  const resetStats = useAppStore((s) => s.resetStats);
  const stats = useAppStore((s) => s.stats);

  const toggleSimulator = async () => {
    if (simRunning) {
      await canApi.stopSimulator();
      setSimRunning(false);
    } else {
      await canApi.startSimulator();
      setSimRunning(true);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await canApi.stopRecording();
      setRecording(false);
    } else {
      const path = await save({
        defaultPath: `capture_${Date.now()}.asc`,
        filters: [{ name: 'ASC Log Files', extensions: ['asc'] }],
      });
      if (path) {
        await canApi.startRecording(path);
        setRecording(true);
      }
    }
  };

  const handleClear = async () => {
    await canApi.clearFrames();
    await canApi.resetStats();
    clearFrames();
    resetStats();
  };

  return (
    <>
      <div className="app-header">
        <h1>CAN Analyzer</h1>
        <button
          className={`btn ${simRunning ? 'btn-danger' : 'btn-success'}`}
          onClick={toggleSimulator}
        >
          {simRunning ? '■ 停止模拟' : '▶ 启动模拟'}
        </button>
        <button
          className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
          onClick={toggleRecording}
        >
          {isRecording ? '⏹ 停止录制' : '● 开始录制'}
        </button>
        <button className="btn" onClick={handleClear}>
          清空数据
        </button>
        <div className="toolbar-spacer" />
        <span style={{ fontSize: 12, color: '#aaa' }}>
          FPS: {stats.fps.toFixed(0)} | 负载: {(stats.load_rate * 100).toFixed(1)}%
        </span>
      </div>
      <div className="status-bar">
        <span>模拟器: {simRunning ? '运行中' : '已停止'}</span>
        <span>录制: {isRecording ? '进行中' : '未录制'}</span>
        <span>错误帧: {stats.error_count}</span>
      </div>
    </>
  );
}
