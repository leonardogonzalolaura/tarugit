import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { analyzeInconsistencies, Inconsistency } from '../../utils/inconsistencyAnalyzer';
import { ConflictCodeEditor } from '../ConflictResolver/components/ConflictCodeEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InconsistencyCheckerModalProps {
  repoPath: string;
  commit: { id: string; message: string };
  fileDiffs: Array<{ path: string }>;
  onClose: () => void;
}

type ViewState = 'select' | 'results' | 'editor';

interface FileResult {
  path: string;
  inconsistencies: Inconsistency[];
  error?: string;
  /** El archivo se guardó y ya no tiene inconsistencias. */
  resolved?: boolean;
}

interface SaveNotice {
  kind: 'success' | 'warning';
  text: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortHash(id: string) {
  return id.slice(0, 7);
}

function fileName(path: string) {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" style={{ color: 'var(--green)' }}>
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ color: 'var(--red)', flexShrink: 0 }}>
      <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InconsistencyCheckerModal({
  repoPath,
  commit,
  fileDiffs,
  onClose,
}: InconsistencyCheckerModalProps) {
  // ---- State ----
  const [view, setView] = useState<ViewState>('select');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Editor state
  const [editorFilePath, setEditorFilePath] = useState('');
  const [editorSourcePath, setEditorSourcePath] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorMatchedLines, setEditorMatchedLines] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  // Contenido guardado en esta sesión: al reabrir no se revierte al del commit
  const savedContentsRef = useRef<Map<string, string>>(new Map());

  // En el editor, cerrar (fondo/X/Escape) vuelve a los resultados; no cierra todo
  const handleDismiss = useCallback(() => {
    if (view === 'editor') {
      setSaveNotice(null);
      setView('results');
      return;
    }
    onClose();
  }, [view, onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismiss(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [handleDismiss]);

  // ---- Handlers ----

  const togglePath = useCallback((path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAllPaths = useCallback(() => {
    if (selectedPaths.size === fileDiffs.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(fileDiffs.map(f => f.path)));
    }
  }, [selectedPaths.size, fileDiffs]);

  const handleAnalyze = useCallback(async () => {
    if (selectedPaths.size === 0) return;
    setAnalyzing(true);
    setSaveNotice(null);
    const fileResults: FileResult[] = [];

    for (const path of selectedPaths) {
      try {
        const saved = savedContentsRef.current.get(path);
        const content = saved ?? await invoke<string>('read_file_from_commit', {
          repoPath,
          commitId: commit.id,
          filePath: path,
        });
        const inconsistencies = analyzeInconsistencies(content, path);
        fileResults.push({ path, inconsistencies });
      } catch (err) {
        fileResults.push({ path, inconsistencies: [], error: String(err) });
      }
    }

    setResults(fileResults);
    // Auto-expand files that have inconsistencies
    const withIssues = new Set(fileResults.filter(r => r.inconsistencies.length > 0).map(r => r.path));
    setExpandedFiles(withIssues);
    setAnalyzing(false);
    setView('results');
  }, [selectedPaths, repoPath, commit.id]);

  const toggleExpandFile = useCallback((path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleOpenEditor = useCallback(async (fileResult: FileResult) => {
    try {
      const saved = savedContentsRef.current.get(fileResult.path);
      const content = saved ?? await invoke<string>('read_file_from_commit', {
        repoPath,
        commitId: commit.id,
        filePath: fileResult.path,
      });
      // Gather 0-based line indices for all inconsistency occurrences
      const matched = Array.from(
        new Set(
          fileResult.inconsistencies.flatMap(inc => inc.occurrences.map(o => o.line - 1))
        )
      ).sort((a, b) => a - b);

      setEditorFilePath(fileResult.path.replace(/\\/g, '/'));
      setEditorSourcePath(fileResult.path);
      setEditorContent(content);
      setEditorMatchedLines(matched);
      setSaveError('');
      setSaveNotice(null);
      setView('editor');
    } catch (err) {
      alert(`Error al leer el archivo: ${err}`);
    }
  }, [repoPath, commit.id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    setSaveNotice(null);
    try {
      await invoke('write_file_content', {
        repoPath,
        filePath: editorFilePath,
        content: editorContent,
      });

      savedContentsRef.current.set(editorSourcePath, editorContent);

      // Reanalizar el contenido guardado para saber si quedó resuelto del todo
      const remaining = analyzeInconsistencies(editorContent, editorFilePath);
      const remainingLines = Array.from(
        new Set(remaining.flatMap(inc => inc.occurrences.map(o => o.line - 1)))
      ).sort((a, b) => a - b);

      setEditorMatchedLines(remainingLines);
      setResults(prev => prev.map(r =>
        r.path === editorSourcePath
          ? { ...r, inconsistencies: remaining, resolved: remaining.length === 0 }
          : r
      ));

      if (remaining.length === 0) {
        setExpandedFiles(prev => {
          const next = new Set(prev);
          next.delete(editorSourcePath);
          return next;
        });
        setSaveNotice({
          kind: 'success',
          text: `Archivo resuelto: ${fileName(editorFilePath)}`,
        });
        setView('results');
      } else {
        setSaveNotice({
          kind: 'warning',
          text: `Se guardó el archivo, pero quedan ${remaining.length} inconsistencia${remaining.length === 1 ? '' : 's'}.`,
        });
      }
      setSaving(false);
    } catch (err) {
      setSaveError(String(err));
      setSaving(false);
    }
  }, [repoPath, editorFilePath, editorSourcePath, editorContent]);

  // ---- Shared styles ----

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 10px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  };

  const btnPrimary: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '12px',
    cursor: 'pointer',
  };

  // ---- Render ----

  return (
    <div className="modal-backdrop" onClick={handleDismiss}>
      <div
        className="modal inconsistency-modal"
        style={{
          maxWidth: view === 'editor' ? '900px' : '560px',
          width: '95vw',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: view === 'editor' ? '85vh' : undefined,
          maxHeight: view === 'editor' ? '85vh' : '80vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* VIEW: SELECT                                                   */}
        {/* ============================================================ */}
        {view === 'select' && (
          <>
            {/* Header */}
            <div style={headerStyle}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ color: 'var(--accent)' }}>
                    <path d="M6.5 1a5.5 5.5 0 1 0 3.38 9.82l2.65 2.65a.75.75 0 1 0 1.06-1.06l-2.65-2.65A5.5 5.5 0 0 0 6.5 1Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/>
                    <path d="M6.5 4a.5.5 0 0 1 .5.5v1.5H8.5a.5.5 0 0 1 0 1H7v1.5a.5.5 0 0 1-1 0V7H4.5a.5.5 0 0 1 0-1H6V4.5a.5.5 0 0 1 .5-.5Z"/>
                  </svg>
                  Revisar Inconsistencias
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--accent)' }}>{shortHash(commit.id)}</span>
                  {' — '}
                  {commit.message.split('\n')[0].slice(0, 60)}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', lineHeight: 0 }}
                title="Cerrar"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                </svg>
              </button>
            </div>

            {/* File list */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Archivos del commit
                </span>
                <button
                  onClick={toggleAllPaths}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', padding: 0 }}
                >
                  {selectedPaths.size === fileDiffs.length ? 'Desmarcar todo' : 'Seleccionar todo'}
                </button>
              </div>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '4px 0' }}>
              {fileDiffs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  Este commit no tiene archivos modificados.
                </div>
              ) : (
                fileDiffs.map(f => {
                  const parts = f.path.replace(/\\/g, '/').split('/');
                  const name = parts.pop() ?? f.path;
                  const dir = parts.join('/');
                  const checked = selectedPaths.has(f.path);
                  return (
                    <label
                      key={f.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '7px 16px',
                        cursor: 'pointer',
                        background: checked ? 'var(--bg-hover)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePath(f.path)}
                        style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {dir && <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{dir}/</span>}
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{name}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              <button style={btnSecondary} onClick={onClose}>Cancelar</button>
              <button
                style={{
                  ...btnPrimary,
                  opacity: selectedPaths.size === 0 || analyzing ? 0.6 : 1,
                  cursor: selectedPaths.size === 0 || analyzing ? 'not-allowed' : 'pointer',
                }}
                onClick={handleAnalyze}
                disabled={selectedPaths.size === 0 || analyzing}
              >
                {analyzing && <span className="spinner-sm" />}
                Analizar ({selectedPaths.size})
              </button>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* VIEW: RESULTS                                                  */}
        {/* ============================================================ */}
        {view === 'results' && (
          <>
            {/* Header */}
            <div style={headerStyle}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ color: 'var(--accent)' }}>
                  <path d="M6.5 1a5.5 5.5 0 1 0 3.38 9.82l2.65 2.65a.75.75 0 1 0 1.06-1.06l-2.65-2.65A5.5 5.5 0 0 0 6.5 1Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/>
                  <path d="M6.5 4a.5.5 0 0 1 .5.5v1.5H8.5a.5.5 0 0 1 0 1H7v1.5a.5.5 0 0 1-1 0V7H4.5a.5.5 0 0 1 0-1H6V4.5a.5.5 0 0 1 .5-.5Z"/>
                </svg>
                Resultados del análisis
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', lineHeight: 0 }}
                title="Cerrar"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {(() => {
                const totalInconsistencies = results.reduce((s, r) => s + r.inconsistencies.length, 0);
                if (
                  totalInconsistencies === 0 &&
                  results.every(r => !r.error) &&
                  !results.some(r => r.resolved)
                ) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '12px' }}>
                      <CheckIcon />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green)' }}>No se encontraron inconsistencias</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Se analizaron {results.length} archivo{results.length !== 1 ? 's' : ''} sin encontrar declaraciones ni líneas duplicadas.
                      </span>
                    </div>
                  );
                }

                return (
                  <>
                    {saveNotice && saveNotice.kind === 'success' && (
                      <div
                        style={{
                          margin: '4px 16px 8px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          background: 'rgba(74,222,128,0.1)',
                          border: '1px solid var(--green)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11px',
                          color: 'var(--green)',
                        }}
                      >
                        <CheckIcon />
                        <span>{saveNotice.text}</span>
                      </div>
                    )}

                    {results.map(fileResult => {
                  const isExpanded = expandedFiles.has(fileResult.path);
                  const count = fileResult.inconsistencies.length;
                  const isResolved = Boolean(fileResult.resolved) && count === 0;
                  const canExpand = count > 0 || Boolean(fileResult.error);

                  return (
                    <div key={fileResult.path} style={{ borderBottom: '1px solid var(--border)' }}>
                      {/* File header row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          cursor: canExpand ? 'pointer' : 'default',
                          background: isExpanded ? 'var(--bg-hover)' : 'transparent',
                          transition: 'background 0.1s',
                          userSelect: 'none',
                        }}
                        onClick={() => canExpand && toggleExpandFile(fileResult.path)}
                      >
                        {canExpand && <ChevronIcon expanded={isExpanded} />}
                        {count === 0 && !fileResult.error && (
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style={{ color: 'var(--green)', flexShrink: 0 }}>
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                          </svg>
                        )}
                        <span style={{ flex: 1, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fileName(fileResult.path)}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            {fileResult.path.includes('/') ? fileResult.path.substring(0, fileResult.path.lastIndexOf('/')) : ''}
                          </span>
                        </span>
                        {fileResult.error ? (
                          <span style={{ fontSize: '10px', color: 'var(--red)', background: 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Error</span>
                        ) : isResolved ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--green)', background: 'rgba(74,222,128,0.12)', padding: '2px 7px', borderRadius: '10px' }}>Resuelto</span>
                        ) : count > 0 ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--red)', background: 'rgba(248,113,113,0.12)', padding: '2px 7px', borderRadius: '10px' }}>
                            {count}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--green)', background: 'rgba(74,222,128,0.1)', padding: '2px 7px', borderRadius: '10px' }}>OK</span>
                        )}
                        {!fileResult.error && (
                          <button
                            style={{ ...btnPrimary, fontSize: '11px', padding: '4px 10px', flexShrink: 0 }}
                            onClick={e => { e.stopPropagation(); handleOpenEditor(fileResult); }}
                            title="Abrir el archivo y resaltar las líneas señaladas"
                          >
                            Editar archivo
                          </button>
                        )}
                      </div>

                      {/* Expanded content */}
                      {isExpanded && canExpand && (
                        <div style={{ background: 'var(--bg-base)', padding: '0 16px 10px' }}>
                          {fileResult.error ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', fontSize: '12px', color: 'var(--red)' }}>
                              <WarningIcon />
                              <span>No se pudo leer el archivo: {fileResult.error}</span>
                            </div>
                          ) : (
                            fileResult.inconsistencies.map((inc, idx) => {
                              const isDeclaration = inc.type === 'duplicate-declaration';
                              const label = isDeclaration ? inc.keyword : 'línea';
                              const text = isDeclaration ? inc.identifier : inc.lineText;

                              return (
                              <div
                                key={idx}
                                style={{
                                  borderLeft: '2px solid var(--red)',
                                  paddingLeft: '10px',
                                  marginTop: '8px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', minWidth: 0 }}>
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                                    {label}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      fontWeight: isDeclaration ? 700 : 400,
                                      fontFamily: 'var(--font-mono)',
                                      color: 'var(--text-primary)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      minWidth: 0,
                                    }}
                                    title={text}
                                  >
                                    {text.length > 90 ? `${text.slice(0, 90)}…` : text}
                                  </span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                    — {inc.occurrences.length} ocurrencias
                                  </span>
                                </div>
                                {inc.occurrences.map((occ, oidx) => (
                                  <div
                                    key={oidx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'baseline',
                                      gap: '8px',
                                      padding: '2px 0',
                                      fontSize: '11px',
                                      fontFamily: 'var(--font-mono)',
                                    }}
                                  >
                                    <span style={{ color: 'var(--accent)', minWidth: '32px', textAlign: 'right', flexShrink: 0 }}>
                                      {occ.line}
                                    </span>
                                    <span
                                      style={{
                                        color: 'var(--text-muted)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '380px',
                                      }}
                                      title={occ.lineContent}
                                    >
                                      {occ.lineContent.trim().slice(0, 100)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                    })}
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              <button style={btnSecondary} onClick={() => setView('select')}>Volver</button>
              <button style={btnSecondary} onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* VIEW: EDITOR                                                   */}
        {/* ============================================================ */}
        {view === 'editor' && (
          <>
            {/* Header */}
            <div style={headerStyle}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {fileName(editorFilePath)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                  {editorFilePath}
                </div>
              </div>
              <button
                onClick={handleDismiss}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', lineHeight: 0 }}
                title="Volver a resultados"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                </svg>
              </button>
            </div>

            {/* Editor body */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <ConflictCodeEditor
                value={editorContent}
                filePath={editorFilePath}
                onChange={setEditorContent}
                matchedLines={editorMatchedLines}
                ariaLabel="Editor de archivo"
                className="inconsistency-editor"
              />
            </div>

            {/* Save error */}
            {saveError && (
              <div style={{ padding: '6px 16px', background: 'rgba(248,113,113,0.1)', borderTop: '1px solid var(--red)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--red)' }}>
                <WarningIcon />
                <span>{saveError}</span>
              </div>
            )}

            {/* Resultado del guardado (quedan incidencias) */}
            {saveNotice && (
              <div
                style={{
                  padding: '6px 16px',
                  background: saveNotice.kind === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.12)',
                  borderTop: `1px solid ${saveNotice.kind === 'success' ? 'var(--green)' : 'var(--yellow)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  color: saveNotice.kind === 'success' ? 'var(--green)' : 'var(--yellow)',
                }}
              >
                <span>{saveNotice.text}</span>
              </div>
            )}

            {/* Footer */}
            <div style={footerStyle}>
              <button style={btnSecondary} onClick={handleDismiss}>Volver a resultados</button>
              <button
                style={{
                  ...btnPrimary,
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving && <span className="spinner-sm" />}
                Guardar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
