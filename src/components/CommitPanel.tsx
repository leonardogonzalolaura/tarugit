import { useState, useRef, useEffect } from 'react';

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
  defaultAuthorIndex?: number;
  onSetDefaultAuthor?: (idx: number) => void;
  onDeleteUser?: (idx: number) => void;
}

const SvgRocket = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor">
    <path d="M14.064 0a8.746 8.746 0 0 0-6.186 2.584l-3.317 3.38a.752.752 0 0 0-.175.281L3.165 9.27a.75.75 0 0 0 .173.798l2.648 2.66a.75.75 0 0 0 .796.174l3.057-1.227a.76.76 0 0 0 .28-.177l3.317-3.38A8.746 8.746 0 0 0 16 1.938V.75A.75.75 0 0 0 15.25 0ZM9.695 6.318a2 2 0 1 1-2.827-2.83 2 2 0 0 1 2.827 2.83Z"/>
    <path d="M8.278 10.583c-.82.835-2.044 1.604-3.205 2.04.438-1.162 1.208-2.39 2.043-3.21l.39.392.772.778ZM1.137 10.429a2.416 2.416 0 0 0-.805 2.504l.222.681a.25.25 0 0 0 .247.176h2.058a7.645 7.645 0 0 1 .558-.54c.36-.333.803-.72 1.3-1.089.037-1.108.64-2.24 1.288-2.903l-.197-.196-.587-.586c-.664.648-1.797 1.254-2.906 1.291-.37.497-.756.94-1.089 1.3-.17.184-.328.365-.48.546l.552.415Z"/>
  </svg>
);

const SvgPackage = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor">
    <path d="M8.023.084a.748.748 0 0 0-.306.058L1.498 2.607A.748.748 0 0 0 1 3.25v9.5c0 .313.195.594.498.71l6.219 2.456a.752.752 0 0 0 .566 0l6.219-2.456A.749.749 0 0 0 15 12.75v-9.5a.75.75 0 0 0-.498-.643L8.523.142a.748.748 0 0 0-.5-.058ZM8 1.586l4.047 1.59L8 4.8 3.953 3.176 8 1.586ZM2.5 11.3V5.286l5 1.92v6.008l-5-1.914Zm11 0-5 1.914V7.206l5-1.92V11.3Z"/>
  </svg>
);

const SvgCheck = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
  </svg>
);

const SvgChevronDown = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="currentcolor">
    <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
  </svg>
);

const SvgPerson = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="currentcolor">
    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/>
  </svg>
);

const SvgStar = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="currentcolor">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.193L.82 6.124a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.418A.75.75 0 0 1 8 .25Z"/>
  </svg>
);

const SvgTrash = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="currentcolor">
    <path d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5h-.255l-.82 8.624A2.25 2.25 0 0 1 9.936 15H6.064a2.25 2.25 0 0 1-2.24-1.876l-.82-8.624H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 4.5l.804 8.626a.75.75 0 0 0 .746.624h3.908a.75.75 0 0 0 .747-.624L11.504 4.5H4.496Z"/>
  </svg>
);

export function CommitPanel({ fileCount, loading, onCommit, users = [], onAddUser, onStashClick, defaultAuthorIndex = 0, onSetDefaultAuthor, onDeleteUser }: CommitPanelProps) {
  const [message, setMessage] = useState('');
  const [selectedUserIndex, setSelectedUserIndex] = useState<number>(defaultAuthorIndex);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [amend, setAmend] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultAuthorIndex < users.length) {
      setSelectedUserIndex(defaultAuthorIndex);
    }
  }, [defaultAuthorIndex, users.length]);

  if (fileCount === 0) return null;

  const handleCommit = () => {
    if (!message.trim()) return;
    const user = users.length > 0 && selectedUserIndex < users.length ? users[selectedUserIndex] : undefined;
    onCommit(message, user, amend);
    setMessage('');
    setAmend(false);
  };

  const selectUser = (idx: number) => {
    setSelectedUserIndex(idx);
    setShowUserDropdown(false);
    onSetDefaultAuthor?.(idx);
  };

  const charLimit = 72;
  const firstLine = message.split('\n')[0] ?? '';
  const overLimit = firstLine.length > charLimit;

  return (
    <div className="commit-panel">
      <div className="cp-header">
        <div className="cp-header-left">
          <span className="cp-title">Commit</span>
          <span className="cp-count">{fileCount}</span>
        </div>
        {users.length > 0 && (
          <div className="cp-author" ref={dropdownRef}>
            <button className="cp-author-btn" onClick={() => setShowUserDropdown(!showUserDropdown)}>
              <SvgPerson />
              <span className="cp-author-name">{users[selectedUserIndex]?.name}</span>
              <SvgChevronDown />
            </button>

            {showUserDropdown && (
              <>
                <div className="cp-dropdown-backdrop" onClick={() => setShowUserDropdown(false)} />
                <div className="cp-dropdown-menu">
                  {users.map((u, idx) => (
                    <div key={idx} className="cp-dropdown-item">
                      <button
                        className={`cp-dropdown-btn ${selectedUserIndex === idx ? 'cp-dropdown-btn--active' : ''}`}
                        onClick={() => selectUser(idx)}
                      >
                        <span className="cp-dropdown-btn-text">
                          {u.name}
                          {idx === defaultAuthorIndex && <span className="cp-default-badge"><SvgStar /></span>}
                        </span>
                        <span className="cp-dropdown-btn-email">&lt;{u.email}&gt;</span>
                        {selectedUserIndex === idx && <span className="cp-dropdown-check"><SvgCheck /></span>}
                      </button>
                      {onDeleteUser && users.length > 1 && (
                        <button className="cp-dropdown-del" onClick={() => { onDeleteUser(idx); setShowUserDropdown(false); }} title="Eliminar usuario">
                          <SvgTrash />
                        </button>
                      )}
                    </div>
                  ))}
                  {onAddUser && (
                    <>
                      <hr className="cp-dropdown-divider" />
                      <button className="cp-dropdown-add" onClick={() => { onAddUser(); setShowUserDropdown(false); }}>
                        + Agregar usuario
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="cp-input-wrap">
        <textarea
          placeholder="Descripción del commit..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          disabled={loading}
          className="cp-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) handleCommit();
          }}
        />
        <div className={`cp-charcount ${overLimit ? 'cp-charcount--over' : ''}`}>
          {firstLine.length}/{charLimit}
        </div>
      </div>

      <label className="cp-amend">
        <input
          type="checkbox"
          checked={amend}
          onChange={(e) => setAmend(e.target.checked)}
        />
        <span>Amend</span>
      </label>

      <div className="cp-actions">
        <button
          onClick={handleCommit}
          disabled={loading || !message.trim()}
          className="cp-btn-commit"
        >
          {loading ? <span className="spinner-sm" /> : <SvgRocket />}
          {amend ? 'Amendar' : 'Commit'}
        </button>
        {onStashClick && (
          <button type="button" onClick={onStashClick} disabled={loading} className="cp-btn-stash" title="Guardar cambios en Stash">
            <SvgPackage /> Stash
          </button>
        )}
      </div>
    </div>
  );
}
