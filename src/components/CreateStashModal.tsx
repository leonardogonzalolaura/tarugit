import { useState, useEffect } from 'react';
import { FileStatus } from '../types';

interface CreateStashModalProps {
  files: FileStatus[];
  onSave: (message: string, includeUntracked: boolean, filesToStash: string[] | null) => void;
  onClose: () => void;
}

export function CreateStashModal({ files, onSave, onClose }: CreateStashModalProps) {
  const [message, setMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<string[]>(files.map(f => f.path));

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleTogglePath = (path: string) => {
    setSelectedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleToggleAll = () => {
    if (selectedPaths.length === files.length) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(files.map(f => f.path));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stashingAll = selectedPaths.length === files.length;
    onSave(message, includeUntracked, stashingAll ? null : selectedPaths);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="fhm-modal"
        style={{ width: '480px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="fhm-header">
          <div className="fhm-header-icon">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
              <path d="M8.023.084a.748.748 0 0 0-.306.058L1.498 2.607A.748.748 0 0 0 1 3.25v9.5c0 .313.195.594.498.71l6.219 2.456a.752.752 0 0 0 .566 0l6.219-2.456A.749.749 0 0 0 15 12.75v-9.5a.75.75 0 0 0-.498-.643L8.523.142a.748.748 0 0 0-.5-.058ZM8 1.586l4.047 1.59L8 4.8 3.953 3.176 8 1.586ZM2.5 11.3V5.286l5 1.92v6.008l-5-1.914Zm11 0-5 1.914V7.206l5-1.92V11.3Z"/>
            </svg>
          </div>
          <div className="fhm-header-text">
            <span className="fhm-title">Guardar en Stash</span>
            <span className="fhm-subtitle">Aparta temporalmente tus cambios locales</span>
          </div>
          <button className="fhm-close" onClick={onClose} title="Cerrar">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '14px 16px',
            }}
          >
            <div>
              <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px', textAlign: 'left' }}>
                Mensaje del Stash (Opcional)
              </label>
              <input
                className="repo-input"
                style={{ width: '100%', margin: 0, fontSize: '12px', padding: '9px 12px' }}
                placeholder="Ej: trabajo en progreso de interfaz de usuario"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', textAlign: 'left' }}>
              <input
                type="checkbox"
                id="include-untracked-chk"
                checked={includeUntracked}
                onChange={e => setIncludeUntracked(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="include-untracked-chk" style={{ cursor: 'pointer', userSelect: 'none' }}>
                Incluir archivos nuevos/sin seguimiento (untracked)
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Archivos a guardar ({selectedPaths.length} de {files.length})
                </span>
                <button
                  type="button"
                  onClick={handleToggleAll}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                >
                  {selectedPaths.length === files.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>

              <div style={{
                flex: 1,
                minHeight: '120px',
                overflowY: 'auto',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                background: 'var(--bg-secondary)',
                padding: '6px',
                textAlign: 'left'
              }}>
                {files.map(file => (
                  <div
                    key={file.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                    onClick={() => handleTogglePath(file.path)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaths.includes(file.path)}
                      onChange={() => {}} // handled by row click
                      style={{ pointerEvents: 'none' }}
                    />
                    <span style={{
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all'
                    }}>
                      {file.path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="fhm-footer" style={{ gap: '10px' }}>
            <span className="fhm-footer-count" style={{ marginRight: 'auto' }}>
              {selectedPaths.length} de {files.length} archivos
            </span>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={selectedPaths.length === 0}
            >
              Guardar Stash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
