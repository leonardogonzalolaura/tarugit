import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';
import { getBranchIcon } from './CreateBranchModal';

interface BatchDeleteBranchesModalProps {
  repoPath: string;
  currentBranch: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function BatchDeleteBranchesModal({
  repoPath,
  currentBranch,
  onClose,
  onRefresh
}: BatchDeleteBranchesModalProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; msg: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBranches();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [repoPath]);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const result = await invoke<BranchInfo[]>('list_branches', { repoPath });
      setBranches(result.filter(b => !b.is_remote));
    } catch (e) {
      console.error('Error cargando ramas:', e);
    } finally {
      setLoading(false);
    }
  };

  const localBranches = useMemo(() => {
    let list = branches.filter(b => !b.is_remote);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q));
    }
    return list;
  }, [branches, query]);

  const allSelected = localBranches.length > 0 && localBranches.every(b => b.name === currentBranch || selected.has(b.name));

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(localBranches.filter(b => b.name !== currentBranch).map(b => b.name)));
    }
  };

  const handleDelete = async () => {
    setConfirmStep(false);
    setDeleting(true);
    setResults([]);
    const toDelete = Array.from(selected);
    const res: { name: string; ok: boolean; msg: string }[] = [];
    for (const name of toDelete) {
      try {
        const msg = await invoke<string>('delete_branch', { repoPath, branchName: name });
        res.push({ name, ok: true, msg });
      } catch (e) {
        res.push({ name, ok: false, msg: String(e) });
      }
    }
    setResults(res);
    setDeleting(false);
    setSelected(new Set());
    if (res.some(r => r.ok)) onRefresh();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!deleting) onClose();
        return;
      }
      if (confirmStep || deleting) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // skip current branch in nav
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [deleting, confirmStep, localBranches, currentBranch, onClose]);

  const renderBranchRow = (branch: BranchInfo) => {
    const isCurrent = branch.name === currentBranch;
    const isSelected = selected.has(branch.name);
    return (
      <div
        key={branch.name}
        onClick={() => !isCurrent && toggleSelect(branch.name)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          borderRadius: 4,
          cursor: isCurrent ? 'default' : 'pointer',
          opacity: isCurrent ? 0.5 : 1,
          background: isSelected ? 'var(--bg-hover)' : 'transparent',
          transition: 'background .1s',
        }}
        onMouseEnter={(e) => {
          if (!isCurrent && !isSelected) e.currentTarget.style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent';
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isCurrent}
          onChange={() => !isCurrent && toggleSelect(branch.name)}
          onClick={e => e.stopPropagation()}
          style={{ cursor: isCurrent ? 'default' : 'pointer', accentColor: 'var(--accent)' }}
        />
        <span className="branch-selector-item-icon" style={{
          color: branch.name.startsWith('feature/') ? 'var(--accent)'
            : branch.name.startsWith('fix/') ? 'var(--green)'
            : branch.name.startsWith('hotfix/') ? 'var(--red)'
            : undefined,
          display: 'flex',
        }}>
          {getBranchIcon(branch.name)}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {branch.name}
        </span>
        {isCurrent && (
          <span className="branch-selector-item-badge is-current" style={{ fontSize: 10 }}>actual</span>
        )}
      </div>
    );
  };

  const count = selected.size;

  return (
    <>
      <div className="modal-backdrop" onClick={deleting ? undefined : onClose}>
        <div
          className="modal"
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: 520,
            padding: 0,
            overflow: 'hidden',
            position: 'absolute',
            top: '15%',
          }}
        >
          {!confirmStep && results.length === 0 && (
            <>
              <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>🗑 Eliminar ramas</h3>
                  <button className="btn-close" onClick={onClose} disabled={deleting}>✕</button>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="🔍 Buscar rama..."
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelected(new Set()); }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: 13,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-muted)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={localBranches.filter(b => b.name !== currentBranch).length === 0 || deleting}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Seleccionar todas
                </label>
                <span>{localBranches.filter(b => b.name !== currentBranch).length} ramas</span>
              </div>

              <div
                ref={listRef}
                style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 8px' }}
              >
                {loading ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <span className="spinner-sm" /> Cargando ramas...
                  </div>
                ) : localBranches.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {query ? 'No se encontraron ramas' : 'No hay ramas locales disponibles'}
                  </div>
                ) : (
                  localBranches.map(renderBranchRow)
                )}
              </div>

              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: count > 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: count > 0 ? 600 : 400 }}>
                  {count > 0 ? `${count} rama${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}` : 'Ninguna rama seleccionada'}
                </span>
                <button
                  className="btn-primary"
                  disabled={count === 0 || deleting}
                  onClick={() => setConfirmStep(true)}
                  style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff', fontSize: 12, padding: '6px 14px' }}
                >
                  {deleting ? <span className="spinner-sm" /> : null} Eliminar
                </button>
              </div>
            </>
          )}

          {confirmStep && (
            <div style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>Confirmar eliminación</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Se eliminarán las siguientes <strong>{count}</strong> rama{count !== 1 ? 's' : ''}. Esta acción no se puede deshacer.
              </p>
              <div style={{ marginBottom: 16, maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Array.from(selected).map(name => (
                  <div key={name} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', padding: '4px 8px', background: 'var(--bg-surface)', borderRadius: 4 }}>
                    {name}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setConfirmStep(false)} disabled={deleting}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
                >
                  {deleting ? <span className="spinner-sm" /> : null} Confirmar eliminación
                </button>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Resultados</h3>
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
                {results.map(r => (
                  <div key={r.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 4,
                    background: r.ok ? 'rgba(60,200,100,0.08)' : 'rgba(220,60,60,0.08)',
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                  }}>
                    <span style={{ color: r.ok ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {r.ok ? '✓' : '✗'}
                    </span>
                    <span style={{ flex: 1 }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.ok ? 'Eliminada' : r.msg}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={onClose}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
