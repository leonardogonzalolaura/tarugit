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

type DirtyAction = 'carry' | 'cancel';

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

  const doSwitch = async (name: string, force: boolean) => {
    // Mostrar estado de carga inmediatamente
    setSwitchingBranch(name);
    setDisplayBranch(`↻ ${name}...`);
    setIsOpen(false);
    
    try {
      const targetBranchInfo = branches.find(b => b.name === name);
      if (targetBranchInfo?.is_remote) {
        await invoke('checkout_remote_branch', { repoPath, branchName: name });
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
          <div className="branch-dirty-icon">⚠️</div>
          <h4>Cambios sin commitear</h4>
          <p>¿Qué deseas hacer al cambiar a <strong>{dirtyTarget}</strong>?</p>
          <div className="branch-dirty-actions">
            <button onClick={() => {
              setDirtyTarget(null);
              setIsOpen(false);
            }}>Cancelar</button>
            <button onClick={async () => {
              const target = dirtyTarget;
              setDirtyTarget(null);
              if (target) await doSwitch(target, true);
            }}>🚀 Llevar cambios</button>
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
          <h4>🔀 Fusionar rama</h4>
          <p>Fusionar <strong>{selectedBranchForAction}</strong> en <strong>{currentBranch}</strong></p>
          <div className="branch-action-actions">
            <button onClick={() => setShowMergeModal(false)}>Cancelar</button>
            <button onClick={() => selectedBranchForAction && handleMerge(selectedBranchForAction)}>
              Confirmar Merge
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
          <h4>🔄 Rebase</h4>
          <p>Rebase de <strong>{currentBranch}</strong> sobre <strong>{selectedBranchForAction}</strong></p>
          <div className="branch-action-actions">
            <button onClick={() => setShowRebaseModal(false)}>Cancelar</button>
            <button onClick={() => selectedBranchForAction && handleRebase(selectedBranchForAction)}>
              Confirmar Rebase
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
          style={{ cursor: 'pointer' }}
        >
          <div className="branch-selector-item-info">
            <span className="branch-selector-item-icon">
              {isCurrent ? '●' : branch.is_remote ? '☁️' : '○'}
            </span>
            <span className="branch-selector-item-name" style={{ wordBreak: 'break-all' }}>
              {branch.name}
            </span>
            {isCurrent && (
              <span className="branch-selector-item-badge">actual</span>
            )}
            {branch.is_remote && (
              <span className="branch-selector-item-badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>remota</span>
            )}
          </div>
        </div>
        
        {!isCurrent && !branch.is_remote && (
          <div className="branch-selector-item-actions">
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
          </div>
        )}
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
          <span className="branch-dot" />
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

            <div className="branch-selector-actions" style={{ display: 'flex', gap: '8px', padding: '8px' }}>
              <button 
                onClick={() => {
                  setShowCreateForm(true);
                  setIsOpen(false);
                }}
                className="branch-selector-action-btn"
                style={{ flex: 1 }}
                disabled={isOperating}
              >
                ✨ Crear rama
              </button>
              <button 
                onClick={handleFetch}
                className="branch-selector-action-btn"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                disabled={isOperating}
              >
                🔄 Fetch remotas
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
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '6px 12px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Ramas Locales
                          </div>
                          {filteredLocal.map(renderBranchRow)}
                        </>
                      )}
                      
                      {filteredRemote.length > 0 && (
                        <>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '10px 12px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border-light)' }}>
                            Ramas Remotas
                          </div>
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