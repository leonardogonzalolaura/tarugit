import { useState, useMemo, useRef, useEffect, useCallback, forwardRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileStatus } from '../types';
import { toast } from './Toast';

interface FileListProps {
  files: FileStatus[];
  selectedFile: string | null;
  loading: boolean;
  onSelectFile: (path: string) => void;
  onDiscardFile: (path: string) => void;
  onFileHistory?: (path: string) => void;
  repoPath?: string;
  onRefresh?: () => void;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  modified:   { label: 'M', cls: 'st-modified'  },
  untracked:  { label: 'U', cls: 'st-untracked' },
  deleted:    { label: 'D', cls: 'st-deleted'   },
  conflicted: { label: 'C', cls: 'st-conflicted' },
  unknown:    { label: '?', cls: 'st-unknown'   },
};

export const FileList = forwardRef<HTMLDivElement, FileListProps>(function FileList({ files, selectedFile, loading, onSelectFile, onDiscardFile, onFileHistory, repoPath, onRefresh }, ref) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const innerRef = useRef<HTMLDivElement>(null);
  const setListRef = useCallback((el: HTMLDivElement | null) => {
    (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, [ref]);
  const listRef = innerRef;

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(query));
  }, [files, searchQuery]);

  const conflicted = useMemo(() => filteredFiles.filter(f => f.status === 'conflicted'), [filteredFiles]);
  const normal = useMemo(() => filteredFiles.filter(f => f.status !== 'conflicted'), [filteredFiles]);
  const flatFiles = useMemo(() => [...conflicted, ...normal], [conflicted, normal]);

  const scrollIntoView = useCallback((idx: number) => {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-idx]');
    if (items && items[idx]) {
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }, []);

  useEffect(() => {
    if (selectedFile) {
      const idx = flatFiles.findIndex(f => f.path === selectedFile);
      setFocusedIdx(Math.max(idx, 0));
    } else if (flatFiles.length > 0) {
      setFocusedIdx(0);
    } else {
      setFocusedIdx(-1);
    }
  }, [selectedFile, flatFiles]);

  useEffect(() => {
    if (focusedIdx >= 0) scrollIntoView(focusedIdx);
  }, [focusedIdx, scrollIntoView]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (flatFiles.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx(i => Math.min(i + 1, flatFiles.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && flatFiles[focusedIdx]) {
        e.preventDefault();
        onSelectFile(flatFiles[focusedIdx].path);
        return;
      }
    };
    el.addEventListener('keydown', h);
    return () => el.removeEventListener('keydown', h);
  }, [flatFiles, focusedIdx, onSelectFile]);

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

  const handleOpenGitignore = () => {
    onSelectFile('.gitignore');
  };

  const hasSelection = selectedFiles.size > 0;
  const allSelected = selectedFiles.size === filteredFiles.length && filteredFiles.length > 0;

  if (files.length === 0) {
    return (
      <div className="file-list-empty">
        <span style={{ fontSize: 28, opacity: 0.4 }}>📝</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin cambios pendientes</span>
        {repoPath && (
          <button className="gitignore-btn" onClick={handleOpenGitignore}>
            + .gitignore
          </button>
        )}
      </div>
    );
  }

  const renderFileRow = (file: FileStatus, idx: number) => {
    const meta = STATUS_META[file.status] ?? STATUS_META.unknown;
    const isSelected = selectedFile === file.path;
    const isChecked = selectedFiles.has(file.path);
    const isConflicted = file.status === 'conflicted';

    const parts = file.path.replace(/\\/g, '/').split('/');
    const filename = parts.pop() ?? file.path;
    const dir = parts.join('/');

    const matchQuery = searchQuery.trim().toLowerCase();
    const highlight = (text: string) => {
      if (!matchQuery) return text;
      const idx = text.toLowerCase().indexOf(matchQuery);
      if (idx === -1) return text;
      return (
        <>
          {text.slice(0, idx)}
          <span className="search-highlight">{text.slice(idx, idx + matchQuery.length)}</span>
          {text.slice(idx + matchQuery.length)}
        </>
      );
    };

    return (
      <div
        key={file.path}
        data-idx={idx}
        className={`f-row${isSelected ? ' selected' : ''}${isConflicted ? ' conflicted' : ''}${idx === focusedIdx ? ' focused' : ''}`}
        onClick={() => onSelectFile(file.path)}
      >
        <label className="f-cb" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleSelect(file.path)}
          />
        </label>
        <span className={`f-badge ${meta.cls}`} title={file.status}>{meta.label}</span>
        <span className="f-path" title={file.path}>
          {dir ? <span className="f-dir">{highlight(dir)}/</span> : null}
          <span className="f-name">{highlight(filename)}</span>
        </span>
        <span className="f-actions">
          {onFileHistory && (
            <button className="f-act f-act-history" onClick={e => { e.stopPropagation(); onFileHistory(file.path); }} title="Historial">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7.5 4.5v4.5l3 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button className="f-act f-act-del" onClick={e => { e.stopPropagation(); onDiscardFile(file.path); }} disabled={loading} title="Descartar">✕</button>
        </span>
      </div>
    );
  };

  return (
    <div ref={setListRef} className="fl" tabIndex={0}>
      {/* Header */}
      <div className="fl-header">
        <div className="fl-title">
          <span className="fl-count">{files.length}</span>
          {hasSelection && (
            <span className="fl-sel">{selectedFiles.size} sel.</span>
          )}
        </div>
        <div className="fl-header-actions">
          {files.length > 0 && (
            <button className={`fl-btn ${showSearch ? 'active' : ''}`} onClick={() => setShowSearch(v => !v)} title="Buscar">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M6.5 1a5.5 5.5 0 1 0 3.38 9.82l2.65 2.65a.75.75 0 1 0 1.06-1.06l-2.65-2.65A5.5 5.5 0 0 0 6.5 1Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/>
              </svg>
            </button>
          )}
          <button className="fl-btn" onClick={handleOpenGitignore} title="Editar .gitignore">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M2 1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V5.164a.25.25 0 0 0-.073-.177L9.513 2.323a.25.25 0 0 0-.177-.073H10v2.5A1.75 1.75 0 0 0 11.75 6.5H13v7.75a.25.25 0 0 1-.25.25h-8.5a.25.25 0 0 1-.25-.25V1.75Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="fl-search">
          <input
            type="text"
            placeholder="Filtrar archivos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && <button className="fl-search-clear" onClick={() => { setSearchQuery(''); setShowSearch(false); }}>✕</button>}
        </div>
      )}

      {/* Selection toolbar */}
      {hasSelection && (
        <div className="fl-toolbar">
          <label className="fl-cb-all">
            <input type="checkbox" checked={allSelected} onChange={selectAll} />
            <span>{allSelected ? 'Todo' : `${selectedFiles.size} archivo(s)`}</span>
          </label>
          <div className="fl-toolbar-actions">
            <button className="fl-tb-btn stage" onClick={handleStageSelected} disabled={actionLoading}>
              {actionLoading ? <span className="spinner-sm" /> : null}+ Stage
            </button>
            <button className="fl-tb-btn unstage" onClick={handleUnstageSelected} disabled={actionLoading}>
              - Unstage
            </button>
          </div>
        </div>
      )}

      {/* No search results */}
      {filteredFiles.length === 0 && searchQuery.trim() && (
        <div className="fl-empty">Sin resultados para "{searchQuery}"</div>
      )}

      {/* Conflicted files */}
      {conflicted.length > 0 && (
        <div className="fl-section">
          <div className="fl-section-header conflicted">
            <span>⚠ Conflictos</span>
            <span className="fl-section-count">{conflicted.length}</span>
          </div>
          {conflicted.map((f, i) => renderFileRow(f, i))}
        </div>
      )}

      {/* Normal files */}
      {normal.length > 0 && (
        <div className="fl-section">
          {conflicted.length > 0 && (
            <div className="fl-section-header">
              <span>Cambios</span>
              <span className="fl-section-count">{normal.length}</span>
            </div>
          )}
          {normal.map((f, i) => renderFileRow(f, conflicted.length + i))}
        </div>
      )}
    </div>
  );
});
