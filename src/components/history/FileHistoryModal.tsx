import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { formatDate } from './utils';
import { CommitDiffPanel } from './CommitDiffPanel';

interface FileHistoryEntry {
  commit_id: string;
  message: string;
  author: string;
  timestamp: number;
}

interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
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
  const [selectedEntry, setSelectedEntry] = useState<FileHistoryEntry | null>(null);
  const [commitDiffs, setCommitDiffs] = useState<FileDiff[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [repoPath, filePath]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    setSelectedEntry(null);
    setCommitDiffs([]);
    try {
      const result = await invoke<FileHistoryEntry[]>('get_file_history', { repoPath, filePath });
      setHistory(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEntry = async (entry: FileHistoryEntry) => {
    if (selectedEntry?.commit_id === entry.commit_id) {
      setSelectedEntry(null);
      setCommitDiffs([]);
      return;
    }
    setSelectedEntry(entry);
    setLoadingDiff(true);
    try {
      const diffs = await invoke<FileDiff[]>('get_commit_diff_structured', { repoPath, commitId: entry.commit_id });
      setCommitDiffs(diffs ?? []);
    } catch {
      setCommitDiffs([]);
    } finally {
      setLoadingDiff(false);
    }
  };

  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts.pop() ?? filePath;
  const dir = parts.join('/');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`fhm-modal${selectedEntry ? ' fhm-modal--wide' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="fhm-header">
          <div className="fhm-header-icon">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M7.5 4.5v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="fhm-header-text">
            <span className="fhm-title">Historial de archivo</span>
            <span className="fhm-subtitle" title={filePath}>
              {dir && <span className="fhm-subtitle-dir">{dir}/</span>}
              <span className="fhm-subtitle-name">{filename}</span>
            </span>
          </div>
          <button className="fhm-close" onClick={onClose} title="Cerrar">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>

        {/* Body: lista + detalle en split cuando hay selección */}
        <div className="fhm-body">
          {/* Lista de commits */}
          <div className="fhm-list-col">
            {loading ? (
              <div className="fhm-state"><span className="spinner" /> Cargando historial...</div>
            ) : error ? (
              <div className="fhm-state fhm-state-error">
                <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" style={{ opacity: .6 }}>
                  <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
                </svg>
                <span>{error}</span>
              </div>
            ) : history.length === 0 ? (
              <div className="fhm-state">
                <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor" style={{ opacity: .3 }}>
                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                </svg>
                <span>Sin historial para este archivo</span>
              </div>
            ) : (
              <div className="fhm-list">
                {history.map((entry, idx) => {
                  const isSelected = selectedEntry?.commit_id === entry.commit_id;
                  return (
                    <div
                      key={entry.commit_id}
                      className={`fhm-entry${isSelected ? ' fhm-entry--selected' : ''}`}
                      onClick={() => handleSelectEntry(entry)}
                    >
                      {/* Timeline */}
                      <div className="fhm-timeline">
                        <div className={`fhm-dot${isSelected ? ' fhm-dot--active' : ''}`} />
                        {idx < history.length - 1 && <div className="fhm-line" />}
                      </div>

                      <div className="fhm-entry-body">
                        <div className="fhm-entry-msg">{entry.message.split('\n')[0]}</div>
                        <div className="fhm-entry-meta">
                          <span
                            className="fhm-meta-hash"
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(entry.commit_id); }}
                            title="Copiar hash"
                          >
                            {entry.commit_id.slice(0, 8)}
                          </span>
                          <span className="fhm-meta-sep">·</span>
                          <span className="fhm-meta-author">
                            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style={{ flexShrink: 0 }}>
                              <path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
                            </svg>
                            {entry.author}
                          </span>
                          <span className="fhm-meta-sep">·</span>
                          <span className="fhm-meta-date">
                            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style={{ flexShrink: 0 }}>
                              <path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5Z"/>
                            </svg>
                            {formatDate(entry.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Flecha indicando que está seleccionado */}
                      {isSelected && (
                        <div className="fhm-entry-arrow">
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel de detalle del commit seleccionado */}
          {selectedEntry && (
            <div className="fhm-detail-col">
              <div className="fhm-detail-header">
                <span className="fhm-detail-title">Cambios del commit</span>
                <button
                  className="fhm-close"
                  title="Cerrar detalle"
                  onClick={() => { setSelectedEntry(null); setCommitDiffs([]); }}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                  </svg>
                </button>
              </div>
              {loadingDiff ? (
                <div className="fhm-state"><span className="spinner" /> Cargando cambios...</div>
              ) : (
                <CommitDiffPanel
                  commit={{
                    id: selectedEntry.commit_id,
                    message: selectedEntry.message,
                    author: selectedEntry.author,
                    timestamp: selectedEntry.timestamp,
                  }}
                  fileDiffs={commitDiffs}
                  repoPath={repoPath}
                  showFileHistory={false}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && history.length > 0 && (
          <div className="fhm-footer">
            <span className="fhm-footer-count">
              {history.length} commit{history.length !== 1 ? 's' : ''}
              {selectedEntry && <span className="fhm-footer-hint"> · click en un commit para ver sus cambios</span>}
            </span>
            <button className="btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
