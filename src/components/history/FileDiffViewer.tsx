import { useState, useMemo, useCallback } from 'react';
import { FileHierarchyModal } from '../FileHierarchyModal';

interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

interface FileDiffViewerProps {
  fileDiffs: FileDiff[];
  loading: boolean;
}

function FileDiffItem({ file }: { file: FileDiff }) {
  const [expanded, setExpanded] = useState(false);
  const [showHierarchy, setShowHierarchy] = useState(false);

  const parts = file.path.replace(/\\/g, '/').split('/');
  const filename = parts.pop() ?? file.path;
  const dir = parts.join('/');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(file.path);
  }, [file.path]);

  return (
    <div className="fd-item">
      <div className={`fd-head${expanded ? ' expanded' : ''}`} onClick={() => setExpanded(v => !v)}>
        <span className="fd-chevron">{expanded ? '▼' : '▶'}</span>
        <span className="fd-path" title={file.path}>
          {dir && <span className="fd-dir">{dir}/</span>}
          <span className="fd-name">{filename}</span>
        </span>
        <span className="fd-stats">
          {file.additions > 0 && <span className="fd-add">+{file.additions}</span>}
          {file.deletions > 0 && <span className="fd-del">-{file.deletions}</span>}
        </span>
        <span className="fd-head-actions">
          <button className="fd-head-btn" onClick={e => { e.stopPropagation(); handleCopy(); }} title="Copiar ruta">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
            </svg>
          </button>
          <button className="fd-head-btn" onClick={e => { e.stopPropagation(); setShowHierarchy(true); }} title="Ver jerarquía">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v2.5C0 6.216.784 7 1.75 7h2.5A1.75 1.75 0 0 0 6 5.25v-2.5A1.75 1.75 0 0 0 4.25 1ZM8 12.25A2.25 2.25 0 0 1 10.25 10h2.5A2.25 2.25 0 0 1 15 12.25v.5a2.25 2.25 0 0 1-2.25 2.25h-2.5A2.25 2.25 0 0 1 8 12.75ZM14 4.75A2.75 2.75 0 1 0 8.5 6.5L7.36 9.2a3.25 3.25 0 0 1 .98.68l1.16-2.78A2.75 2.75 0 0 0 14 4.75Z"/>
            </svg>
          </button>
        </span>
      </div>

      {showHierarchy && (
        <FileHierarchyModal path={file.path} onClose={() => setShowHierarchy(false)} />
      )}

      {expanded && (
        <div className="fd-body">
          <DiffLines diff={file.diff} />
        </div>
      )}
    </div>
  );
}

function DiffLines({ diff }: { diff: string }) {
  if (!diff) return <div className="fd-empty">Sin cambios</div>;

  const lines = useMemo(() => diff.split('\n'), [diff]);

  // Compute line numbers for +/- markers
  let lineNum = 0;
  const lineData = lines.filter(line => {
    // Skip git diff header lines
    if (line.startsWith('diff --git ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      return false;
    }
    return true;
  }).map(line => {
    const first = line[0];
    if (first === '@') {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) lineNum = parseInt(match[1], 10) - 1;
      return { content: line, type: 'hunk' as const, num: '' };
    }
    if (first === '+') { lineNum++; return { content: line, type: 'add' as const, num: lineNum }; }
    if (first === '-') return { content: line, type: 'del' as const, num: '' };
    lineNum++;
    return { content: line, type: 'ctx' as const, num: lineNum };
  });

  return (
    <div className="fd-lines">
      {lineData.map((ld, i) => (
        <div key={i} className={`fd-line fd-line-${ld.type}`}>
          <span className="fd-ln">{ld.num}</span>
          <span className="fd-ln-marker">{ld.content[0] === '+' || ld.content[0] === '-' ? ld.content[0] : ' '}</span>
          <span className="fd-ln-text">{ld.content.slice(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function FileDiffViewer({ fileDiffs, loading }: FileDiffViewerProps) {
  const totalAdds = useMemo(() => fileDiffs.reduce((s, f) => s + f.additions, 0), [fileDiffs]);
  const totalDels = useMemo(() => fileDiffs.reduce((s, f) => s + f.deletions, 0), [fileDiffs]);

  if (loading) {
    return (
      <div className="fd-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" /> Cargando diff...
      </div>
    );
  }

  if (fileDiffs.length === 0) {
    return (
      <div className="fd-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        No hay cambios en este commit
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary bar */}
      <div className="fd-summary">
        <span className="fd-sum-count">{fileDiffs.length} archivo{fileDiffs.length !== 1 ? 's' : ''}</span>
        <span className="fd-sum-divider" />
        <span className="fd-sum-adds">+{totalAdds}</span>
        <span className="fd-sum-dels">-{totalDels}</span>
      </div>

      {/* File list */}
      <div className="fd-list">
        {fileDiffs.map(file => (
          <FileDiffItem key={file.path} file={file} />
        ))}
      </div>
    </div>
  );
}
