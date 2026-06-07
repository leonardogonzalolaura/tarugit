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

interface DirtyModalProps {
  targetBranch: string;
  onChoice: (action: DirtyAction) => void;
}

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
      // El error ya se maneja en el callback
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
  const [switching, setSwitching] = useState<string | null>(null);
  const [dirtyTarget, setDirtyTarget] = useState<string | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRebaseModal, setShowRebaseModal] = useState(false);
  const [selectedBranchForAction, setSelectedBranchForAction] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    setSwitching(name);
    try {
      const cmd = force ? 'switch_branch_force' : 'switch_branch';
      await invoke(cmd, { repoPath, branchName: name });
      onBranchSwitch();
      setIsOpen(false);
      await loadBranches();
    } catch (e) {
      const errStr = String(e);
      if (errStr === 'DIRTY_WORKING_TREE') {
        setDirtyTarget(name);
      } else {
        alert(`Error cambiando a rama "${name}":\n${e}`);
      }
    } finally {
      setSwitching(null);
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


  const localBranches = branches.filter(b => !b.is_remote);
  const filteredBranches = search 
    ? localBranches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : localBranches;

  const DirtyModal = () => (
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
            const target = dirtyTarget!;
            setDirtyTarget(null);
            await doSwitch(target, true);
          }}>🚀 Llevar cambios</button>
        </div>
      </div>
    </div>
  );

  const MergeModal = () => (
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

  const RebaseModal = () => (
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

  return (
    <>
      {dirtyTarget && <DirtyModal />}
      {showMergeModal && <MergeModal />}
      {showRebaseModal && <RebaseModal />}
      
            {showCreateForm && (
        <CreateBranchModal
          branches={branches}
          currentBranch={currentBranch}
          onCreate={async (branchName, sourceBranch) => {
            try {
              await invoke('create_branch', { repoPath, branchName, sourceBranch });
              await loadBranches();
              const shouldSwitch = confirm(`¿Deseas cambiar a la nueva rama "${branchName}"?`);
              if (shouldSwitch) {
                await doSwitch(branchName, false);
              }
              alert(`✅ Rama "${branchName}" creada exitosamente`);
            } catch (e) {
              alert(`Error al crear rama: ${e}`);
            }
          }}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <div className="branch-selector" ref={dropdownRef}>
        <button 
          className="branch-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
          title="Cambiar de rama"
        >
          <span className="branch-dot" />
          <span className="branch-selector-current">{currentBranch}</span>
          <span className="branch-selector-chevron">▼</span>
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
              onClick={() => setShowCreateForm(true)}
              className="branch-selector-action-btn">
                ✨ Crear nueva rama
              </button>
            </div>

            <div className="branch-selector-list">
              {loading ? (
                <div className="branch-selector-loading">
                  <span className="spinner-sm" /> Cargando ramas...
                </div>
              ) : (
                <>
                  {filteredBranches.map(branch => (
                    <div key={branch.name} className="branch-selector-item">
                      <div 
                        className={`branch-selector-item-main ${branch.name === currentBranch ? 'current' : ''}`}
                        onClick={() => handleSwitch(branch.name)}
                      >
                        <div className="branch-selector-item-info">
                          <span className="branch-selector-item-icon">
                            {branch.name === currentBranch ? '●' : '○'}
                          </span>
                          <span className="branch-selector-item-name">{branch.name}</span>
                          {branch.name === currentBranch && (
                            <span className="branch-selector-item-badge">actual</span>
                          )}
                          {switching === branch.name && (
                            <span className="spinner-sm" />
                          )}
                        </div>
                      </div>
                      
                      {branch.name !== currentBranch && (
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
                          >
                            🔄
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}