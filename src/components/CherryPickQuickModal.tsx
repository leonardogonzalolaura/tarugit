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

export function CherryPickQuickModal({ repoPath, currentBranch, onClose, onRefresh }: CherryPickQuickModalProps) {
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());
  const [targetBranch, setTargetBranch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
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

  const handleApply = async () => {
    if (applying || selectedCommits.size === 0 || !targetBranch) return;
    setApplying(true);

    try {
      await invoke('switch_branch', { repoPath, branchName: targetBranch });
    } catch (e) {
      toast.error(`Error al cambiar a rama ${targetBranch}: ${e}`);
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
          toast.error(`Conflicto al aplicar ${commitId.slice(0, 7)} en ${targetBranch}.`);
          hasError = true;
          break;
        }
        toast.error(`Error en ${commitId.slice(0, 7)}: ${msg}`);
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      toast.success(`Cherry-pick completado en "${targetBranch}" (${selectedCommits.size} commit${selectedCommits.size > 1 ? 's' : ''})`);
    } else {
      toast.info(`Revisa los conflictos en la rama "${targetBranch}".`);
    }

    setApplying(false);
    onRefresh?.();
    onClose();
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

        <div style={{ padding: '8px 14px' }}>
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

        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 4px', minHeight: 0 }}>
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

        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>Destino:</label>
            <BranchCombo
              branches={localBranches.map(b => b.name)}
              value={targetBranch}
              onChange={setTargetBranch}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={applying || selectedCommits.size === 0 || !targetBranch}
            style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {applying ? <span className="spinner-sm" /> : '🍒'} ({selectedCommits.size})
          </button>
        </div>

        <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-muted)' }}>
          <span>↑↓ navegar</span>
          <span>Space seleccionar</span>
          <span>↲ cherry-pick</span>
          <span>ESC cerrar</span>
        </div>
      </div>
    </div>
  );
}
