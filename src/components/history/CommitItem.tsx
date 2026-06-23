import { ExtendedCommitInfo } from './HistoryPanel';
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
      className={`hc-item ${isFirst ? 'latest' : ''} ${isSelected ? 'selected' : ''}`}
    >
      <div className="hc-cb">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleSelection(commit.id)}
          onClick={e => e.stopPropagation()}
        />
      </div>

      <div className="hc-graph" onClick={() => onSelectCommit(commit)}>
        <div className="hc-dot" />
        {!isLast && <div className="hc-line" />}
      </div>

      <div className="hc-body" onClick={() => onSelectCommit(commit)}>
        <div className="hc-row-top">
          <span className="hc-hash">{shortId}</span>
          {isFirst && <span className="hc-head-badge">HEAD</span>}
          <span className="hc-date">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
              <path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5H2.5Z"/>
            </svg>
            {formatDate(commit.timestamp)}
          </span>
        </div>

        <div className="hc-message">
          {message}
        </div>

        <div className="hc-author">
          <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
            <path d="M8 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 8a4 4 0 1 1 8 0v.5a.75.75 0 0 1-.75.75h-6.5A.75.75 0 0 1 4 8.5V8Zm0 2.5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 4 10.5Zm8 0a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 12 10.5Z"/>
          </svg>
          {commit.author}
        </div>
      </div>
    </div>
  );
}