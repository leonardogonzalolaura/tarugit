import { useState, useEffect } from 'react';

interface FooterProps {
  repoPath: string;
  currentBranch?: string;
  fileCount?: number;
}

export function Footer({ repoPath, currentBranch, fileCount = 0 }: FooterProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const repoName = repoPath
    ? repoPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? repoPath
    : null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <footer className="app-footer">
      {/* Izquierda: info del repo */}
      <div className="footer-section footer-left">
        {repoName ? (
          <>
            <span className="footer-item footer-repo">
              <span className="footer-icon">◈</span>
              <span className="footer-repo-name">{repoName}</span>
            </span>
            {currentBranch && (
              <span className="footer-item footer-branch">
                <span className="footer-icon">⎇</span>
                <span>{currentBranch}</span>
              </span>
            )}
            {fileCount > 0 && (
              <span className="footer-item footer-changes">
                <span className="footer-dot footer-dot--yellow" />
                <span>{fileCount} cambio{fileCount !== 1 ? 's' : ''}</span>
              </span>
            )}
            {fileCount === 0 && currentBranch && (
              <span className="footer-item footer-clean">
                <span className="footer-dot footer-dot--green" />
                <span>Limpio</span>
              </span>
            )}
          </>
        ) : (
          <span className="footer-item footer-no-repo">
            <span className="footer-icon">◈</span>
            <span>Sin repositorio</span>
          </span>
        )}
      </div>

      {/* Centro: branding */}
      <div className="footer-section footer-center">
        <span className="footer-brand">
          <span className="footer-brand-icon">♉</span>
          TaruGit
        </span>
        <span className="footer-git-version">v0.1.5</span>
      </div>

      {/* Derecha: fecha y hora */}
      <div className="footer-section footer-right">
        <span className="footer-item footer-time">
          <span className="footer-icon">🕐</span>
          <span className="footer-time-val">{timeStr}</span>
        </span>
        <span className="footer-separator">·</span>
        <span className="footer-item footer-date">
          <span>{dateStr}</span>
        </span>
      </div>
    </footer>
  );
}
