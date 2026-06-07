import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BranchInfo } from '../types';

interface BranchManagerProps {
  repoPath: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
  onBranchSwitch: () => void;
  onConflictOperation?: (op: { type: 'merge' | 'rebase' }) => void;
}

type DirtyAction = 'carry' | 'cancel';

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

interface MergeRebaseModalProps {
  type: 'merge' | 'rebase';
  branches: BranchInfo[];
  currentBranch: string;
  onConfirm: (targetBranch: string) => void;
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

function DirtyModal({ targetBranch, onChoice }: DirtyModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon">⚠️</div>
        <h3 className="modal-title">Cambios sin commitear</h3>
        <p className="modal-desc">
          Tienes cambios que no has commiteado. ¿Qué deseas hacer al cambiar a{' '}
          <code className="modal-branch">{targetBranch}</code>?
        </p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => onChoice('cancel')}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => onChoice('carry')}>
            🚀 Llevar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

function MergeRebaseModal({ type, branches, currentBranch, onConfirm, onClose }: MergeRebaseModalProps) {
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // Filtrar ramas locales que no sean la actual
  const availableBranches = branches.filter(b => !b.is_remote && b.name !== currentBranch);
  
  const handleConfirm = () => {
    if (selectedBranch) {
      onConfirm(selectedBranch);
      onClose();
    }
  };

  const title = type === 'merge' ? 'Fusionar Rama' : 'Rebase';
  const icon = type === 'merge' ? '🔀' : '🔄';
  const description = type === 'merge' 
    ? `Fusionar los cambios de otra rama en ${currentBranch}`
    : `Aplicar los cambios de ${currentBranch} sobre otra rama`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">{icon}</div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-desc">{description}</p>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
            {type === 'merge' ? 'Rama a fusionar' : 'Rama objetivo'}
          </label>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
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
            <option value="">Selecciona una rama...</option>
            {availableBranches.map(branch => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={!selectedBranch}
          >
            {icon} Confirmar {type === 'merge' ? 'Merge' : 'Rebase'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BranchManager({
  repoPath,
  currentBranch,
  hasUncommittedChanges,
  onBranchSwitch,
  onConflictOperation
}: BranchManagerProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [dirtyTarget, setDirtyTarget] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showRebaseModal, setShowRebaseModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'merge' | 'rebase', target: string } | null>(null);

  useEffect(() => {
    loadBranches();
  }, [repoPath, currentBranch]);

  const handleFetchRemotes = async () => {
    setLoading(true);
    try {
      const fetchPromise = invoke('fetch_remote_branches', { repoPath });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );
      await Promise.race([fetchPromise, timeoutPromise]);
      await loadBranches();
      alert('✅ Ramas remotas actualizadas');
    } catch (e) {
      if (String(e).includes('Timeout')) {
        alert('⚠️ La actualización está tomando más tiempo de lo normal.');
        invoke('fetch_remote_branches', { repoPath }).finally(() => {
          loadBranches();
          alert('✅ Actualización completada');
        });
      } else {
        alert(`Error: ${e}`);
      }
    } finally {
      setLoading(false);
    }
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

  const handleSwitch = async (name: string) => {
    if (name === currentBranch) return;

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

  const handleDirtyChoice = async (action: DirtyAction) => {
    const target = dirtyTarget!;
    setDirtyTarget(null);
    if (action === 'cancel') return;
    await doSwitch(target, true);
  };

  const handleMerge = async (targetBranch: string) => {
    setLoading(true);
    try {
      const res = await invoke<string>('merge_branches', { repoPath, branchName: targetBranch });
      alert(`✅ Merge exitoso:\n${res}`);
      onBranchSwitch();
      await loadBranches();
    } catch (err) {
      const errStr = String(err);
      if (
        errStr.toLowerCase().includes('conflict') ||
        errStr.toLowerCase().includes('CONFLICT') ||
        errStr.toLowerCase().includes('conflicto')
      ) {
        onConflictOperation?.({ type: 'merge' });
        onBranchSwitch();
      } else {
        alert(`⚠️ Error durante el Merge:\n${err}`);
        onBranchSwitch();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRebase = async (targetBranch: string) => {
    setLoading(true);
    try {
      const res = await invoke<string>('rebase_branches', { repoPath, branchName: targetBranch });
      alert(`✅ Rebase exitoso:\n${res}`);
      onBranchSwitch();
      await loadBranches();
    } catch (err) {
      const errStr = String(err);
      if (
        errStr.toLowerCase().includes('conflict') ||
        errStr.toLowerCase().includes('CONFLICT') ||
        errStr.toLowerCase().includes('conflicto')
      ) {
        onConflictOperation?.({ type: 'rebase' });
        onBranchSwitch();
      } else {
        alert(`⚠️ Error durante el Rebase:\n${err}`);
        onBranchSwitch();
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePushBranch = async () => {
    if (!confirm(`¿Deseas publicar la rama local "${currentBranch}" al repositorio remoto?`)) return;
    setLoading(true);
    try {
      const result = await invoke<string>('push_branch', { repoPath, branchName: currentBranch });
      alert(`✅ ${result}`);
      await loadBranches();
    } catch (err) {
      alert(`⚠️ Error al hacer push:\n${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePullBranch = async () => {
    if (!confirm(`¿Deseas traer los últimos cambios del remoto para "${currentBranch}"?`)) return;
    setLoading(true);
    try {
      const result = await invoke<string>('pull_branch', { repoPath, branchName: currentBranch });
      alert(`✅ ${result}`);
      onBranchSwitch();
      await loadBranches();
    } catch (err) {
      alert(`⚠️ Error al hacer pull:\n${err}`);
    } finally {
      setLoading(false);
    }
  };

  const localBranches = branches.filter(b => !b.is_remote);
  const remoteBranches = branches.filter(b => b.is_remote);

  return (
    <div className="branch-manager">
      {dirtyTarget && (
        <DirtyModal targetBranch={dirtyTarget} onChoice={handleDirtyChoice} />
      )}

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

      {showMergeModal && (
        <MergeRebaseModal
          type="merge"
          branches={branches}
          currentBranch={currentBranch}
          onConfirm={handleMerge}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      {showRebaseModal && (
        <MergeRebaseModal
          type="rebase"
          branches={branches}
          currentBranch={currentBranch}
          onConfirm={handleRebase}
          onClose={() => setShowRebaseModal(false)}
        />
      )}

      {/* Header con acciones principales */}
      <div className="branch-header">
        <div className="branch-info-section">
          <div className="current-branch-info">
            <span className="branch-icon-current">🌿</span>
            <span className="current-branch-name">{currentBranch}</span>
            <span className="branch-status-badge">actual</span>
          </div>
          
          <div className="branch-actions-bar">
            <button 
              className="action-btn primary" 
              onClick={handlePushBranch}
              title="Publicar cambios"
            >
              🚀 Push
            </button>
            <button 
              className="action-btn" 
              onClick={handlePullBranch}
              title="Traer cambios"
            >
              📥 Pull
            </button>
            <button 
              className="action-btn" 
              onClick={() => setShowMergeModal(true)}
              title="Fusionar rama"
            >
              🔀 Merge
            </button>
            <button 
              className="action-btn" 
              onClick={() => setShowRebaseModal(true)}
              title="Rebase"
            >
              🔄 Rebase
            </button>
            <button 
              className="action-btn success" 
              onClick={() => setShowCreateForm(true)}
              title="Crear rama"
            >
              ✨ Nueva
            </button>
          </div>
        </div>

        <div className="branch-remote-actions">
          <button 
            className="icon-btn" 
            onClick={handleFetchRemotes}
            title="Actualizar ramas remotas"
            disabled={loading}
          >
            📡 Fetch
          </button>
          <button 
            className="icon-btn" 
            onClick={loadBranches}
            title="Recargar"
            disabled={loading}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Selector de cambio rápido de rama estilo GitHub */}
      <div className="branch-switcher">
        <div className="switcher-header">
          <span className="switcher-label">Cambiar a otra rama</span>
        </div>
        <div className="switcher-select-wrapper">
          <select 
            className="branch-select"
            onChange={(e) => {
              if (e.target.value) {
                handleSwitch(e.target.value);
                e.target.value = ''; // Reset
              }
            }}
            value=""
          >
            <option value="" disabled>🔍 Selecciona una rama...</option>
            {localBranches.map(branch => (
              <option key={branch.name} value={branch.name} disabled={branch.name === currentBranch}>
                {branch.name} {branch.name === currentBranch ? '(actual)' : ''}
              </option>
            ))}
          </select>
          <span className="switcher-shortcut">⌘K</span>
        </div>
      </div>

      {/* Lista de ramas estilo GitHub */}
      <div className="branches-container">
        {loading ? (
          <div className="loading-state">
            <span className="spinner" />
            <span>Cargando ramas...</span>
          </div>
        ) : (
          <>
            {/* Ramas Locales */}
            <div className="branch-section">
              <div className="section-header">
                <h3 className="section-title">Ramas locales</h3>
                <span className="section-count">{localBranches.length}</span>
              </div>
              <div className="branch-list">
                {localBranches.map(branch => (
                  <div 
                    key={branch.name} 
                    className={`branch-row ${branch.name === currentBranch ? 'active' : ''}`}
                  >
                    <div className="branch-row-main">
                      <div className="branch-row-info">
                        <span className="branch-icon">
                          {branch.name === currentBranch ? '●' : '○'}
                        </span>
                        <div className="branch-details">
                          <span className="branch-name">{branch.name}</span>
                          {branch.name === currentBranch && (
                            <span className="active-badge">Activa</span>
                          )}
                        </div>
                      </div>
                      
                      {branch.name !== currentBranch && (
                        <button 
                          className="checkout-btn"
                          onClick={() => handleSwitch(branch.name)}
                          disabled={switching === branch.name}
                        >
                          {switching === branch.name ? 'Cambiando...' : 'Cambiar'}
                        </button>
                      )}
                      
                      {branch.name === currentBranch && (
                        <div className="current-actions">
                          <button 
                            className="action-mini-btn"
                            onClick={handlePushBranch}
                            title="Push"
                          >
                            🚀
                          </button>
                          <button 
                            className="action-mini-btn"
                            onClick={handlePullBranch}
                            title="Pull"
                          >
                            📥
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ramas Remotas */}
            {remoteBranches.length > 0 && (
              <div className="branch-section">
                <div className="section-header">
                  <h3 className="section-title">Ramas remotas</h3>
                  <span className="section-count">{remoteBranches.length}</span>
                </div>
                <div className="branch-list">
                  {remoteBranches.slice(0, 5).map(branch => (
                    <div key={branch.name} className="branch-row remote">
                      <div className="branch-row-main">
                        <div className="branch-row-info">
                          <span className="branch-icon">📡</span>
                          <span className="branch-name">{branch.name}</span>
                        </div>
                        <button 
                          className="checkout-btn secondary"
                          onClick={async () => {
                            try {
                              await invoke('checkout_remote_branch', { repoPath, branchName: branch.name });
                              alert(`✅ Rama ${branch.name} configurada localmente`);
                              await loadBranches();
                            } catch (err) {
                              alert(`Error: ${err}`);
                            }
                          }}
                        >
                          Descargar
                        </button>
                      </div>
                    </div>
                  ))}
                  {remoteBranches.length > 5 && (
                    <div className="more-remote-branches">
                      +{remoteBranches.length - 5} ramas remotas más
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}