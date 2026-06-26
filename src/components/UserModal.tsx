import { useEffect } from 'react';

interface UserModalProps {
  newUserName: string;
  newUserEmail: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const SvgPerson = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentcolor">
    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/>
  </svg>
);

const SvgMail = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor">
    <path d="M1.75 2h12.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75V2.75A.75.75 0 0 1 1.75 2Zm.75 1.5v.414L8 8.563l5.5-4.649V3.5H2.5Zm11 .914-5.144 4.35a.25.25 0 0 1-.344 0L2.5 4.414V11.5h11V4.414Z"/>
  </svg>
);

export function UserModal({ newUserName, newUserEmail, onNameChange, onEmailChange, onSave, onClose }: UserModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal um" onClick={(e) => e.stopPropagation()}>
        <div className="um-header">
          <span className="um-header-icon"><SvgPerson /></span>
          <h3 className="um-title">Agregar usuario</h3>
        </div>

        <div className="um-fields">
          <div className="um-field">
            <label className="um-label">Nombre</label>
            <div className="um-input-wrap">
              <span className="um-input-icon"><SvgPerson /></span>
              <input
                type="text"
                placeholder="Nombre completo"
                value={newUserName}
                onChange={(e) => onNameChange(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && onSave()}
                className="um-input"
              />
            </div>
          </div>
          <div className="um-field">
            <label className="um-label">Correo</label>
            <div className="um-input-wrap">
              <span className="um-input-icon"><SvgMail /></span>
              <input
                type="email"
                placeholder="usuario@correo.com"
                value={newUserEmail}
                onChange={(e) => onEmailChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSave()}
                className="um-input"
              />
            </div>
          </div>
        </div>

        <div className="um-actions">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={onSave}>Agregar</button>
        </div>
      </div>
    </div>
  );
}
