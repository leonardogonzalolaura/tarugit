import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';
import { CompareBranchesModal } from './CompareBranchesModal';
import { CreateBranchModal, getBranchIcon } from './CreateBranchModal';

interface QuickBranchModalProps {
  repoPath: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
  onBranchSwitch: () => void;
  onConflictOperation?: (op: { type: 'merge' | 'rebase' }) => void;
  onClose: () => void;
}

export function QuickBranchModal({
  repoPath,
  currentBranch,
  hasUncommittedChanges,
  onBranchSwitch: onBranchSwitchProp,
  onConflictOperation,
  onClose
}: QuickBranchModalProps) {
  const [query, setQuery] = useState('');
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dirtyTarget, setDirtyTarget] = useState<string | null>(null);
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<string | null>(null);
  const [copiedBranch, setCopiedBranch] = useState<string | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showRebaseModal, setShowRebaseModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedBranchForAction, setSelectedBranchForAction] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (repoPath) loadBranches();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [repoPath]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const hasSubModal = showCreateForm || showCompareModal ||
    dirtyTarget !== null || showMergeModal || showRebaseModal ||
    confirmDeleteBranch !== null;

  const localBranches = branches.filter(b => !b.is_remote);
  const remoteBranches = branches.filter(b => b.is_remote);

  const filteredLocal = query
    ? localBranches.filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
    : localBranches;

  const filteredRemote = query
    ? remoteBranches.filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
    : remoteBranches;

  const flatFiltered = useMemo(() => {
    const items: BranchInfo[] = [];
    if (filteredLocal.length > 0) items.push(...filteredLocal);
    if (filteredRemote.length > 0) items.push(...filteredRemote);
    return items;
  }, [filteredLocal, filteredRemote]);

  const isOperating = deleting !== null || loading;

  const getLocalNameFromRemote = (remoteName: string): string => {
    const parts = remoteName.split('/');
    if (parts[0] === 'remotes') return parts.slice(2).join('/');
    return parts.slice(1).join('/');
  };

  const loadBranches = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const result = await invoke<BranchInfo[]>('list_branches', { repoPath });
      setBranches(result);
    } catch (e) {
      console.error('Error cargando ramas:', e);
    } finally {
      setLoading(false);
    }
  };

  const doSwitch = async (name: string, force: boolean) => {
    onClose();
    try {
      const targetBranchInfo = branches.find(b => b.name === name);
      if (targetBranchInfo?.is_remote) {
        const localName = getLocalNameFromRemote(name);
        const localExists = branches.some(b => !b.is_remote && b.name === localName);
        if (localExists) {
          const cmd = force ? 'switch_branch_force' : 'switch_branch';
          await invoke(cmd, { repoPath, branchName: localName });
          try {
            await invoke('pull_branch', { repoPath, branchName: localName });
          } catch {}
        } else {
          await invoke('checkout_remote_branch', { repoPath, branchName: name });
        }
      } else {
        const cmd = force ? 'switch_branch_force' : 'switch_branch';
        await invoke(cmd, { repoPath, branchName: name });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      onBranchSwitchProp();
    } catch (e) {
      console.error('Error en switch:', e);
      const errStr = String(e);
      if (errStr !== 'DIRTY_WORKING_TREE') {
        alert(`Error cambiando a rama "${name}":\n${e}`);
      }
    }
  };

  const handleSwitch = (name: string) => {
    if (name === currentBranch) {
      onClose();
      return;
    }
    if (hasUncommittedChanges) {
      setDirtyTarget(name);
      return;
    }
    doSwitch(name, false);
  };

  const handleDeleteBranch = (branchName: string) => {
    if (branchName === currentBranch) {
      alert('No puedes eliminar la rama activa');
      return;
    }
    setConfirmDeleteBranch(branchName);
  };

  const confirmDelete = async (branchName: string) => {
    setConfirmDeleteBranch(null);
    setDeleting(branchName);
    try {
      await invoke('delete_branch', { repoPath, branchName });
      await loadBranches();
    } catch (e) {
      alert(`Error al eliminar rama:\n${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleMerge = async (targetBranch: string) => {
    setLoading(true);
    try {
      const res = await invoke<string>('merge_branches', { repoPath, branchName: targetBranch });
      onClose();
      alert(`Merge exitoso:\n${res}`);
      onBranchSwitchProp();
    } catch (err) {
      console.error('Error en merge:', err);
      const errStr = String(err);
      if (errStr.toLowerCase().includes('conflict')) {
        onClose();
        onConflictOperation?.({ type: 'merge' });
        onBranchSwitchProp();
      } else {
        alert(`Error durante el Merge:\n${err}`);
      }
    } finally {
      setLoading(false);
      setShowMergeModal(false);
      setSelectedBranchForAction(null);
    }
  };

  const handleRebase = async (targetBranch: string) => {
    setLoading(true);
    try {
      const res = await invoke<string>('rebase_branches', { repoPath, branchName: targetBranch });
      onClose();
      alert(`Rebase exitoso:\n${res}`);
      onBranchSwitchProp();
    } catch (err) {
      console.error('Error en rebase:', err);
      const errStr = String(err);
      if (errStr.toLowerCase().includes('conflict')) {
        onClose();
        onConflictOperation?.({ type: 'rebase' });
        onBranchSwitchProp();
      } else {
        alert(`Error durante el Rebase:\n${err}`);
      }
    } finally {
      setLoading(false);
      setShowRebaseModal(false);
      setSelectedBranchForAction(null);
    }
  };

  const handleCreateBranch = async (branchName: string, sourceBranch: string) => {
    try {
      await invoke('create_branch', { repoPath, branchName, sourceBranch });
      await loadBranches();
      const shouldSwitch = confirm(`Deseas cambiar a la nueva rama "${branchName}"?`);
      if (shouldSwitch) {
        onClose();
        await doSwitch(branchName, false);
      } else {
        setShowCreateForm(false);
      }
    } catch (e) {
      alert(`Error al crear rama: ${e}`);
      throw e;
    }
  };

  const handleFetch = async () => {
    setLoading(true);
    try {
      await invoke('fetch_remote_branches', { repoPath });
      await loadBranches();
    } catch (e) {
      alert(`Error al hacer fetch: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!hasSubModal) {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (hasSubModal) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, Math.max(0, flatFiltered.length - 1)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && flatFiltered[selectedIndex]) {
        e.preventDefault();
        handleSwitch(flatFiltered[selectedIndex].name);
        return;
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [flatFiltered, selectedIndex, hasSubModal, currentBranch, hasUncommittedChanges]);

  const scrollIntoViewIfNeeded = (index: number) => {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-index]');
    if (items && items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  useEffect(() => {
    scrollIntoViewIfNeeded(selectedIndex);
  }, [selectedIndex]);

  const getBranchIndex = (branch: BranchInfo): number => {
    return flatFiltered.indexOf(branch);
  };

  const renderBranchRow = (branch: BranchInfo) => {
    const isCurrent = branch.name === currentBranch;
    const idx = getBranchIndex(branch);
    const isSelected = idx === selectedIndex;
    return (
      <div
        key={branch.name}
        data-index={idx}
        className={`branch-selector-item ${isSelected ? 'qbm-highlight' : ''}`}
        onMouseEnter={() => !hasSubModal && setSelectedIndex(idx)}
        onClick={() => !isOperating && handleSwitch(branch.name)}
        style={{
          cursor: isOperating ? 'default' : 'pointer',
          background: isSelected ? 'var(--bg-hover)' : 'transparent',
        }}
      >
        <div className={`branch-selector-item-main ${isCurrent ? 'current' : ''}`}>
          <div className="branch-selector-item-info">
            <span className="branch-selector-item-icon" style={{
              color: branch.name.startsWith('feature/') ? 'var(--accent)'
                : branch.name.startsWith('fix/') ? 'var(--green)'
                : branch.name.startsWith('hotfix/') ? 'var(--red)'
                : undefined
            }}>
              {getBranchIcon(branch.name)}
            </span>
            <span className="branch-selector-item-name">
              {branch.name}
            </span>
            {isCurrent && (
              <span className="branch-selector-item-badge is-current">actual</span>
            )}
            {branch.is_remote && (
              <span className="branch-selector-item-badge is-remote">remota</span>
            )}
          </div>
        </div>

        <div className="branch-selector-item-actions">
          <button
            className="branch-action-icon"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(branch.name);
              setCopiedBranch(branch.name);
              setTimeout(() => setCopiedBranch(null), 1500);
            }}
            title="Copiar nombre de rama"
          >
            {copiedBranch === branch.name ? (
              <svg viewBox="0 0 16 16" width="12" height="12" fill="var(--green)">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.042-1.018.751.751 0 0 1 .018 1.042L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
              </svg>
            )}
          </button>
          {!isCurrent && !branch.is_remote && (
            <>
              <button
                className="branch-action-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBranchForAction(branch.name);
                  setShowMergeModal(true);
                }}
                title="Fusionar en rama actual"
                disabled={isOperating}
              >
                🔀
              </button>
              <button
                className="branch-action-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBranchForAction(branch.name);
                  setShowRebaseModal(true);
                }}
                title="Rebase sobre rama actual"
                disabled={isOperating}
              >
                🔄
              </button>
              <button
                className="branch-action-icon delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBranch(branch.name);
                }}
                title="Eliminar rama"
                disabled={deleting === branch.name || isOperating}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                  <path d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1 0-1.5H5V1.75A1.75 1.75 0 0 1 6.75 0h2.5A1.75 1.75 0 0 1 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.75 1.75 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15Z"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDirtyModal = () => {
    if (!dirtyTarget) return null;
    return (
      <div className="branch-dirty-modal" style={{ zIndex: 10001 }}>
        <div className="branch-dirty-content">
          <h4>Cambios sin confirmar</h4>
          <p>Al cambiar a <strong>{dirtyTarget}</strong> tus cambios locales se perderán si no los confirmas o llevas contigo.</p>
          <div className="branch-dirty-actions">
            <button onClick={() => setDirtyTarget(null)}>Cancelar</button>
            <button onClick={async () => {
              const target = dirtyTarget;
              setDirtyTarget(null);
              if (target) await doSwitch(target, true);
            }}>Llevar cambios</button>
          </div>
        </div>
      </div>
    );
  };

  const renderMergeModal = () => {
    if (!showMergeModal) return null;
    return (
      <div className="branch-action-modal" style={{ zIndex: 10001 }}>
        <div className="branch-action-content">
          <h4>Merge</h4>
          <p>Fusionar <strong>{selectedBranchForAction}</strong> en <strong>{currentBranch}</strong></p>
          <div className="branch-action-actions">
            <button onClick={() => setShowMergeModal(false)}>Cancelar</button>
            <button onClick={() => selectedBranchForAction && handleMerge(selectedBranchForAction)}>
              Crear merge commit
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRebaseModal = () => {
    if (!showRebaseModal) return null;
    return (
      <div className="branch-action-modal" style={{ zIndex: 10001 }}>
        <div className="branch-action-content">
          <h4>Rebase</h4>
          <p>Esto actualizará <strong>{currentBranch}</strong> aplicando sus commits sobre la punta de <strong>{selectedBranchForAction}</strong>, resultando en un historial lineal.</p>
          <div className="branch-action-actions">
            <button onClick={() => setShowRebaseModal(false)}>Cancelar</button>
            <button onClick={() => selectedBranchForAction && handleRebase(selectedBranchForAction)}>
              Iniciar rebase
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteConfirmModal = () => {
    if (!confirmDeleteBranch) return null;
    return (
      <div className="confirm-overlay" onClick={() => setConfirmDeleteBranch(null)} style={{ zIndex: 10001 }}>
        <div className="confirm-box" onClick={e => e.stopPropagation()}>
          <h3 className="confirm-title confirm-title--danger">Eliminar rama</h3>
          <p className="confirm-body">
            Estás seguro de eliminar la rama <strong>"{confirmDeleteBranch}"</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="confirm-actions">
            <button className="btn-secondary" onClick={() => setConfirmDeleteBranch(null)}>Cancelar</button>
            <button
              className="btn-primary"
              style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
              onClick={() => confirmDelete(confirmDeleteBranch)}
              disabled={deleting !== null}
            >
              {deleting ? <span className="spinner-sm" /> : null} Eliminar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
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
          <div style={{ padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="🔍 Buscar rama..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { setShowCreateForm(true); }}
                className="branch-selector-action-btn"
                disabled={isOperating}
              >
                + Crear rama
              </button>
              <button
                onClick={handleFetch}
                className="branch-selector-action-btn"
                disabled={isOperating}
              >
                🔄 Fetch
              </button>
              <button
                onClick={() => { setShowCompareModal(true); }}
                className="branch-selector-action-btn"
                disabled={isOperating}
              >
                📊 Comparar
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            style={{
              maxHeight: 320,
              overflowY: 'auto',
              padding: '0 6px 6px',
            }}
          >
            {loading ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <span className="spinner-sm" /> Cargando ramas...
              </div>
            ) : filteredLocal.length === 0 && filteredRemote.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {query ? 'No se encontraron ramas' : 'No hay ramas disponibles'}
              </div>
            ) : (
              <>
                {filteredLocal.length > 0 && (
                  <>
                    <div className="branch-selector-section" style={{ fontSize: 11, padding: '8px 10px 4px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Locales
                    </div>
                    {filteredLocal.map(b => renderBranchRow(b))}
                  </>
                )}
                {filteredRemote.length > 0 && (
                  <>
                    <div className="branch-selector-section border-top" style={{ fontSize: 11, padding: '8px 10px 4px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: filteredLocal.length > 0 ? '1px solid var(--border)' : 'none', marginTop: filteredLocal.length > 0 ? 4 : 0 }}>
                      Remotas
                    </div>
                    {filteredRemote.map(b => renderBranchRow(b))}
                  </>
                )}
              </>
            )}
          </div>

          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 14,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <span>↑↓ navegar</span>
            <span>↲ cambiar</span>
            <span>ESC cerrar</span>
          </div>
        </div>
      </div>

      {renderDirtyModal()}
      {renderMergeModal()}
      {renderRebaseModal()}
      {renderDeleteConfirmModal()}

      {showCreateForm && (
        <CreateBranchModal
          branches={branches}
          currentBranch={currentBranch}
          onCreate={handleCreateBranch}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {showCompareModal && (
        <CompareBranchesModal
          repoPath={repoPath}
          branches={branches}
          currentBranch={currentBranch}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </>
  );
}
