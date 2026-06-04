import { useState } from 'react';

export interface CommitUser {
  name: string;
  email: string;
}

interface CommitPanelProps {
  fileCount: number;
  loading: boolean;
  onCommit: (message: string, user?: CommitUser) => void;
  users?: CommitUser[];
  onAddUser?: () => void;
}

export function CommitPanel({ fileCount, loading, onCommit, users = [], onAddUser }: CommitPanelProps) {
  const [message, setMessage] = useState('');
  const [selectedUserIndex, setSelectedUserIndex] = useState<number>(0);

  if (fileCount === 0) return null;

  const handleCommit = () => {
    if (!message.trim()) return;
    const user = users.length > 0 && selectedUserIndex < users.length ? users[selectedUserIndex] : undefined;
    onCommit(message, user);
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

      {users.length > 0 && (
        <div className="commit-user-select" style={{ marginBottom: '8px' }}>
          <select 
            value={selectedUserIndex} 
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val === -1 && onAddUser) {
                onAddUser();
                // Select the newly added user (it will be at users.length)
                setSelectedUserIndex(users.length);
              } else {
                setSelectedUserIndex(val);
              }
            }}
            style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#2a2a2a', color: 'white' }}
          >
            {users.map((u, idx) => (
              <option key={idx} value={idx}>
                {u.name} &lt;{u.email}&gt;
              </option>
            ))}
            <option value={-1}>+ Agregar nuevo usuario...</option>
          </select>
        </div>
      )}

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
