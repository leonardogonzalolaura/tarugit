interface UserModalProps {
  newUserName: string;
  newUserEmail: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function UserModal({ newUserName, newUserEmail, onNameChange, onEmailChange, onSave, onClose }: UserModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
        <h3 className="modal-title">Agregar usuario</h3>
        <p className="modal-desc">Ingresa los datos del autor para los commits</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <input
            type="text"
            placeholder="Nombre completo"
            value={newUserName}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            className="repo-input"
            style={{ margin: 0 }}
          />

          <input
            type="email"
            placeholder="Correo electrónico"
            value={newUserEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            className="repo-input"
            style={{ margin: 0 }}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={onSave}>Agregar usuario</button>
        </div>
      </div>
    </div>
  );
}
