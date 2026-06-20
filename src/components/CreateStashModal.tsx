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
        className="modal" 
        style={{ 
          maxWidth: '480px', 
          width: '100%', 
          maxHeight: '85vh', 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '24px' 
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-icon">📦</div>
        <h3 className="modal-title">Guardar en Stash</h3>
        <p className="modal-desc" style={{ marginBottom: '8px' }}>
          Guarda tus cambios locales en un stash para limpiarlos de tu área de trabajo:
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflow: 'hidden' }}>
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

          <div className="modal-actions" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={selectedPaths.length === 0}
            >
              📦 Guardar Stash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
