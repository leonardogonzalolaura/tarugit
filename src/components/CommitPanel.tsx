import { useState } from 'react';

export interface CommitUser {
  name: string;
  email: string;
}

interface CommitPanelProps {
  fileCount: number;
  loading: boolean;
  onCommit: (message: string, user?: CommitUser, amend?: boolean) => void;
  users?: CommitUser[];
  onAddUser?: () => void;
  onStashClick?: () => void;
}

export function CommitPanel({ fileCount, loading, onCommit, users = [], onAddUser, onStashClick }: CommitPanelProps) {
  const [message, setMessage] = useState('');
  const [selectedUserIndex, setSelectedUserIndex] = useState<number>(0);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [amend, setAmend] = useState(false);

  if (fileCount === 0) return null;

  const handleCommit = () => {
    if (!message.trim()) return;
    const user = users.length > 0 && selectedUserIndex < users.length ? users[selectedUserIndex] : undefined;
    onCommit(message, user, amend);
    setMessage('');
    setAmend(false);
  };

  const charLimit = 72;
  const firstLine = message.split('\n')[0] ?? '';
  const overLimit = firstLine.length > charLimit;

  return (
    <div className="commit-panel">
      <div className="commit-header">
        <span className="commit-title">Commit</span>
        <span className="commit-count">{fileCount} archivo{fileCount !== 1 ? 's' : ''}</span>
      </div>

      {users.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div className="commit-user-label">Autor</div>
          <div className="user-dropdown-wrapper">
            <button className="user-dropdown-btn" onClick={() => setShowUserDropdown(!showUserDropdown)}>
              <span>{users[selectedUserIndex]?.name} &lt;{users[selectedUserIndex]?.email}&gt;</span>
              <span>▼</span>
            </button>

            {showUserDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowUserDropdown(false)} />
                <div className="user-dropdown-menu">
                  {users.map((u, idx) => (
                    <button key={idx}
                      className={`user-dropdown-item ${selectedUserIndex === idx ? 'user-dropdown-item--active' : ''}`}
                      onClick={() => { setSelectedUserIndex(idx); setShowUserDropdown(false); }}
                    >
                      {u.name} &lt;{u.email}&gt;
                    </button>
                  ))}
                  {onAddUser && (
                    <>
                      <hr style={{ borderColor: 'var(--border)', margin: '4px 0' }} />
                      <button className="user-dropdown-item user-dropdown-item--add"
                        onClick={() => { onAddUser(); setShowUserDropdown(false); }}>
                        + Agregar nuevo usuario...
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={amend}
            onChange={(e) => setAmend(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Amend (modificar último commit)
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={handleCommit}
          disabled={loading || !message.trim()}
          className="btn-commit"
          style={{ flex: 1, margin: 0 }}
        >
          {loading ? <span className="spinner-sm" /> : '🚀'} {amend ? 'Amendar Commit' : 'Hacer Commit'}
        </button>
        {onStashClick && (
          <button type="button" onClick={onStashClick} disabled={loading}
            className="btn-secondary" style={{ padding: '0 14px', whiteSpace: 'nowrap' }}
            title="Guardar cambios en Stash"
          >📦 Stash...</button>
        )}
      </div>
    </div>
  );
}
