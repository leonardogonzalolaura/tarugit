import { useState, useEffect, useRef } from 'react';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface SavedRepo {
  id: string;
  path: string;
  name: string;
  addedAt: number;
  lastOpenedAt: number;
  currentBranch?: string;
  hasChanges?: boolean;
}

interface RepoManagerProps {
  activeRepoPath: string;
  onSelectRepo: (path: string) => void;
  onCloneRepo: (url: string, targetPath: string) => void;
}

const STORAGE_KEY = 'tarugit_repos';

function loadSavedRepos(): SavedRepo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRepos(repos: SavedRepo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
}

function repoNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path;
}

// ── Subcomponente: ítem de repositorio ──────────────────────────────────────

// ── Componente principal: RepoManager ────────────────────────────────────────

function RepoItem({
  repo,
  isActive,
  onSelect,
  onRemove,
}: {
  repo: SavedRepo;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        cursor: 'pointer',
        borderRadius: '6px',
        border: `1px solid ${isActive ? 'var(--accent-dim)' : 'transparent'}`,
        background: isActive ? 'var(--bg-selected)' : 'transparent',
        transition: 'all 0.12s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.border = '1px solid var(--border-light)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.border = '1px solid transparent';
        }
      }}
    >
      {/* Ícono del repositorio */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: isActive ? 'var(--accent-dim)' : 'var(--bg-elevated)',
        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '15px',
        flexShrink: 0,
        transition: 'all 0.12s'
      }}>
        {isActive ? '📂' : '📁'}
      </div>

      {/* Info del repo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px',
          fontWeight: isActive ? 700 : 500,
          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {repo.name}
        </div>
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: '1px'
        }}>
          {repo.path}
        </div>

        {/* Fila de información (rama + cambios) y botón eliminar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between', // Esto empuja el botón a la derecha
          gap: '8px',
          marginTop: '3px',
          flexWrap: 'wrap'
        }}>
          {/* Grupo izquierdo: rama y cambios */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {repo.currentBranch && (
              <>
                <span style={{
                  fontSize: '9px',
                  background: repo.hasChanges ? 'var(--yellow-bg)' : 'var(--green-bg)',
                  color: repo.hasChanges ? 'var(--yellow)' : 'var(--green)',
                  border: `1px solid ${repo.hasChanges ? 'rgba(251,191,36,0.2)' : 'var(--green-border)'}`,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600
                }}>
                  {repo.currentBranch}
                </span>
                {repo.hasChanges && (
                  <span style={{ fontSize: '9px', color: 'var(--yellow)' }}>● cambios</span>
                )}
              </>
            )}
            {!repo.currentBranch && (
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Sin rama detectada
              </span>
            )}
          </div>

          {/* Botón eliminar - siempre visible a la derecha */}
          <button
            onClick={e => {
              e.stopPropagation();
              onRemove();
            }}
            title="Eliminar de la lista"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '12px',
              opacity: 0.4,
              transition: 'all 0.12s',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.color = 'var(--red)';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '0.4';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Indicador de activo */}
      {isActive && (
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 6px var(--accent)',
          flexShrink: 0
        }} />
      )}
    </div>
  );
}


