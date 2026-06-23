import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { formatDate } from './utils';

interface FileHistoryEntry {
  commit_id: string;
  message: string;
  author: string;
  timestamp: number;
}

interface FileHistoryModalProps {
  repoPath: string;
  filePath: string;
  onClose: () => void;
}

export function FileHistoryModal({ repoPath, filePath, onClose }: FileHistoryModalProps) {
  const [history, setHistory] = useState<FileHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [repoPath, filePath]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FileHistoryEntry[]>('get_file_history', { repoPath, filePath });
      setHistory(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="modal-title" style={{ fontSize: 14, margin: 0 }}>
            Historial de <code style={{ color: 'var(--accent)' }}>{filePath}</code>
          </h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div className="panel-loading"><span className="spinner" /> Cargando historial...</div>
          ) : error ? (
            <div className="panel-empty" style={{ color: 'var(--red)', padding: 16 }}>⚠️ {error}</div>
          ) : history.length === 0 ? (
            <div className="panel-empty" style={{ padding: 16 }}>No hay commits para este archivo</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map((entry, idx) => (
                <div key={entry.commit_id}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {history.length - idx}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {entry.message.split('\n')[0]}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>{entry.commit_id.slice(0, 8)}</span>
                      <span>👤 {entry.author}</span>
                      <span>📅 {formatDate(entry.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
