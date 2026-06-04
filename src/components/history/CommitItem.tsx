import { ExtendedCommitInfo } from './HistoryPanel';  // ← Importar desde types, no desde HistoryPanel
import { formatDate, formatCommitMessage } from './utils';

interface CommitItemProps {
  commit: ExtendedCommitInfo;
  idx: number;
  isFirst: boolean;
  isSelected: boolean;
  isChecked: boolean;
  totalCommits: number;
  onSelectCommit: (commit: ExtendedCommitInfo) => void;
  onToggleSelection: (commitId: string) => void;
}

export function CommitItem({
  commit,
  idx,
  isFirst,
  isSelected,
  isChecked,
  totalCommits,
  onSelectCommit,
  onToggleSelection
}: CommitItemProps) {
  const shortId = commit.id.slice(0, 7);
  const message = formatCommitMessage(commit.message);
  const isLast = idx === totalCommits - 1;

  return (
    <div
      className={`commit-item ${isFirst ? 'latest' : ''} ${isSelected ? 'selected' : ''}`}
      style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: 'var(--radius-sm)',
        transition: 'all 0.12s ease',
        backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
        border: `1px solid ${isSelected ? 'var(--accent-dim)' : 'transparent'}`
      }}
    >
      {/* Checkbox para selección múltiple */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelection(commit.id);
        }}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
          background: isChecked ? 'var(--accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        {isChecked && <span style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>✓</span>}
      </div>

      {/* Gráfico de conexión entre commits */}
      <div 
        className="commit-graph"
        onClick={() => onSelectCommit(commit)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '16px',
          flexShrink: 0,
          cursor: 'pointer'
        }}
      >
        <div 
          className="commit-dot" 
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isFirst ? 'var(--accent)' : 'var(--border-light)',
            border: `2px solid ${isFirst ? 'transparent' : 'var(--bg-base)'}`,
            flexShrink: 0
          }}
        />
        {!isLast && (
          <div 
            className="commit-line" 
            style={{
              width: '2px',
              flex: 1,
              backgroundColor: 'var(--border)',
              marginTop: '2px',
              marginBottom: '2px'
            }}
          />
        )}
      </div>
      
      {/* Contenido del commit */}
      <div 
        className="commit-body" 
        onClick={() => onSelectCommit(commit)}
        style={{
          flex: 1,
          minWidth: 0,
          cursor: 'pointer'
        }}
      >
        <div className="commit-row-top" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '2px'
        }}>
          <span 
            className="commit-hash" 
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--accent)',
              backgroundColor: 'rgba(110,127,255,0.15)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            {shortId}
          </span>
          {isFirst && (
            <span 
              className="commit-latest-badge" 
              style={{
                fontSize: '9px',
                fontWeight: 700,
                backgroundColor: 'var(--yellow-bg)',
                color: 'var(--yellow)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              HEAD
            </span>
          )}
          <span 
            className="commit-date" 
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)'
            }}
          >
            📅 {formatDate(commit.timestamp)}
          </span>
        </div>
        
        <div 
          className="commit-message" 
          style={{
            fontSize: '12px',
            color: 'var(--text-primary)',
            fontWeight: isSelected ? 600 : 400,
            marginBottom: '4px',
            lineHeight: 1.4
          }}
        >
          {message}
        </div>
        
        <div className="commit-meta">
          <span 
            className="commit-author" 
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            👤 {commit.author}
          </span>
        </div>
      </div>
    </div>
  );
}