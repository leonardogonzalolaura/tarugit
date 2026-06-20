import { useState, useEffect } from 'react';
import { BranchInfo } from '../../types';
import { ExtendedCommitInfo } from './HistoryPanel';

interface CherryPickModalProps {
  commits: ExtendedCommitInfo[];
  branches: BranchInfo[];
  currentBranch: string;
  onPick: (targetBranch: string, commitIds: string[]) => void;
  onClose: () => void;
}

export function CherryPickModal({ commits, branches, currentBranch, onPick, onClose }: CherryPickModalProps) {
  const [targetBranch, setTargetBranch] = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const otherBranches = branches.filter(b => b.name !== currentBranch);
  const commitCount = commits.length;
  const commitIds = commits.map(c => c.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranch) return;
    setPicking(true);
    try {
      await onPick(targetBranch, commitIds);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-icon">🍒</div>
        <h3 className="modal-title">Cherry-Pick</h3>
        <p className="modal-desc">
          Aplicar {commitCount} commit{commitCount !== 1 ? 's' : ''} en otra rama:
        </p>
        
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          margin: '8px 0',
          maxHeight: '150px',
          overflowY: 'auto',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)'
        }}>
          {commits.map((c, idx) => (
            <div key={c.id} style={{ 
              padding: '4px 0',
              borderBottom: idx < commits.length - 1 ? '1px solid var(--border)' : 'none',
              color: 'var(--text-secondary)'
            }}>
              <span style={{ color: 'var(--accent)' }}>{c.id.slice(0, 7)}</span> - {c.message.split('\n')[0].slice(0, 50)}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>
              Rama destino
            </label>
            <select
              value={targetBranch}
              onChange={e => setTargetBranch(e.target.value)}
              disabled={picking}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              <option value="">Selecciona una rama...</option>
              {otherBranches.map(branch => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={picking}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={picking || !targetBranch}>
              {picking ? <span className="spinner-sm" style={{ marginRight: '6px' }} /> : '🍒'} Aplicar Cherry-Pick
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}