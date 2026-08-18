import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';
import { toast } from './Toast';

interface CommitEntry {
  id: string;
  message: string;
  author: string;
  timestamp: number;
}

interface CherryPickQuickModalProps {
  repoPath: string;
  currentBranch?: string;
  onClose: () => void;
  onRefresh?: () => void;
  onConflictOperation?: (op: { type: 'cherry-pick' }) => void;
}

function BranchCombo({ branches, value, onChange }: {
  branches: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = filter
    ? branches.filter(b => b.toLowerCase().includes(filter.toLowerCase()))
    : branches;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div style={{ flex: 1, position: 'relative', minWidth: 0 }} ref={ref}>
      <div
        className="pr-combo-trigger"
        onClick={() => { setOpen(v => !v); setFilter(''); setHl(0); }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{value || 'Seleccionar...'}</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>▼</span>
      </div>
      {open && (
        <div className="pr-combo-dropdown" style={{ top: 'auto', bottom: '100%', marginTop: 0, marginBottom: 4 }} >
          <input
            className="pr-combo-search"
            placeholder="Filtrar ramas..."
            value={filter}
            autoFocus
            onChange={e => { setFilter(e.target.value); setHl(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHl(i => Math.min(i + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHl(i => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && filtered[hl]) { onChange(filtered[hl]); setOpen(false); }
              if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
            }}
          />
          <div className="pr-combo-list">
            {filtered.length === 0 ? (
              <div className="pr-combo-empty">Sin resultados</div>
            ) : (
              filtered.map((b, i) => (
                <div
                  key={b}
                  className={`pr-combo-item${i === hl ? ' hl' : ''}${b === value ? ' selected' : ''}`}
                  onClick={() => { onChange(b); setOpen(false); }}
                  onMouseEnter={() => setHl(i)}
                >{b}</div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CherryPickQuickModal({ repoPath, currentBranch, onClose, onRefresh, onConflictOperation }: CherryPickQuickModalProps) {
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());
  const [targetBranch, setTargetBranch] = useState('');
  const [copyMode, setCopyMode] = useState(true);
  const [copySuffix, setCopySuffix] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [pushDecision, setPushDecision] = useState<'idle' | 'asking'>('idle');
  const [pushExists, setPushExists] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [commitBranch, setCommitBranch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      invoke<CommitEntry[]>('get_commit_history_with_timestamp', { repoPath }),
      invoke<BranchInfo[]>('list_branches', { repoPath }),
    ]).then(([c, b]) => {
      setCommits(c);
      const locals = b.filter(br => !br.is_remote);
      setBranches(locals);
      if (currentBranch) {
        setTargetBranch(currentBranch);
      } else if (locals.length > 0) {
        const cur = locals.find(br => br.is_current);
        setTargetBranch(cur?.name ?? locals[0].name);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [repoPath]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    } else {
      modalRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (selectedCommits.size === 0) {
      setCommitBranch('');
      return;
    }
    const first = [...selectedCommits][0];
    invoke<string[]>('get_commit_branches', { repoPath, commitId: first })
      .then(branches => {
        if (cancelled) return;
        const locals = branches.filter(b => !b.includes('remotes/'));
        setCommitBranch(locals[0] ?? '');
      })
      .catch(() => {
        if (!cancelled) setCommitBranch('');
      });
    return () => { cancelled = true; };
  }, [selectedCommits, repoPath]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commits;
    const q = query.toLowerCase();
    return commits.filter(c =>
      c.message.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }, [query, commits]);

  const toggleCommit = (id: string) => {
    setSelectedCommits(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === ' ' && filtered[highlightIdx]) {
      e.preventDefault();
      toggleCommit(filtered[highlightIdx].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!applying && selectedCommits.size > 0 && targetBranch) {
        handleApply();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const nameBase = commitBranch || targetBranch;
  const copyName = nameBase && copySuffix.trim() ? `${nameBase}-${copySuffix.trim()}` : '';

  const promptDeleteTempBranch = async (tempBranch: string) => {
    const ok = window.confirm(
      `Se creó la rama temporal "${tempBranch}" con el respaldo de "${targetBranch}" local.\n\n¿Eliminarla?`
    );
    if (ok) {
      try {
        await invoke('delete_branch', { repoPath, branchName: tempBranch });
        toast.success(`Rama temporal "${tempBranch}" eliminada.`);
      } catch (e) {
        toast.error(`No se pudo eliminar la rama temporal "${tempBranch}": ${e}`);
      }
    } else {
      toast.info(`Rama temporal "${tempBranch}" conservada. Puedes eliminarla luego.`);
    }
  };

  const syncBaseFromRemote = async () => {
    const result = await invoke<{ message: string; temp_branch: string | null }>('sync_branch_from_remote', {
      repoPath,
      branchName: targetBranch,
    });
    toast.success(result.message);
    if (result.temp_branch) {
      await promptDeleteTempBranch(result.temp_branch);
    }
  };

  const handleApply = async () => {
    if (applying || selectedCommits.size === 0 || !targetBranch) return;
    if (copyMode && !copySuffix.trim()) {
      toast.error('Escribe un sufijo para la rama copia.');
      return;
    }
    if (copyMode && branches.some(b => b.name === copyName)) {
      toast.error(`La rama "${copyName}" ya existe.`);
      return;
    }
    setApplying(true);

    const actualBranch = copyMode ? copyName : targetBranch;

    if (copyMode) {
      try {
        await syncBaseFromRemote();
      } catch (e) {
        toast.error(`No se pudo actualizar "${targetBranch}" desde el remoto: ${e}`);
        setApplying(false);
        return;
      }

      try {
        await invoke('create_branch', { repoPath, branchName: actualBranch, sourceBranch: targetBranch });
      } catch (e) {
        toast.error(`Error al crear la copia "${actualBranch}": ${e}`);
        setApplying(false);
        return;
      }
    }

    try {
      await invoke('switch_branch', { repoPath, branchName: actualBranch });
    } catch (e) {
      toast.error(`Error al cambiar a rama ${actualBranch}: ${e}`);
      setApplying(false);
      return;
    }

    let hasError = false;
    const ordered = [...selectedCommits].reverse();

    for (const commitId of ordered) {
      try {
        await invoke('cherry_pick_commit', { repoPath, commitId });
      } catch (e) {
        const msg = String(e);
        if (msg.includes('CONFLICT')) {
          toast.error(`Conflicto al aplicar ${commitId.slice(0, 7)} en ${actualBranch}.`);
          hasError = true;
          break;
        }
        toast.error(`Error en ${commitId.slice(0, 7)}: ${msg}`);
        hasError = true;
        break;
      }
    }

    if (hasError) {
      onConflictOperation?.({ type: 'cherry-pick' });
      toast.info(`Revisa los conflictos en la rama "${actualBranch}".`);
      setApplying(false);
      onRefresh?.();
      onClose();
      return;
    }

    if (!copyMode) {
      toast.success(`Cherry-pick completado en "${actualBranch}" (${selectedCommits.size} commit${selectedCommits.size > 1 ? 's' : ''})`);
      setApplying(false);
      onRefresh?.();
      onClose();
      return;
    }

    toast.success(`Cherry-pick completado en la rama copia "${actualBranch}".`);
    setApplying(false);

    try {
      const status = await invoke<{ ahead: number; behind: number; has_remote: boolean }>('get_branch_remote_status', {
        repoPath,
        branchName: actualBranch,
      });
      setPushExists(status.has_remote);
      setPushDecision('asking');
    } catch {
      setPushDecision('idle');
      onRefresh?.();
      onClose();
    }
  };

  const handlePush = async (force: boolean) => {
    if (pushLoading) return;
    setPushLoading(true);
    setPushDecision('asking');
    try {
      await invoke('push_branch', { repoPath, branchName: copyName, force });
      toast.success(`Rama "${copyName}" ${force ? 'forzada y ' : ''}publicada en el remoto.`);
    } catch (e) {
      toast.error(`Error al publicar "${copyName}": ${e}`);
    } finally {
      onRefresh?.();
      onClose();
    }
  };

  const localBranches = branches.filter(b => !b.is_remote);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        tabIndex={-1}
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ maxWidth: 560, padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px 8px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>🍒 Cherry-Pick Rápido</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: .3 }}>
            1 · Selecciona commits
          </div>
          <div style={{ padding: '6px 14px 4px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="🔍 Buscar commit por mensaje, autor o hash..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', fontSize: 13,
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px 6px', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Cargando commits...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {query ? 'No se encontraron commits' : 'No hay commits en este repositorio'}
              </div>
            ) : (
              filtered.map((c, i) => {
                const selected = selectedCommits.has(c.id);
                const highlighted = i === highlightIdx;
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleCommit(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                      background: selected ? 'var(--bg-selected)' : highlighted ? 'var(--bg-hover)' : 'transparent',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)', fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0 }}>
                      {selected ? '☑' : '☐'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>
                      {c.id.slice(0, 7)}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {c.message.split('\n')[0]}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{c.author}</span>
                  </div>
                );
              })
            )}
          </div>

          {selectedCommits.size > 0 && (
            <div style={{ padding: '4px 14px', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
              {selectedCommits.size} seleccionado{selectedCommits.size > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: .3 }}>
          2 · Elige destino
        </div>

        <div style={{ padding: '6px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-hover)', borderRadius: 6, padding: 3 }}>
            <button
              onClick={() => { setCopyMode(true); setPushDecision('idle'); }}
              disabled={applying || pushDecision === 'asking'}
              style={{
                flex: 1, padding: '6px 8px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                border: copyMode ? '1px solid var(--accent)' : '1px solid transparent',
                background: copyMode ? 'var(--bg-selected)' : 'transparent',
                color: copyMode ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: copyMode ? 600 : 400,
              }}
            >
              🐑 Crear rama copia
            </button>
            <button
              onClick={() => { setCopyMode(false); setPushDecision('idle'); }}
              disabled={applying || pushDecision === 'asking'}
              style={{
                flex: 1, padding: '6px 8px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                border: !copyMode ? '1px solid var(--accent)' : '1px solid transparent',
                background: !copyMode ? 'var(--bg-selected)' : 'transparent',
                color: !copyMode ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: !copyMode ? 600 : 400,
              }}
            >
              🎯 Aplicar en rama
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0, width: 86 }}>
              {copyMode ? 'Base de la copia:' : 'Rama destino:'}
            </label>
            <BranchCombo
              branches={localBranches.map(b => b.name)}
              value={targetBranch}
              onChange={setTargetBranch}
            />
          </div>

          {copyMode && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0, width: 86 }}>Sufijo:</label>
                <input
                  type="text"
                  placeholder="ej. victor, hotfix-qas"
                  value={copySuffix}
                  onChange={e => setCopySuffix(e.target.value)}
                  disabled={applying}
                  style={{
                    flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 12,
                    border: '1px solid var(--border)', borderRadius: 4,
                    background: 'var(--bg-surface)', color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', borderRadius: 5, background: 'var(--bg-hover)', border: '1px dashed var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Se creará:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: copyName ? 'var(--accent)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {copyName || 'rama-del-commit-sufijo'}
                </span>
              </div>
              <div style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                {commitBranch ? (
                  <>Se actualiza <strong style={{ color: 'var(--text-secondary)' }}>{targetBranch}</strong> desde el remoto, se saca una copia con el nombre basado en <strong style={{ color: 'var(--text-secondary)' }}>{commitBranch}</strong> (rama del commit seleccionado), y se aplican los commits ahí.</>
                ) : (
                  <>Se actualiza {targetBranch} desde el remoto y se saca una copia con los commits. {targetBranch && <>El nombre usa la rama del commit seleccionado; si no se detecta, se toma <strong style={{ color: 'var(--text-secondary)' }}>{targetBranch}</strong> como base.</>}</>
                )}
              </div>
            </>
          )}
        </div>

        {pushDecision === 'asking' && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'rgba(110,127,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {pushExists
                ? <>La rama <strong style={{ color: 'var(--text-primary)' }}>{copyName}</strong> ya existe en el remoto. ¿Qué deseas hacer?</>
                : <>La rama <strong style={{ color: 'var(--text-primary)' }}>{copyName}</strong> no está publicada. ¿Publicarla?</>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {pushExists ? (
                <>
                  <button className="btn-secondary" onClick={() => handlePush(false)} disabled={pushLoading} style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}>
                    {pushLoading ? <span className="spinner-sm" /> : '⬆'} Push normal
                  </button>
                  <button className="btn-secondary" onClick={() => handlePush(true)} disabled={pushLoading} style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderColor: 'var(--red-border)', color: 'var(--red)' }}>
                    {pushLoading ? <span className="spinner-sm" /> : '⚠'} Force push
                  </button>
                </>
              ) : (
                <button className="btn-primary" onClick={() => handlePush(false)} disabled={pushLoading} style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}>
                  {pushLoading ? <span className="spinner-sm" /> : '⬆'} Publicar
                </button>
              )}
              <button className="btn-close" onClick={() => { onRefresh?.(); onClose(); }} disabled={pushLoading} style={{ padding: '6px 10px', fontSize: 12 }}>
                Omitir
              </button>
            </div>
          </div>
        )}

        {pushLoading && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
            <span className="spinner-sm" /> Publicando "{copyName}" en el remoto...
          </div>
        )}

        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={applying || selectedCommits.size === 0 || !targetBranch || (copyMode && !copySuffix.trim()) || pushDecision === 'asking' || pushLoading}
            style={{ flex: 1, fontSize: 12, padding: '7px 12px', whiteSpace: 'nowrap' }}
            title={copyMode && !copySuffix.trim() ? 'Escribe un sufijo para la rama copia' : undefined}
          >
            {applying ? <span className="spinner-sm" /> : '🍒'} Aplicar ({selectedCommits.size})
          </button>
          <button className="btn-secondary" onClick={onClose} disabled={applying || pushLoading} style={{ fontSize: 12, padding: '7px 12px' }}>
            Cancelar
          </button>
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-muted)' }}>
          <span>↑↓ navegar</span>
          <span>Space seleccionar</span>
          <span>↲ aplicar</span>
          <span>ESC cerrar</span>
        </div>
      </div>
    </div>
  );
}
