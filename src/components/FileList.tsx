import { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileStatus } from '../types';
import { toast } from './Toast';

interface FileListProps {
  files: FileStatus[];
  selectedFile: string | null;
  loading: boolean;
  onSelectFile: (path: string) => void;
  onDiscardFile: (path: string) => void;
  repoPath?: string;
  onRefresh?: () => void;
}

const STATUS_META: Record<string, { icon: string; label: string; cls: string }> = {
  modified:  { icon: '✏️',  label: 'M', cls: 'status-modified'  },
  untracked: { icon: '❓',  label: 'U', cls: 'status-untracked' },
  deleted:   { icon: '🗑️', label: 'D', cls: 'status-deleted'   },
  conflicted: { icon: '⚠️', label: 'C', cls: 'status-conflicted' },
  unknown:   { icon: '📄',  label: '?', cls: 'status-unknown'   },
};

export function FileList({ files, selectedFile, loading, onSelectFile, onDiscardFile, repoPath, onRefresh }: FileListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(query));
  }, [files, searchQuery]);

  const toggleSelect = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.path)));
    }
  };

  const handleStageSelected = async () => {
    if (!repoPath || selectedFiles.size === 0) return;
    setActionLoading(true);
    try {
      for (const file of selectedFiles) {
        await invoke('stage_file', { repoPath, filePath: file });
      }
      toast.success(`${selectedFiles.size} archivo(s) agregado(s) al stage`);
      setSelectedFiles(new Set());
      onRefresh?.();
    } catch (e) {
      toast.error(`Error al agregar al stage: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstageSelected = async () => {
    if (!repoPath || selectedFiles.size === 0) return;
    setActionLoading(true);
    try {
      for (const file of selectedFiles) {
        await invoke('unstage_file', { repoPath, filePath: file });
      }
      toast.success(`${selectedFiles.size} archivo(s) quitado(s) del stage`);
      setSelectedFiles(new Set());
      onRefresh?.();
    } catch (e) {
      toast.error(`Error al quitar del stage: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (files.length === 0) {
    return (
      <div className="file-list-empty">
        <span style={{ fontSize: 36 }}>✨</span>
        <p>Sin cambios pendientes</p>
      </div>
    );
  }

  const conflicted = filteredFiles.filter(f => f.status === 'conflicted');
  const normal = filteredFiles.filter(f => f.status !== 'conflicted');

  const renderFileRow = (file: FileStatus) => {
    const meta = STATUS_META[file.status] ?? STATUS_META.unknown;
    const isSelected = selectedFile === file.path;
    const isChecked = selectedFiles.has(file.path);

    const parts = file.path.replace(/\\/g, '/').split('/');
    const filename = parts.pop() ?? file.path;
    const dir = parts.join('/');

    const matchQuery = searchQuery.trim().toLowerCase();
    const highlightMatch = (text: string) => {
      if (!matchQuery) return text;
      const idx = text.toLowerCase().indexOf(matchQuery);
      if (idx === -1) return text;
      return (
        <>
          {text.slice(0, idx)}
          <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + matchQuery.length)}</span>
          {text.slice(idx + matchQuery.length)}
        </>
      );
    };

    return (
      <div key={file.path}
        className={`file-item ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelectFile(file.path)}
        style={file.status === 'conflicted' ? { borderLeft: '3px solid var(--red)' } : {}}
      >
        <input type="checkbox" checked={isChecked}
          onChange={(e) => { e.stopPropagation(); toggleSelect(file.path); }}
          onClick={(e) => e.stopPropagation()}
          style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
        />
        <span className={`file-status-badge ${meta.cls}`}>{meta.label}</span>
        <div className="file-names">
          {dir && <span className="file-dir">{highlightMatch(dir)}/</span>}
          <span className="file-name">{highlightMatch(filename)}</span>
        </div>
        <button className="btn-discard"
          onClick={(e) => { e.stopPropagation(); onDiscardFile(file.path); }}
          disabled={loading} title="Descartar cambios">🗑</button>
      </div>
    );
  };

  return (
    <div className="file-list-sections" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {files.length > 5 && (
        <div style={{ padding: '0 8px' }}>
          <input type="text" placeholder="Buscar archivos..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input" style={{ fontSize: 11, padding: '6px 10px' }} />
        </div>
      )}

      {repoPath && filteredFiles.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', padding: '6px 8px 0', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
              onChange={selectAll} style={{ accentColor: 'var(--accent)' }} />
            {selectedFiles.size > 0 ? `${selectedFiles.size} seleccionado(s)` : 'Seleccionar todo'}
          </label>
          {selectedFiles.size > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              <button className="btn-primary" onClick={handleStageSelected}
                disabled={actionLoading} style={{ fontSize: 10, padding: '3px 8px' }}>
                + Stage
              </button>
              <button className="btn-secondary" onClick={handleUnstageSelected}
                disabled={actionLoading} style={{ fontSize: 10, padding: '3px 8px' }}>
                - Unstage
              </button>
            </div>
          )}
        </div>
      )}

      {filteredFiles.length === 0 && searchQuery.trim() && (
        <div className="file-list-empty" style={{ padding: '16px' }}>
          <span>🔍</span>
          <p>No se encontraron archivos para "{searchQuery}"</p>
        </div>
      )}

      {conflicted.length > 0 && (
        <div className="conflicted-files-section" style={{
          background: 'rgba(248, 113, 113, 0.05)',
          border: '1px solid rgba(248, 113, 113, 0.15)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 4px 10px'
        }}>
          <div style={{ color: 'var(--red)', fontSize: '11px', fontWeight: 'bold',
            letterSpacing: '0.5px', padding: '2px 8px 8px',
            display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️</span> ARCHIVOS CON CONFLICTO ({conflicted.length})
          </div>
          <div className="file-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {conflicted.map(renderFileRow)}
          </div>
        </div>
      )}

      {normal.length > 0 && (
        <div className="normal-files-section">
          {conflicted.length > 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', padding: '2px 8px 8px' }}>
              📁 OTROS CAMBIOS ({normal.length})
            </div>
          )}
          <div className="file-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {normal.map(renderFileRow)}
          </div>
        </div>
      )}
    </div>
  );
}
