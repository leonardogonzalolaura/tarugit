// BranchSelector.tsx
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';
import { CompareBranchesModal } from './CompareBranchesModal';
import { CreateBranchModal, getBranchIcon } from './CreateBranchModal';

interface BranchSelectorProps {
  repoPath: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
  onBranchSwitch: () => void;
  onConflictOperation?: (op: { type: 'merge' | 'rebase' }) => void;
}

export function BranchSelector({ 
  repoPath, 
  currentBranch, 
  hasUncommittedChanges, 
  onBranchSwitch,
  onConflictOperation 
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [switchingBranch, setSwitchingBranch] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dirtyTarget, setDirtyTarget] = useState<string | null>(null);
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<string | null>(null);
  const [copiedBranch, setCopiedBranch] = useState<string | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRebaseModal, setShowRebaseModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedBranchForAction, setSelectedBranchForAction] = useState<string | null>(null);
  const [displayBranch, setDisplayBranch] = useState(currentBranch);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Actualizar la rama mostrada cuando cambia currentBranch
  useEffect(() => {
    setDisplayBranch(currentBranch);
    setSwitchingBranch(null);
  }, [currentBranch]);

  useEffect(() => {
    if (isOpen && repoPath) {
      loadBranches();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, repoPath]);

  useEffect(() => {
    const h = () => { if (repoPath) { loadBranches(); setShowCompareModal(true); } };
    window.addEventListener('open-compare-branches', h);
    return () => window.removeEventListener('open-compare-branches', h);
  }, [repoPath]);

  useEffect(() => {
    const h = () => { if (repoPath) { loadBranches(); setShowCreateForm(true); } };
    window.addEventListener('create-branch', h);
    return () => window.removeEventListener('create-branch', h);
  }, [repoPath]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleKeyDown, true); };
  }, []);

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

  const handleSwitch = async (name: string) => {
    if (name === currentBranch) {
      setIsOpen(false);
      return;
    }

    if (hasUncommittedChanges) {
      setDirtyTarget(name);
      return;
    }

    await doSwitch(name, false);
  };

  const getLocalNameFromRemote = (remoteName: string): string => {
    const parts = remoteName.split('/');
    if (parts[0] === 'remotes') {
      return parts.slice(2).join('/');
    }
    return parts.slice(1).join('/');
  };

  const doSwitch = async (name: string, force: boolean) => {
    // Mostrar estado de carga inmediatamente
    setSwitchingBranch(name);
    setDisplayBranch(`↻ ${name}...`);
    setIsOpen(false);
    
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
            alert(`✅ Se cambió a la rama local "${localName}" y se actualizaron los cambios desde el remoto.`);
          } catch (pullErr) {
            alert(`⚠️ Se cambió a la rama "${localName}", pero no se pudieron traer los últimos cambios: ${pullErr}`);
          }
        } else {
          await invoke('checkout_remote_branch', { repoPath, branchName: name });
        }
      } else {
        const cmd = force ? 'switch_branch_force' : 'switch_branch';
        await invoke(cmd, { repoPath, branchName: name });
      }
      
      // Esperar un momento para que el backend procese
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Notificar al padre que la rama cambió
      onBranchSwitch();
      
      // Recargar las ramas para asegurar que todo esté sincronizado
      await loadBranches();
      
    } catch (e) {
      console.error('Error en switch:', e);
      const errStr = String(e);
      if (errStr === 'DIRTY_WORKING_TREE') {
        setDirtyTarget(name);
      } else {
        alert(`Error cambiando a rama "${name}":\n${e}`);
      }
      // Restaurar la rama mostrada en caso de error
      setDisplayBranch(currentBranch);
      setSwitchingBranch(null);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (branchName === currentBranch) {
      alert('❌ No puedes eliminar la rama activa');
      return;
    }

    setConfirmDeleteBranch(branchName);
  };

  const confirmDelete = async (branchName: string) => {
    setConfirmDeleteBranch(null);
    setDeleting(branchName);
    try {
      await invoke('delete_branch', { repoPath, branchName });
      alert(`✅ Rama "${branchName}" eliminada`);
      await loadBranches();
    } catch (e) {
      alert(`❌ Error al eliminar rama:\n${e}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleMerge = async (targetBranch: string) => {
    setLoading(true);
    try {
      const res = await invoke<string>('merge_branches', { repoPath, branchName: targetBranch });
      alert(`✅ Merge exitoso:\n${res}`);
      onBranchSwitch();
      setIsOpen(false);
      await loadBranches();
    } catch (err) {
      console.error('Error en merge:', err);
      const errStr = String(err);
      if (errStr.toLowerCase().includes('conflict')) {
        onConflictOperation?.({ type: 'merge' });
        onBranchSwitch();
      } else {
        alert(`⚠️ Error durante el Merge:\n${err}`);
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
      alert(`✅ Rebase exitoso:\n${res}`);
      onBranchSwitch();
      setIsOpen(false);
      await loadBranches();
    } catch (err) {
      console.error('Error en rebase:', err);
      const errStr = String(err);
      if (errStr.toLowerCase().includes('conflict')) {
        onConflictOperation?.({ type: 'rebase' });
        onBranchSwitch();
      } else {
        alert(`⚠️ Error durante el Rebase:\n${err}`);
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
      const shouldSwitch = confirm(`¿Deseas cambiar a la nueva rama "${branchName}"?`);
      if (shouldSwitch) {
        await doSwitch(branchName, false);
      }
      alert(`✅ Rama "${branchName}" creada exitosamente`);
      setShowCreateForm(false);
    } catch (e) {
      alert(`Error al crear rama: ${e}`);
      throw e;
    }
  };

  const handleFetch = async () => {
    setLoading(true);
    try {
      await invoke('fetch_remote_branches', { repoPath });
      alert('✅ Ramas remotas actualizadas (Fetch completado)');
      await loadBranches();
    } catch (e) {
      alert(`❌ Error al hacer fetch: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const localBranches = branches.filter(b => !b.is_remote);
  const remoteBranches = branches.filter(b => b.is_remote);

  const filteredLocal = search 
    ? localBranches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : localBranches;

  const filteredRemote = search
    ? remoteBranches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : remoteBranches;

  // Verificar si hay alguna operación en curso
  const isOperating = switchingBranch !== null || deleting !== null || loading;

  const renderDirtyModal = () => {
    if (!dirtyTarget) return null;
    return (
      <div className="branch-dirty-modal">
        <div className="branch-dirty-content">
          <h4>Cambios sin confirmar</h4>
          <p>Al cambiar a <strong>{dirtyTarget}</strong> tus cambios locales se perderán si no los confirmas o llevas contigo.</p>
          <div className="branch-dirty-actions">
            <button onClick={() => {
              setDirtyTarget(null);
              setIsOpen(false);
            }}>Cancelar</button>
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
      <div className="branch-action-modal">
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
      <div className="branch-action-modal">
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
      <div className="confirm-overlay" onClick={() => setConfirmDeleteBranch(null)}>
        <div className="confirm-box" onClick={e => e.stopPropagation()}>
          <h3 className="confirm-title confirm-title--danger">Eliminar rama</h3>
          <p className="confirm-body">
            ¿Estás seguro de eliminar la rama <strong>"{confirmDeleteBranch}"</strong>? Esta acción no se puede deshacer.
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

  const renderBranchRow = (branch: BranchInfo) => {
    const isCurrent = branch.name === currentBranch;
    return (
      <div key={branch.name} className="branch-selector-item">
        <div 
          className={`branch-selector-item-main ${isCurrent ? 'current' : ''}`}
          onClick={() => handleSwitch(branch.name)}
        >
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
                  setIsOpen(false);
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
                  setIsOpen(false);
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

  return (
    <>
      {renderDeleteConfirmModal()}
      {renderDirtyModal()}
      {renderMergeModal()}
      {renderRebaseModal()}
      
      {showCompareModal && (
        <CompareBranchesModal
          repoPath={repoPath}
          branches={branches}
          currentBranch={currentBranch}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {showCreateForm && (
        <CreateBranchModal
          branches={branches}
          currentBranch={currentBranch}
          onCreate={handleCreateBranch}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <div className="branch-selector" ref={dropdownRef}>
        <button 
          className="branch-selector-trigger"
          onClick={() => !isOperating && setIsOpen(!isOpen)}
          title="Cambiar de rama"
          disabled={isOperating}
        >
          <svg className="branch-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/>
          </svg>
          <span className="branch-selector-current">
            {displayBranch}
          </span>
          {isOperating ? (
            <span className="spinner-sm" style={{ marginLeft: '6px' }} />
          ) : (
            <span className="branch-selector-chevron">▼</span>
          )}
        </button>

        {isOpen && (
          <div className="branch-selector-dropdown">
            <div className="branch-selector-header">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="🔍 Buscar rama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="branch-selector-search"
              />
            </div>

            <div className="branch-selector-actions">
              <button 
                onClick={() => {
                  setShowCreateForm(true);
                  setIsOpen(false);
                }}
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
                onClick={() => {
                  setShowCompareModal(true);
                  setIsOpen(false);
                }}
                className="branch-selector-action-btn"
                disabled={isOperating}
              >
                📊 Comparar
              </button>
            </div>

            <div className="branch-selector-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {loading ? (
                <div className="branch-selector-loading">
                  <span className="spinner-sm" /> Cargando ramas...
                </div>
              ) : (
                <>
                  {filteredLocal.length === 0 && filteredRemote.length === 0 ? (
                    <div className="branch-selector-empty">
                      No se encontraron ramas
                    </div>
                  ) : (
                    <>
                      {filteredLocal.length > 0 && (
                        <>
                          <div className="branch-selector-section">Locales</div>
                          {filteredLocal.map(renderBranchRow)}
                        </>
                      )}
                      
                      {filteredRemote.length > 0 && (
                        <>
                          <div className="branch-selector-section border-top">Remotas</div>
                          {filteredRemote.map(renderBranchRow)}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}