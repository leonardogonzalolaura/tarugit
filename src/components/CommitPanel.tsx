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
  onStashClick?: () => void;
}

export function CommitPanel({ fileCount, loading, onCommit, users = [], onAddUser, onStashClick }: CommitPanelProps) {
  const [message, setMessage] = useState('');
  const [selectedUserIndex, setSelectedUserIndex] = useState<number>(0);
  const [showUserDropdown, setShowUserDropdown] = useState(false);



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
        <div className="commit-user-select" style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', marginBottom: '6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Autor
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-secondary, #1e1e1e)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>
                {users[selectedUserIndex]?.name} &lt;{users[selectedUserIndex]?.email}&gt;
              </span>
              <span>▼</span>
            </button>

            {showUserDropdown && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                  onClick={() => setShowUserDropdown(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--bg-secondary, #1e1e1e)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  zIndex: 999,
                  overflow: 'hidden'
                }}>
                  {users.map((u, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedUserIndex(idx);
                        setShowUserDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        background: selectedUserIndex === idx ? 'var(--accent, #4f46e5)' : 'transparent',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedUserIndex !== idx) {
                          e.currentTarget.style.background = 'var(--bg-hover, #3a3a3a)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedUserIndex !== idx) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {u.name} &lt;{u.email}&gt;
                    </button>
                  ))}
                  {onAddUser && (
                    <>
                      <hr style={{ borderColor: 'var(--border)', margin: '4px 0' }} />
                      <button
                        onClick={() => {
                          onAddUser();
                          setShowUserDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
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

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={handleCommit}
          disabled={loading || !message.trim()}
          className="btn-commit"
          style={{ flex: 1, margin: 0 }}
        >
          {loading ? <span className="spinner-sm" /> : '🚀'} Hacer Commit
        </button>
        {onStashClick && (
          <button
            type="button"
            onClick={onStashClick}
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '0 14px', whiteSpace: 'nowrap' }}
            title="Guardar cambios en Stash"
          >
            📦 Stash...
          </button>
        )}
      </div>
    </div>
  );
}
