import { useState } from 'react';
import { RepoInfo } from '../types';

interface SidebarProps {
  repoPath: string;
  repoInfo: RepoInfo | null;
  loading: boolean;
  onRepoPathChange: (path: string) => void;
  onOpenRepo: () => void;
  onCloneRepo: (url: string) => void;
}

export function Sidebar({
  repoPath,
  repoInfo,
  loading,
  onRepoPathChange,
  onOpenRepo,
  onCloneRepo,
}: SidebarProps) {
  const [showClone, setShowClone] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');

  const handleClone = () => {
    if (!cloneUrl || !repoPath) {
      alert('Ingresa URL y carpeta destino');
      return;
    }
    onCloneRepo(cloneUrl);
    setCloneUrl('');
    setShowClone(false);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <label className="sidebar-label">Repositorio</label>
        <input
          type="text"
          placeholder="Ruta del repositorio..."
          value={repoPath}
          onChange={(e) => onRepoPathChange(e.target.value)}
          disabled={loading}
          className="repo-input"
          onKeyDown={(e) => e.key === 'Enter' && onOpenRepo()}
        />
        <div className="sidebar-actions">
          <button
            onClick={onOpenRepo}
            disabled={loading || !repoPath}
            className="btn-primary"
          >
            📂 Abrir
          </button>
          <button
            onClick={() => setShowClone(!showClone)}
            disabled={loading}
            className="btn-secondary"
          >
            📥 Clonar
          </button>
        </div>

        {showClone && (
          <div className="clone-panel">
            <input
              type="text"
              placeholder="https://github.com/usuario/repo.git"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              disabled={loading}
              className="repo-input"
            />
            <button
              onClick={handleClone}
              disabled={loading || !cloneUrl}
              className="btn-success"
            >
              ⬇ Clonar repositorio
            </button>
          </div>
        )}
      </div>

      {!repoInfo && (
        <div className="sidebar-empty">
          <span style={{ fontSize: 48 }}>🐮</span>
          <p>Abre o clona un repositorio para comenzar</p>
        </div>
      )}
    </div>
  );
}
