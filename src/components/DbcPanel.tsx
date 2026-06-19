import { useState } from 'react';
import { useAppStore } from '../store';
import { canApi } from '../api';
import type { DbcMessage, DbcSignal } from '../types';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { formatId } from '../utils';

export default function DbcPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const dbc = useAppStore((s) => s.dbc);
  const setDbc = useAppStore((s) => s.setDbc);
  const dbcFilePath = useAppStore((s) => s.dbcFilePath);
  const addTraceSignal = useAppStore((s) => s.addTraceSignal);
  const traceSignals = useAppStore((s) => s.traceSignals);

  const loadDbc = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: 'DBC Files', extensions: ['dbc'] }],
    });
    if (path && typeof path === 'string') {
      const content = await readTextFile(path);
      const parsed = await canApi.parseDbc(content);
      await canApi.setDbc(parsed);
      setDbc(parsed, path);
    }
  };

  const unloadDbc = () => setDbc(null, null);

  const isTraced = (msgId: number, sigName: string) =>
    traceSignals.some((t) => t.message_id === msgId && t.signal_name === sigName);

  return (
    <div className="panel-section" style={{ flex: 1, minHeight: 200 }}>
      <div className="panel-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>DBC 数据库</span>
        {dbcFilePath && <span className="tag">{dbcFilePath.split('\\').pop()}</span>}
      </div>
      {!collapsed && (
        <div className="panel-section-body" style={{ flex: 1 }}>
          {!dbc ? (
            <div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={loadDbc}>
                加载 DBC 文件
              </button>
              <div className="empty-state" style={{ marginTop: 16 }}>
                未加载 DBC 文件
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button className="btn btn-sm" onClick={loadDbc}>
                  重新加载
                </button>
                <button className="btn btn-sm btn-danger" onClick={unloadDbc}>
                  卸载
                </button>
              </div>
              <div className="db-tree">
                {dbc.messages.map((msg) => (
                  <DbcMessageNode
                    key={msg.id}
                    msg={msg}
                    isTraced={isTraced}
                    onAddTrace={(sigName) => addTraceSignal(msg.id, sigName)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DbcMessageNode({
  msg,
  isTraced,
  onAddTrace,
}: {
  msg: DbcMessage;
  isTraced: (msgId: number, sigName: string) => boolean;
  onAddTrace: (sigName: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div className="db-tree-node" onClick={() => setExpanded(!expanded)}>
        <span className="db-tree-icon">{expanded ? '▼' : '▶'}</span>
        <span className="db-tree-msg">
          {msg.name} ({formatId(msg.id, msg.is_extended)})
        </span>
      </div>
      {expanded && (
        <div className="db-tree-children">
          {msg.signals.map((sig) => (
            <DbcSignalNode
              key={sig.name}
              msg={msg}
              sig={sig}
              traced={isTraced(msg.id, sig.name)}
              onAddTrace={() => onAddTrace(sig.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DbcSignalNode({
  msg,
  sig,
  traced,
  onAddTrace,
}: {
  msg: DbcMessage;
  sig: DbcSignal;
  traced: boolean;
  onAddTrace: () => void;
}) {
  return (
    <div
      className="db-tree-node"
      onClick={(e) => {
        e.stopPropagation();
        if (!traced) onAddTrace();
      }}
      title={traced ? '已在图表中追踪' : '点击添加到图表追踪'}
    >
      <span className="db-tree-icon">{'·'}</span>
      <span className="db-tree-sig">
        {sig.name} [{sig.start_bit}:{sig.bit_length}] {sig.unit}
      </span>
      {traced && <span className="tag tag-green" style={{ marginLeft: 'auto' }}>追踪</span>}
    </div>
  );
}
