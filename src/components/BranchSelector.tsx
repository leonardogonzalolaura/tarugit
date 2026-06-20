// BranchSelector.tsx
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';

interface BranchSelectorProps {
  repoPath: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
  onBranchSwitch: () => void;
  onConflictOperation?: (op: { type: 'merge' | 'rebase' }) => void;
}

//type DirtyAction = 'carry' | 'cancel';

interface CreateBranchModalProps {
  branches: BranchInfo[];
  currentBranch: string;
  onCreate: (branchName: string, sourceBranch: string) => void;
  onClose: () => void;
}

function CreateBranchModal({ branches, currentBranch, onCreate, onClose }: CreateBranchModalProps) {
  const [branchName, setBranchName] = useState('');
  const [sourceBranch, setSourceBranch] = useState(currentBranch);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    setCreating(true);
    try {
      await onCreate(branchName.trim(), sourceBranch);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const localBranches = branches.filter(b => !b.is_remote && b.name !== sourceBranch);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">🌿</div>
        <h3 className="modal-title">Crear Nueva Rama</h3>
        <p className="modal-desc">Crea una rama a partir de otra existente:</p>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
              Nombre de la nueva rama
            </label>
            <input
              ref={inputRef}
              className="repo-input"
              style={{ margin: 0, width: '100%' }}
              placeholder="feature/nueva-funcionalidad"
              value={branchName}
              onChange={e => setBranchName(e.target.value)}
              disabled={creating}
            />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
              Crear desde la rama
            </label>
            <select
              value={sourceBranch}
              onChange={e => setSourceBranch(e.target.value)}
              disabled={creating}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              <option value={currentBranch}>{currentBranch} (actual)</option>
              {localBranches.map(branch => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={creating}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={creating || !branchName.trim()}>
              {creating ? <span className="spinner-sm" style={{ marginRight: '6px' }} /> : '✨'} Crear Rama
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRebaseModal, setShowRebaseModal] = useState(false);
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
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

    const confirmDelete = confirm(`¿Eliminar la rama "${branchName}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmDelete) return;

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

  const renderBranchRow = (branch: BranchInfo) => {
    const isCurrent = branch.name === currentBranch;
    return (
      <div key={branch.name} className="branch-selector-item">
        <div 
          className={`branch-selector-item-main ${isCurrent ? 'current' : ''}`}
          onClick={() => handleSwitch(branch.name)}
        >
          <div className="branch-selector-item-info">
            <span className="branch-selector-item-icon">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/>
              </svg>
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
            }}
            title="Copiar nombre de rama"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
            </svg>
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
                🗑️
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderDirtyModal()}
      {renderMergeModal()}
      {renderRebaseModal()}
      
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