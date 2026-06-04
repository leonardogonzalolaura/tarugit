import React, { useState, useEffect } from 'react';
import { ExtendedCommitInfo } from './HistoryPanel';

interface SquashModalProps {
  commitsToSquash: ExtendedCommitInfo[];
  onSquash: (count: number, message: string) => void;
  onCancel: () => void;
  isSquashing: boolean;
}

export function SquashForm({ commitsToSquash, onSquash, onCancel, isSquashing }: SquashModalProps) {
  const [squashMessage, setSquashMessage] = useState('');

  // Auto-fill default message using the selected commits
  useEffect(() => {
    if (commitsToSquash.length > 0) {
      const defaultMsg = commitsToSquash.map(c => `- ${c.message}`).join('\n');
      setSquashMessage(`Unión de ${commitsToSquash.length} commits:\n\n${defaultMsg}`);
    }
  }, [commitsToSquash.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commitsToSquash.length < 2) {
      alert('Debes seleccionar al menos 2 commits para hacer squash.');
      return;
    }
    if (!squashMessage.trim()) {
      alert('Por favor ingresa un mensaje para el nuevo commit unificado.');
      return;
    }
    onSquash(commitsToSquash.length, squashMessage.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">💥</div>
        <h3 className="modal-title">Unir Commits (Squash)</h3>
        <p className="modal-desc">
          Se van a unir los siguientes {commitsToSquash.length} commits desde HEAD:
        </p>

        <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', marginBottom: '12px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)' }}>
          {commitsToSquash.map(c => (
            <div key={c.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: 'var(--accent)' }}>{c.id.substring(0, 7)}</span> {c.message}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            Nuevo mensaje del commit unificado:
          </label>
          <textarea
            className="search-input"
            style={{ margin: 0, padding: '8px', minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }}
            placeholder="Escribe el mensaje..."
            value={squashMessage}
            onChange={e => setSquashMessage(e.target.value)}
            disabled={isSquashing}
          />
          <div className="modal-actions" style={{ marginTop: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSquashing}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" style={{ background: 'var(--yellow)', color: '#000', fontWeight: 'bold' }} disabled={isSquashing || !squashMessage.trim()}>
              {isSquashing ? <span className="spinner-sm" /> : 'Confirmar Squash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
