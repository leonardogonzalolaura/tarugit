import { useState } from 'react';

interface CommitPanelProps {
  fileCount: number;
  loading: boolean;
  onCommit: (message: string) => void;
}

export function CommitPanel({ fileCount, loading, onCommit }: CommitPanelProps) {
  const [message, setMessage] = useState('');

  if (fileCount === 0) return null;

  const handleCommit = () => {
    if (!message.trim()) return;
    onCommit(message);
    setMessage('');
  };

  const charLimit = 72;
  const firstLine = message.split('\n')[0] ?? '';
  const overLimit = firstLine.length > charLimit;

  return (
    <div className="commit-panel">
      <div className="commit-header">
        <span className="commit-title">✨ Commit</span>
        <span className="commit-count">{fileCount} archivo{fileCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="commit-input-wrap">
        <textarea
          placeholder="Descripción del commit..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          disabled={loading}
          className="commit-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) handleCommit();
          }}
        />
        <div className={`commit-char-count ${overLimit ? 'over' : ''}`}>
          {firstLine.length}/{charLimit}
        </div>
      </div>

      <button
        onClick={handleCommit}
        disabled={loading || !message.trim()}
        className="btn-commit"
      >
        {loading ? <span className="spinner-sm" /> : '🚀'} Hacer Commit
        <span className="commit-shortcut">Ctrl+Enter</span>
      </button>
    </div>
  );
}
