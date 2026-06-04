interface DiffViewerProps {
  selectedFile: string | null;
  diffContent: string;
  loading: boolean;
  onClose: () => void;
}

function renderDiffLines(raw: string) {
  if (!raw || raw === 'NO_CHANGES') {
    return (
      <div className="diff-empty">
        <span>📄</span>
        <p>No hay cambios en este archivo</p>
      </div>
    );
  }

  const lines = raw.split('\n');

  return (
    <div className="diff-lines">
      {lines.map((line, i) => {
        const first = line[0];
        let cls = 'diff-line-ctx';
        if (first === '+') cls = 'diff-line-add';
        else if (first === '-') cls = 'diff-line-del';
        else if (first === '@') cls = 'diff-line-hunk';

        // Número de línea visual (solo contexto, no header)
        return (
          <div key={i} className={`diff-line ${cls}`}>
            <span className="diff-line-num">{i + 1}</span>
            <span className="diff-line-marker">{first === '+' || first === '-' ? first : ' '}</span>
            <span className="diff-line-text">{line.slice(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DiffViewer({ selectedFile, diffContent, loading, onClose }: DiffViewerProps) {
  if (!selectedFile) {
    return (
      <div className="welcome-panel">
        <div className="welcome-icon">
          <span className="color: pink; font-size: 48px;">♉</span>
        </div>
        <h2 className="welcome-title">Bienvenido a TaruGit</h2>
        <p className="welcome-sub">Selecciona un archivo para ver sus cambios</p>
        <div className="welcome-features">
          <div className="feature-card">
            <span>🎨</span>
            <span>Diff con colores</span>
          </div>
          <div className="feature-card">
            <span>🌿</span>
            <span>Gestión de ramas</span>
          </div>
          <div className="feature-card">
            <span>🕓</span>
            <span>Historial de commits</span>
          </div>
          <div className="feature-card">
            <span>⚡</span>
            <span>Motor en Rust</span>
          </div>
        </div>
      </div>
    );
  }

  const parts = selectedFile.replace(/\\/g, '/').split('/');
  const filename = parts.pop() ?? selectedFile;
  const dir = parts.join('/');

  const addCount = (diffContent.match(/^\+/gm) ?? []).length;
  const delCount = (diffContent.match(/^-/gm) ?? []).length;

  return (
    <div className="diff-panel">
      <div className="diff-header">
        <div className="diff-file-path">
          {dir && <span className="diff-dir">{dir}/</span>}
          <span className="diff-filename">{filename}</span>
        </div>
        <div className="diff-stats">
          {addCount > 0 && <span className="diff-stat-add">+{addCount}</span>}
          {delCount > 0 && <span className="diff-stat-del">-{delCount}</span>}
        </div>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      <div className="diff-body">
        {loading
          ? <div className="diff-loading"><span className="spinner" /> Cargando...</div>
          : renderDiffLines(diffContent)
        }
      </div>
    </div>
  );
}
