import { useState, useEffect, useRef, useMemo } from 'react';
import type { SavedRepo } from './RepoManager';

interface QuickRepoModalProps {
  repos: SavedRepo[];
  activeRepoPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function QuickRepoModal({ repos, activeRepoPath, onSelect, onClose }: QuickRepoModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return repos;
    const q = query.toLowerCase();
    return repos.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.path.toLowerCase().includes(q)
    );
  }, [query, repos]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        onSelect(filtered[selectedIndex].path);
        return;
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [filtered, selectedIndex, onSelect]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 520,
          padding: 0,
          overflow: 'hidden',
          position: 'absolute',
          top: '20%',
        }}
      >
        <div style={{ padding: '12px 14px 8px' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar repositorio..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            padding: '0 6px 6px',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {query ? 'No se encontraron repositorios' : 'No hay repositorios agregados'}
            </div>
          ) : (
            filtered.map((r, i) => (
              <button
                key={r.id}
                className={`navbar-repo-item ${i === selectedIndex ? 'active' : ''} ${r.path === activeRepoPath ? 'current' : ''}`}
                onClick={() => onSelect(r.path)}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: i === selectedIndex ? 'var(--bg-hover)' : r.path === activeRepoPath ? 'var(--bg-selected)' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <svg viewBox="0 0 16 16" width="16" height="16" fill="var(--text-muted)" style={{ flexShrink: 0 }}>
                  <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
                </svg>
                <span className="navbar-repo-item-info" style={{ minWidth: 0 }}>
                  <span className="navbar-repo-item-name">{r.name}</span>
                  <span className="navbar-repo-item-path">{r.path}</span>
                </span>
                {r.path === activeRepoPath && (
                  <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12 }}>✓</span>
                )}
              </button>
            ))
          )}
        </div>

        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 14,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span>↑↓ navegar</span>
          <span>↲ seleccionar</span>
          <span>ESC cerrar</span>
        </div>
      </div>
    </div>
  );
}
