import { useState, useCallback } from 'react';
import { formatDate } from './utils';

interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

interface ExtendedCommitInfo {
  id: string;
  message: string;
  author: string;
  timestamp: number;
}

interface CommitDiffPanelProps {
  commit: ExtendedCommitInfo;
  fileDiffs: FileDiff[];
}

function DiffLines({ diff }: { diff: string }) {
  if (!diff) return <div className="hds-empty">Sin cambios</div>;

  const lines = diff.split('\n').filter(line => {
    if (line.startsWith('diff --git ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) return false;
    return true;
  });

  let lineNum = 0;
  const lineData = lines.map(line => {
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
    <div className="hds-lines">
      {lineData.map((ld, i) => (
        <div key={i} className={`hds-line hds-line-${ld.type}`}>
          <span className="hds-ln">{ld.num}</span>
          <span className="hds-ln-marker">{ld.content[0] === '+' || ld.content[0] === '-' ? ld.content[0] : ' '}</span>
          <span className="hds-ln-text">{ld.content.slice(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function CommitDiffPanel({ commit, fileDiffs }: CommitDiffPanelProps) {
  const [selFile, setSelFile] = useState<string | null>(
    fileDiffs.length > 0 ? fileDiffs[0].path : null
  );
  const [listPct, setListPct] = useState(25);
  const [resizing, setResizing] = useState(false);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!resizing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setListPct(Math.min(Math.max(pct, 15), 50));
  }, [resizing]);

  const stopResize = useCallback(() => {
    if (resizing) {
      setResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [resizing]);

  return (
    <div className="diff-panel">
      <div className="diff-header">
        <div className="hds-commit-info">
          <span className="diff-file-path hds-commit-msg">{commit.message.split('\n')[0]}</span>
          <span className="hds-commit-meta">
            <span>{commit.id.slice(0, 8)}</span>
            <button className="hds-dc-copy" onClick={() => navigator.clipboard.writeText(commit.id)} title="Copiar hash">
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
              </svg>
            </button>
          </span>
          <span className="hds-commit-meta">👤 {commit.author}</span>
          <span className="hds-commit-meta">{formatDate(commit.timestamp)}</span>
        </div>
      </div>
      <div className="history-diff-split"
        onMouseMove={onMouseMove}
        onMouseUp={stopResize}
        onMouseLeave={stopResize}
      >
        <div className="hds-file-list" style={{ width: `${listPct}%`, minWidth: `${listPct}%` }}>
          <div className="hds-fl-header">
            <span className="hds-fl-count">{fileDiffs.length} archivo{fileDiffs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="hds-fl-body">
            {fileDiffs.map(f => {
              const parts = f.path.replace(/\\/g, '/').split('/');
              const filename = parts.pop() ?? f.path;
              const dir = parts.join('/');
              return (
                <div
                  key={f.path}
                  className={`hds-fl-item${selFile === f.path ? ' selected' : ''}`}
                  onClick={() => setSelFile(f.path)}
                >
                  <span className="hds-fl-path">
                    {dir ? <span className="hds-fl-dir">{dir}/</span> : null}
                    <span className="hds-fl-name">{filename}</span>
                  </span>
                  <span className="hds-fl-stats">
                    {f.additions > 0 && <span className="hds-fl-add">+{f.additions}</span>}
                    {f.deletions > 0 && <span className="hds-fl-del">-{f.deletions}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          className="hds-divider"
          onMouseDown={e => { e.preventDefault(); setResizing(true); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
        />
        <div className="hds-diff-content">
          {fileDiffs.filter(f => f.path === selFile).map(f => (
            <div key={f.path} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="hds-dc-header">
                <span className="hds-dc-path" title={f.path}>{f.path}</span>
                <button className="hds-dc-copy" onClick={() => navigator.clipboard.writeText(f.path)} title="Copiar ruta">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                  </svg>
                </button>
              </div>
              <DiffLines diff={f.diff} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
