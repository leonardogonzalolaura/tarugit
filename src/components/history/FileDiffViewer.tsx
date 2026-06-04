import { useState } from 'react';

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

function renderDiffLines(diff: string) {
  if (!diff) return <div className="diff-empty">Sin cambios</div>;

  const lines = diff.split('\n');
  return (
    <div className="diff-lines">
      {lines.map((line, i) => {
        const first = line[0];
        let cls = 'diff-line-ctx';
        if (first === '+') cls = 'diff-line-add';
        else if (first === '-') cls = 'diff-line-del';
        else if (first === '@') cls = 'diff-line-hunk';
        
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

function FileDiffItem({ file }: { file: FileDiff }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalChanges = file.additions + file.deletions;

  return (
    <div style={{ marginBottom: '12px', borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          cursor: 'pointer',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm)',
          transition: 'all 0.12s',
          border: '1px solid var(--border)'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
      >
        <span style={{ fontSize: '12px', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', flex: 1, wordBreak: 'break-all' }}>
          {file.path}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {file.additions > 0 && (
            <span className="diff-stat-add" style={{ fontSize: '11px' }}>+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="diff-stat-del" style={{ fontSize: '11px' }}>-{file.deletions}</span>
          )}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {totalChanges} línea{totalChanges !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{
          padding: '12px',
          background: 'var(--bg-base)',
          borderRadius: 'var(--radius-sm)',
          marginTop: '4px',
          marginBottom: '8px',
          border: '1px solid var(--border-light)',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {renderDiffLines(file.diff)}
        </div>
      )}
    </div>
  );
}

export function FileDiffViewer({ fileDiffs, loading }: FileDiffViewerProps) {
  if (loading) {
    return (
      <div className="diff-loading">
        <span className="spinner" /> Cargando diff...
      </div>
    );
  }

  if (fileDiffs.length === 0) {
    return (
      <div className="diff-empty">
        <span>📄</span>
        <p>No hay cambios en este commit</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {fileDiffs.map(file => (
        <FileDiffItem key={file.path} file={file} />
      ))}
    </div>
  );
}