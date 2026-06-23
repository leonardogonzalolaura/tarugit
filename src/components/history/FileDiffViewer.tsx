import { useState, useMemo } from 'react';

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

  const parts = file.path.replace(/\\/g, '/').split('/');
  const filename = parts.pop() ?? file.path;
  const dir = parts.join('/');

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
      </div>

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
      <div className="panel-loading" style={{ height: '100%' }}>
        <span className="spinner" /> Cargando diff...
      </div>
    );
  }

  if (fileDiffs.length === 0) {
    return (
      <div className="panel-empty" style={{ height: '100%' }}>
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
