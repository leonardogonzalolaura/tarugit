import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    appWindow.isMaximized().then(setMaximized);
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-icon">♉</span>
        <span className="titlebar-text" data-tauri-drag-region>tarugit</span>
      </div>
      <div className="titlebar-center" data-tauri-drag-region />
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => appWindow.minimize()} title="Minimizar">
          <svg viewBox="0 0 12 12" width="10" height="10"><rect y="5" width="12" height="1.5" fill="currentColor" rx="1"/></svg>
        </button>
        <button className="titlebar-btn" onClick={async () => { await appWindow.toggleMaximize(); setMaximized(v => !v); }} title={maximized ? 'Restaurar' : 'Maximizar'}>
          {maximized ? (
            <svg viewBox="0 0 12 12" width="10" height="10">
              <rect x="1.5" y="3.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="3.5" y="1.5" width="7" height="7" rx="1" fill="var(--bg-surface)" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="10" height="10"><rect x="1" y="2" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
          )}
        </button>
        <button className="titlebar-btn titlebar-btn--close" onClick={() => appWindow.close()} title="Cerrar">
          <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  );
}
