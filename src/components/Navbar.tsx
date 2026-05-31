import { RepoInfo, ActivePanel } from '../types';

interface NavbarProps {
  repoInfo: RepoInfo | null;
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
}

export function Navbar({ repoInfo, activePanel, onPanelChange }: NavbarProps) {
  return (
    <div className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">🐮</span>
        <h1 className="navbar-title">TaruGit</h1>
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