export function RepoManager({ activeRepoPath, onSelectRepo, onCloneRepo }: RepoManagerProps) {
  const [repos, setRepos] = useState<SavedRepo[]>(loadSavedRepos);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [search, setSearch] = useState('');

  // Sincronizar cuando cambia el repo activo (actualizar lastOpenedAt)
  useEffect(() => {
    if (!activeRepoPath) return;
    setRepos(prev => {
      const exists = prev.find(r => r.path === activeRepoPath);
      if (!exists) return prev;
      const updated = prev.map(r =>
        r.path === activeRepoPath ? { ...r, lastOpenedAt: Date.now() } : r
      );
      saveRepos(updated);
      return updated;
    });
  }, [activeRepoPath]);

  const addRepo = (path: string, branchInfo?: { branch: string; hasChanges: boolean }) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    setRepos(prev => {
      const exists = prev.find(r => r.path === trimmed);
      if (exists) {
        // Solo actualizar si ya existe
        const updated = prev.map(r =>
          r.path === trimmed
            ? {
              ...r,
              lastOpenedAt: Date.now(),
              currentBranch: branchInfo?.branch ?? r.currentBranch,
              hasChanges: branchInfo?.hasChanges ?? r.hasChanges
            }
            : r
        );
        saveRepos(updated);
        return updated;
      }
      const newRepo: SavedRepo = {
        id: crypto.randomUUID(),
        path: trimmed,
        name: repoNameFromPath(trimmed),
        addedAt: Date.now(),
        lastOpenedAt: Date.now(),
        currentBranch: branchInfo?.branch,
        hasChanges: branchInfo?.hasChanges
      };
      const updated = [newRepo, ...prev];
      saveRepos(updated);
      return updated;
    });
  };

  const removeRepo = (id: string) => {
    setRepos(prev => {
      const updated = prev.filter(r => r.id !== id);
      saveRepos(updated);
      return updated;
    });
  };


  const handleSelectRepo = async (repo: SavedRepo) => {
    onSelectRepo(repo.path);
  };

  const filtered = search
    ? repos.filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.path.toLowerCase().includes(search.toLowerCase())
    )
    : repos;

  // Ordenar: activo primero, luego por último abierto
  const sorted = [...filtered].sort((a, b) => {
    if (a.path === activeRepoPath) return -1;
    if (b.path === activeRepoPath) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  return (
    <>
      {/* Modales */}
      {showAddModal && (
        <AddRepoModal
          onAdd={(path) => {
            addRepo(path);
            onSelectRepo(path);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {showCloneModal && (
        <CloneRepoModal
          onClone={(url, targetPath) => {
            onCloneRepo(url, targetPath);
            addRepo(targetPath);
            setShowCloneModal(false);
          }}
          onClose={() => setShowCloneModal(false)}
        />
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '35%',
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)'
      }}>
        {/* Cabecera */}
        <div style={{
          padding: '12px 12px 8px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)'
            }}>
              Repositorios
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setShowCloneModal(true)}
                title="Clonar repositorio"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  transition: 'all 0.12s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                📥
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                title="Agregar repositorio"
                style={{
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-dim)',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                  transition: 'all 0.12s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
              >
                ＋
              </button>
            </div>
          </div>

          {/* Buscador */}
          {repos.length > 3 && (
            <input
              className="search-input"
              placeholder="Filtrar repositorios..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: 0, fontSize: '11px', padding: '5px 10px' }}
            />
          )}
        </div>

        {/* Lista de repositorios */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {sorted.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              padding: '24px 12px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '36px' }}>🐮</span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Agrega un repositorio local<br />o clona uno nuevo para comenzar
              </p>
              <button
                className="btn-primary"
                onClick={() => setShowAddModal(true)}
                style={{ fontSize: '11px', padding: '6px 14px' }}
              >
                ＋ Agregar Repositorio
              </button>
            </div>
          ) : (
            sorted.map(repo => (
              <RepoItem
                key={repo.id}
                repo={repo}
                isActive={repo.path === activeRepoPath}
                onSelect={() => handleSelectRepo(repo)}
                onRemove={() => removeRepo(repo.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── Modal: Agregar repositorio local ─────────────────────────────────────────

function AddRepoModal({ onAdd, onClose }: { onAdd: (path: string) => void; onClose: () => void }) {
  const [path, setPath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    onAdd(path.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">📂</div>
        <h3 className="modal-title">Agregar Repositorio</h3>
        <p className="modal-desc">Ingresa la ruta de la carpeta del repositorio Git local:</p>
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            ref={inputRef}
            className="repo-input"
            style={{ margin: 0, width: '100%', fontSize: '12px', padding: '9px 12px' }}
            placeholder="C:\ruta\al\repositorio o /home/user/repo"
            value={path}
            onChange={e => setPath(e.target.value)}
          />
          {/* Ejemplos rápidos de rutas de usuario */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              '%USERPROFILE%\\Documents',
              '%USERPROFILE%\\Desktop',
            ].map(hint => (
              <button
                key={hint}
                type="button"
                onClick={() => setPath(prev => prev ? prev : hint)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: '9px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {hint}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!path.trim()}>
              📂 Abrir Repositorio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Clonar repositorio ─────────────────────────────────────────────────

function CloneRepoModal({ onClone, onClose }: { onClone: (url: string, path: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  // Auto-completar nombre del repo desde la URL
  useEffect(() => {
    if (!url) return;
    try {
      const parts = url.replace(/\.git$/, '').split('/');
      const repoName = parts[parts.length - 1];
      if (repoName) setTargetPath(prev => {
        if (!prev) return repoName;
        return prev;
      });
    } catch { }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !targetPath.trim()) return;
    onClone(url.trim(), targetPath.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">📥</div>
        <h3 className="modal-title">Clonar Repositorio</h3>
        <p className="modal-desc">Clona un repositorio remoto en tu máquina:</p>
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
              URL del repositorio
            </label>
            <input
              ref={urlRef}
              className="repo-input"
              style={{ margin: 0, width: '100%' }}
              placeholder="https://github.com/usuario/repo.git"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
              Carpeta destino (ruta local)
            </label>
            <input
              className="repo-input"
              style={{ margin: 0, width: '100%' }}
              placeholder="C:\proyectos\mi-repo"
              value={targetPath}
              onChange={e => setTargetPath(e.target.value)}
            />
          </div>
          <div className="modal-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!url.trim() || !targetPath.trim()}>
              ⬇️ Clonar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
