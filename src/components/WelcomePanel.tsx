interface WelcomePanelProps {
  hasRepo?: boolean;
  hasChanges?: boolean;
  onAction?: (id: string) => void;
}

const SvgFolder = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
    <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z" />
  </svg>
);

const SvgFileDiff = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.5C11.216 0 12 .784 12 1.75v10.5A1.75 1.75 0 0 1 10.25 14H3.75A1.75 1.75 0 0 1 2 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Z" />
    <path d="M4 5.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 4 5.5Zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 4 8.5Z" opacity="0.7" />
  </svg>
);

const SvgCommit = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.22 5.78a.75.75 0 0 1 0 1.06L7.5 10.56 5.22 8.28a.75.75 0 0 1 1.06-1.06L7.5 8.44l3.16-3.16a.75.75 0 0 1 1.06 0Z" />
  </svg>
);

const SvgBranch = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
    <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z" />
  </svg>
);

const SvgHomologar = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
    <path d="M5.45 5.975A5.5 5.5 0 0 1 6.5 3.55V1.75a.75.75 0 0 1 1.5 0v10a.75.75 0 0 1-1.5 0v-2.5a3.5 3.5 0 0 0-3.5 3.5.75.75 0 0 1-1.5 0 5 5 0 0 1 3.45-4.775Z" />
  </svg>
);

const SvgCherry = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
    <path d="M8 0a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.5V12a2 2 0 0 0 4 0V7.5A4 4 0 0 0 8 0Zm1.5 10.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V8h2v2.5Z" />
  </svg>
);

export function WelcomePanel({ hasRepo, hasChanges, onAction }: WelcomePanelProps) {
  const handle = (id: string, disabled?: boolean) => {
    if (disabled) return;
    onAction?.(id);
  };

  return (
    <div className="welcome-panel">
      <div className="welcome-icon">
        <span style={{ color: 'var(--accent)', fontSize: '48px' }}>♉</span>
      </div>
      <h2 className="welcome-title">Bienvenido a TaruGit</h2>
      <p className="welcome-sub">Selecciona un archivo para ver sus cambios</p>

      <div className="welcome-guide">
        <div className="welcome-guide-section">
          <h4 className="welcome-guide-title">Primeros pasos</h4>
          <div className="welcome-guide-list">
            <button
              className="welcome-guide-card"
              onClick={() => handle('openRepo')}
              title="Abrir o clonar repositorio (Ctrl+O)"
            >
              <span className="welcome-guide-icon" style={{ color: 'var(--accent)' }}><SvgFolder /></span>
              <span className="welcome-guide-text">
                <strong>Abrir / Clonar repo</strong>
                <span>Gestiona tus repositorios</span>
              </span>
              <kbd className="welcome-kbd">Ctrl+O</kbd>
            </button>

            <div className="welcome-guide-card is-static" title="Selecciona un archivo en la lista de cambios">
              <span className="welcome-guide-icon" style={{ color: 'var(--green)' }}><SvgFileDiff /></span>
              <span className="welcome-guide-text">
                <strong>Ver diff</strong>
                <span>Selecciona archivo en Cambios</span>
              </span>
              <span className="welcome-kbd is-muted">click</span>
            </div>

            <button
              className="welcome-guide-card"
              onClick={() => handle('commit', !hasRepo || !hasChanges)}
              disabled={!hasRepo || !hasChanges}
              title={hasChanges ? 'Ir a commit (escribe mensaje y Ctrl+Enter)' : 'Sin cambios para commitear'}
            >
              <span className="welcome-guide-icon" style={{ color: hasChanges ? 'var(--green)' : 'var(--text-muted)' }}><SvgCommit /></span>
              <span className="welcome-guide-text">
                <strong>Commit</strong>
                <span>{hasChanges ? 'Listo para guardar' : 'Sin cambios'}</span>
              </span>
              <kbd className={`welcome-kbd ${!hasChanges ? 'is-muted' : ''}`}>Ctrl+Enter</kbd>
            </button>
          </div>
        </div>

        <div className="welcome-guide-section">
          <h4 className="welcome-guide-title">Atajos importantes</h4>
          <div className="welcome-guide-list">
            <button className="welcome-guide-card" onClick={() => handle('createBranch', !hasRepo)} disabled={!hasRepo} title="Crear rama Ctrl+Shift+B">
              <span className="welcome-guide-icon"><SvgBranch /></span>
              <span className="welcome-guide-text"><strong>Crear rama</strong><span>Nueva feature/fix</span></span>
              <kbd className="welcome-kbd">Ctrl+Shift+B</kbd>
            </button>

            <button className="welcome-guide-card" onClick={() => handle('homologar', !hasRepo)} disabled={!hasRepo} title="Homologar ramas Ctrl+Shift+H">
              <span className="welcome-guide-icon"><SvgHomologar /></span>
              <span className="welcome-guide-text"><strong>Homologar</strong><span>Rebase sobre base</span></span>
              <kbd className="welcome-kbd">Ctrl+Shift+H</kbd>
            </button>

            <button className="welcome-guide-card" onClick={() => handle('cherryPick', !hasRepo)} disabled={!hasRepo} title="Cherry-pick Ctrl+E">
              <span className="welcome-guide-icon"><SvgCherry /></span>
              <span className="welcome-guide-text"><strong>Cherry-pick</strong><span>Copiar commits</span></span>
              <kbd className="welcome-kbd">Ctrl+E</kbd>
            </button>

            <button className="welcome-guide-card" onClick={() => handle('quickBranch', !hasRepo)} disabled={!hasRepo} title="Buscar ramas Ctrl+L">
              <span className="welcome-guide-icon"><SvgBranch /></span>
              <span className="welcome-guide-text"><strong>Buscar ramas</strong><span>Cambiar rápido</span></span>
              <kbd className="welcome-kbd">Ctrl+L</kbd>
            </button>
          </div>
        </div>
      </div>

      <div className="welcome-hint">
        <span>Presiona</span> <kbd className="welcome-kbd is-inline">Ctrl+?</kbd> <span>para ver todos los atajos</span>
        <button className="welcome-link" onClick={() => handle('showHelp')}>Ver guía</button>
      </div>
    </div>
  );
}
