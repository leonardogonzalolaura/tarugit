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

  // Filtrar solo ramas locales (sin incluir remotas)
  const localBranches = branches.filter(b => !b.is_remote);

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
              placeholder="ejemplo: feature/nueva-funcionalidad"
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
              {localBranches.map(branch => (
                <option key={branch.name} value={branch.name}>
                  {branch.name} {branch.name === currentBranch ? ' (actual)' : ''}
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
  const [search, setSearch] = useState('');
  const [dirtyTarget, setDirtyTarget] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, [repoPath, currentBranch]);

  const handleFetchRemotes = async () => {
    setLoading(true);
    try {
      // Mostrar mensaje de que está actualizando
      const fetchPromise = invoke('fetch_remote_branches', { repoPath });

      // Timeout opcional para no esperar demasiado
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );

      await Promise.race([fetchPromise, timeoutPromise]);

      await loadBranches();
      alert('✅ Ramas remotas actualizadas');
    } catch (e) {
      if (String(e).includes('Timeout')) {
        alert('⚠️ La actualización está tomando más tiempo de lo normal. Las ramas se cargarán cuando termine.');
        // Continuar en segundo plano
        invoke('fetch_remote_branches', { repoPath }).finally(() => {
          loadBranches();
          alert('✅ Actualización completada en segundo plano');
        });
      } else {
        alert(`Error al actualizar remotas: ${e}`);
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
      console.log('Ramas cargadas en BranchManager:', result);
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
  /**
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setCreating(true);
    try {
      await invoke('create_branch', { repoPath, branchName: newBranchName.trim() });
      const name = newBranchName.trim();
      setNewBranchName('');
      setShowCreateForm(false);
      await loadBranches();
      await handleSwitch(name);
    } catch (e) {
      alert(`Error al crear rama: ${e}`);
    } finally {
      setCreating(false);
    }
  };
**/
  const handleDeleteBranch = async (branchName: string) => {
    if (branchName === currentBranch) {
      alert('❌ No puedes eliminar la rama activa. Cambia a otra rama primero.');
      return;
    }

    const confirmDelete = confirm(`¿Estás seguro de eliminar la rama local "${branchName}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmDelete) return;

    setDeletingBranch(branchName);
    try {
      await invoke('delete_branch', { repoPath, branchName });
      alert(`✅ Rama "${branchName}" eliminada correctamente`);
      await loadBranches();
      if (expandedBranch === branchName) {
        setExpandedBranch(null);
      }
    } catch (e) {
      alert(`❌ Error al eliminar rama:\n${e}`);
    } finally {
      setDeletingBranch(null);
    }
  };

  const handleMerge = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!confirm(`¿Deseas fusionar (Merge) los cambios de la rama "${name}" en tu rama actual "${currentBranch}"?`)) return;
    setLoading(true);
    try {
      const res = await invoke<string>('merge_branches', { repoPath, branchName: name });
      alert(`✅ Merge exitoso:\n${res}`);
      onBranchSwitch();
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

  const handleRebase = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!confirm(`¿Deseas hacer Rebase de tu rama actual "${currentBranch}" sobre la rama "${name}"?`)) return;
    setLoading(true);
    try {
      const res = await invoke<string>('rebase_branches', { repoPath, branchName: name });
      alert(`✅ Rebase exitoso:\n${res}`);
      onBranchSwitch();
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

  const handleCheckoutRemote = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!confirm(`¿Deseas descargar y rastrear la rama remota "${name}" en local?`)) return;
    setLoading(true);
    try {
      await invoke('checkout_remote_branch', { repoPath, branchName: name });
      alert(`✅ Rama ${name} configurada localmente.`);
      await loadBranches();
    } catch (err) {
      alert(`⚠️ Error al configurar rama remota:\n${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePushBranch = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!confirm(`¿Deseas publicar la rama local "${name}" al repositorio remoto?`)) return;
    setLoading(true);
    try {
      const result = await invoke<string>('push_branch', { repoPath, branchName: name });
      alert(`✅ ${result}`);
      await loadBranches();
    } catch (err) {
      alert(`⚠️ Error al hacer push de la rama:\n${err}`);
    } finally {
      setLoading(false);
    }
  };

  const local = branches.filter((b: BranchInfo) => !b.is_remote);
  const remote = branches.filter((b: BranchInfo) => b.is_remote);

  const filterBranches = (list: BranchInfo[]) =>
    search ? list.filter((b: BranchInfo) => b.name.toLowerCase().includes(search.toLowerCase())) : list;

  return (
    <div className="panel-container">
      {dirtyTarget && (
        <DirtyModal targetBranch={dirtyTarget} onChoice={handleDirtyChoice} />
      )}

      <div className="panel-header">
        <div className="panel-header-right">
          <button
            className="btn-icon"
            onClick={handleFetchRemotes}
            title="Actualizar ramas remotas (fetch)"
          >
            📡
          </button>
        </div>
        <h2 className="panel-title">🌿 Ramas</h2>
        <div className="panel-header-right">
          <button
            className={`btn-icon ${showCreateForm ? 'active' : ''}`}
            onClick={() => setShowCreateForm(!showCreateForm)}
            title="Crear nueva rama"
          >
            ＋
          </button>
          <button className="btn-icon" onClick={loadBranches} title="Recargar ramas">↻</button>
        </div>
      </div>

      {/* Modal de creación de rama */}
      {showCreateForm && (
        <CreateBranchModal
          branches={branches}
          currentBranch={currentBranch}
          onCreate={async (branchName, sourceBranch) => {
            try {
              await invoke('create_branch', { repoPath, branchName, sourceBranch });
              await loadBranches();
              // Opcional: cambiar automáticamente a la nueva rama
              const shouldSwitch = confirm(`¿Deseas cambiar a la nueva rama "${branchName}"?`);
              if (shouldSwitch) {
                await doSwitch(branchName, false);
              }
              alert(`✅ Rama "${branchName}" creada exitosamente desde "${sourceBranch}"`);
            } catch (e) {
              alert(`Error al crear rama: ${e}`);
            }
          }}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <input
        className="search-input"
        placeholder="Buscar rama..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '10px' }}
      />

      {loading ? (
        <div className="panel-loading"><span className="spinner" /> Cargando ramas...</div>
      ) : (
        <>
          <div className="branch-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="branch-group-label">LOCAL ({filterBranches(local).length})</div>
            {filterBranches(local).map((branch: BranchInfo) => {
              const isExpanded = expandedBranch === branch.name;
              return (
                <div key={branch.name} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    className={`branch-item ${branch.is_current ? 'current' : ''}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: branch.is_current ? 'var(--bg-selected)' : 'transparent',
                      cursor: branch.is_current ? 'default' : 'pointer',
                      border: '1px solid transparent',
                    }}
                    onClick={() => {
                      if (!branch.is_current) {
                        setExpandedBranch(isExpanded ? null : branch.name);
                      }
                    }}
                    onMouseEnter={e => {
                      if (!branch.is_current) {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.border = '1px solid var(--border-light)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!branch.is_current) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.border = '1px solid transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <span className="branch-icon">{branch.is_current ? '●' : '○'}</span>
                      <span className="branch-name" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: branch.is_current ? 600 : 400,
                        color: branch.is_current ? 'var(--accent)' : 'var(--text-primary)'
                      }}>{branch.name}</span>
                      {branch.is_current && <span className="branch-badge">actual</span>}
                      {switching === branch.name && <span className="spinner-sm" />}
                      {deletingBranch === branch.name && <span style={{ fontSize: '11px', color: 'var(--yellow)' }}>eliminando...</span>}
                    </div>
                    
                    {branch.is_current && (
                      <button
                        onClick={(e) => handlePushBranch(e, branch.name)}
                        title="Publicar / Hacer Push de la rama actual"
                        style={{
                          background: 'var(--accent)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 'bold'
                        }}
                      >
                        🚀 Push
                      </button>
                    )}

                    {!branch.is_current && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBranch(branch.name);
                        }}
                        disabled={deletingBranch === branch.name}
                        title={`Eliminar rama ${branch.name}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'red',
                          cursor: deletingBranch === branch.name ? 'wait' : 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '14px',
                          opacity: 0.5,
                          transition: 'all 0.12s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onMouseEnter={e => {
                          if (deletingBranch !== branch.name) {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.color = 'var(--red)';
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.opacity = '0.5';
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {isExpanded && !branch.is_current && (
                    <div className="branch-actions-tray" style={{
                      display: 'flex',
                      gap: '8px',
                      padding: '8px 12px 10px 24px',
                      background: 'var(--bg-elevated)',
                      borderBottomLeftRadius: 'var(--radius-sm)',
                      borderBottomRightRadius: 'var(--radius-sm)',
                      borderLeft: '2px solid var(--accent)'
                    }}>
                      <button
                        className="btn-secondary"
                        onClick={() => handleSwitch(branch.name)}
                        style={{ padding: '4px 10px', fontSize: '11px', flex: 1 }}
                      >
                        🔌 Cambiar a esta rama
                      </button>
                      <button
                        className="btn-primary"
                        onClick={(e) => handleMerge(e, branch.name)}
                        style={{ padding: '4px 10px', fontSize: '11px', flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
                      >
                        🔀 Merge
                      </button>
                      <button
                        className="btn-primary"
                        onClick={(e) => handleRebase(e, branch.name)}
                        style={{ padding: '4px 10px', fontSize: '11px', flex: 1, background: 'var(--yellow-bg)', color: 'var(--yellow)', borderColor: 'rgba(251,191,36,0.2)' }}
                      >
                        🔄 Rebase
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filterBranches(local).length === 0 && (
              <div className="branch-empty">Sin resultados</div>
            )}
          </div>

          {remote.length > 0 && (
            <div className="branch-group" style={{ marginTop: '16px' }}>
              <div className="branch-group-label">REMOTAS ({filterBranches(remote).length})</div>
              {filterBranches(remote).map((branch: BranchInfo) => {
                const isExpanded = expandedBranch === branch.name;
                return (
                  <div key={branch.name} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      className="branch-item remote"
                      onClick={() => setExpandedBranch(isExpanded ? null : branch.name)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid transparent'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.border = '1px solid var(--border-light)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.border = '1px solid transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="branch-icon">⬡</span>
                        <span className="branch-name">{branch.name}</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="branch-actions-tray" style={{
                        display: 'flex',
                        gap: '8px',
                        padding: '8px 12px 10px 24px',
                        background: 'var(--bg-elevated)',
                        borderBottomLeftRadius: 'var(--radius-sm)',
                        borderBottomRightRadius: 'var(--radius-sm)',
                        borderLeft: '2px solid var(--text-muted)'
                      }}>
                        <button
                          className="btn-secondary"
                          onClick={(e) => handleCheckoutRemote(e, branch.name)}
                          style={{ padding: '4px 10px', fontSize: '11px', flex: 1, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        >
                          📥 Obtener rama a local (Checkout)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
