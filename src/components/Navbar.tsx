import { RepoInfo, ActivePanel } from '../types';
import { SavedRepo } from './RepoManager';

interface NavbarProps {
  repoInfo: RepoInfo | null;
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
  repos: SavedRepo[];
  activeRepoPath: string;
  onSelectRepo: (path: string) => void;
  onRemoveRepo: (id: string) => void;
  onAddRepo: () => void;
  onCloneRepo: () => void;
}

export function Navbar({ repoInfo, activePanel, onPanelChange, repos, activeRepoPath, onSelectRepo, onRemoveRepo, onAddRepo, onCloneRepo }: NavbarProps) {
  const activeRepo = repos.find(r => r.path === activeRepoPath);
  const sorted = [...repos].sort((a, b) => {
    if (a.path === activeRepoPath) return -1;
    if (b.path === activeRepoPath) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  return (
    <div className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">♉</span>
        <h1 className="navbar-title">TaruGit</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
          <select
            value={activeRepo?.id || ''}
            onChange={e => {
              const repo = repos.find(r => r.id === e.target.value);
              if (repo) onSelectRepo(repo.path);
            }}
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-elevated)',
              color: activeRepo ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              width: '220px',
              outline: 'none'
            }}
          >
            {sorted.length === 0 && <option value="">— sin repositorios —</option>}
            {sorted.map(repo => (
              <option key={repo.id} value={repo.id}>
                {repo.name}{repo.currentBranch ? ` (${repo.currentBranch})` : ''}{repo.hasChanges ? ' ●' : ''}
              </option>
            ))}
          </select>

          {activeRepo && (
            <button
              onClick={() => onRemoveRepo(activeRepo.id)}
              title="Quitar de la lista"
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px 8px', borderRadius: '5px', fontSize: '12px', lineHeight: 1 }}
            >✕</button>
          )}
          <button
            onClick={onAddRepo}
            title="Agregar repositorio"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', padding: '5px 10px', borderRadius: '5px', fontSize: '13px', fontWeight: 700, lineHeight: 1 }}
          >+</button>
          <button
            onClick={onCloneRepo}
            title="Clonar repositorio"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px 8px', borderRadius: '5px', fontSize: '12px', lineHeight: 1 }}
          >📥</button>
        </div>

        {repoInfo && (
          <div className="branch-tag">
            <span className="branch-dot" />
            {repoInfo.current_branch}
          </div>
        )}
      </div>

      {repoInfo && (
        <nav className="navbar-tabs">
          <button
            className={`tab-btn ${activePanel === 'branches' ? 'active' : ''}`}
            onClick={() => onPanelChange('branches')}
          >
            <span>🌿</span> Ramas
          </button>
          <button
            className={`tab-btn ${activePanel === 'history' ? 'active' : ''}`}
            onClick={() => onPanelChange('history')}
          >
            <span>🕓</span> Historial
          </button>
        </nav>
      )}
    </div>
  );
}
