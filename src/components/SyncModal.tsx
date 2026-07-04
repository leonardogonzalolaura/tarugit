import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from './Toast';

interface SyncModalProps {
  repoPath: string;
  currentBranch: string;
  onClose: () => void;
  onRefresh?: () => void;
}

type SyncStatus = 'behind' | 'ahead' | 'diverged' | 'synced' | 'no-remote' | 'no-upstream' | 'loading';

interface SyncAction {
  key: string;
  label: string;
  description: string;
  handler: () => Promise<void>;
}

export function SyncModal({ repoPath, currentBranch, onClose, onRefresh }: SyncModalProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applyingAction, setApplyingAction] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<{ ahead: number; behind: number; has_remote: boolean; has_upstream: boolean }>('git_status_remote', {
      repoPath,
      branchName: currentBranch,
    }).then(status => {
      setAhead(status.ahead);
      setBehind(status.behind);
      if (!status.has_remote) setSyncStatus('no-remote');
      else if (!status.has_upstream) setSyncStatus('no-upstream');
      else if (status.ahead > 0 && status.behind > 0) setSyncStatus('diverged');
      else if (status.ahead > 0) setSyncStatus('ahead');
      else if (status.behind > 0) setSyncStatus('behind');
      else setSyncStatus('synced');
    }).catch(() => {
      setSyncStatus('no-remote');
    });
  }, [repoPath, currentBranch]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (applying) return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        const actions = getActions();
        if (actions[idx]) {
          e.preventDefault();
          actions[idx].handler();
        }
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [syncStatus, ahead, behind, applying, repoPath, currentBranch]);

  const doPull = async () => {
    if (applying) return;
    setApplying(true);
    setApplyingAction('pull');
    try {
      await invoke<string>('pull_branch', { repoPath, branchName: currentBranch });
      toast.success(`Pull completado en "${currentBranch}"`);
      onRefresh?.();
      onClose();
    } catch (e) {
      toast.error(`Error al hacer pull: ${e}`);
    } finally {
      setApplying(false);
      setApplyingAction('');
    }
  };

  const doPush = async (force: boolean) => {
    if (applying) return;
    setApplying(true);
    setApplyingAction(force ? 'force-push' : 'push');
    try {
      await invoke<string>('push_branch', { repoPath, branchName: currentBranch, force });
      toast.success(force ? `Force push completado en "${currentBranch}"` : `Push completado en "${currentBranch}"`);
      onRefresh?.();
      onClose();
    } catch (e) {
      toast.error(`Error al hacer push: ${e}`);
    } finally {
      setApplying(false);
      setApplyingAction('');
    }
  };

  const getActions = (): SyncAction[] => {
    const actions: SyncAction[] = [];
    if (syncStatus === 'no-remote' || syncStatus === 'loading') return actions;
    if (syncStatus === 'behind' || syncStatus === 'diverged') {
      actions.push({ key: '1', label: 'Pull', description: `Traer cambios (↓${behind})`, handler: doPull });
    }
    const nextKey = () => String(actions.length + 1);
    if (syncStatus === 'ahead' || syncStatus === 'diverged') {
      actions.push({ key: nextKey(), label: 'Push', description: `Subir cambios (↑${ahead})`, handler: () => doPush(false) });
    }
    if (syncStatus === 'no-upstream') {
      actions.push({ key: nextKey(), label: 'Publicar rama', description: 'Subir y configurar upstream', handler: () => doPush(false) });
    }
    actions.push({ key: nextKey(), label: 'Force Push', description: 'Sobrescribir historial remoto', handler: () => doPush(true) });
    return actions;
  };

  const actions = getActions();

  const renderStatusIcon = () => {
    if (syncStatus === 'loading') return '⏳';
    if (syncStatus === 'no-remote') return '🚫';
    if (syncStatus === 'synced') return '✓';
    if (actions.length === 1) {
      const a = actions[0];
      if (a.label === 'Pull') return '↓';
      if (a.label === 'Push' || a.label === 'Publicar rama') return '↑';
      if (a.label === 'Force Push') return '↑↓';
    }
    return '↕';
  };

  const renderStatusText = () => {
    if (syncStatus === 'loading') return 'Consultando estado...';
    if (syncStatus === 'no-remote') return 'No hay remoto configurado';
    if (syncStatus === 'no-upstream') return 'Rama sin upstream';
    if (syncStatus === 'synced') return 'Rama sincronizada';
    if (syncStatus === 'behind') return `Detrás por ${behind} commit${behind !== 1 ? 's' : ''}`;
    if (syncStatus === 'ahead') return `Adelantada por ${ahead} commit${ahead !== 1 ? 's' : ''}`;
    if (syncStatus === 'diverged') return `Divergida (+${ahead}/-${behind})`;
    return '';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={containerRef}
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 420, padding: 0, overflow: 'hidden' }}
      >
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{renderStatusIcon()}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{currentBranch}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{renderStatusText()}</span>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '8px 12px' }}>
          {syncStatus === 'loading' ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Obteniendo estado...</div>
          ) : actions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {syncStatus === 'synced' && 'La rama está sincronizada con el remoto.'}
              {syncStatus === 'no-remote' && 'No hay un remoto configurado para este repositorio.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {actions.map(a => {
                const isForce = a.label === 'Force Push';
                const actionKey = isForce ? 'force-push' : a.label.toLowerCase().replace(' ', '-');
                const isApplying = applying && applyingAction === actionKey;
                return (
                <button
                  key={a.key + a.label}
                  className="sync-modal-action"
                  onClick={a.handler}
                  disabled={applying}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', border: `1px solid ${isForce ? 'var(--red)' : 'var(--border)'}`, borderRadius: 6,
                    background: isApplying ? (isForce ? 'rgba(255,60,60,0.12)' : 'var(--bg-hover)') : 'var(--bg-surface)',
                    color: isForce ? 'var(--red)' : 'var(--text-primary)', cursor: applying ? 'default' : 'pointer',
                    fontSize: 13, textAlign: 'left', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!applying) (e.target as HTMLElement).style.background = isForce ? 'rgba(255,60,60,0.08)' : 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!applying) (e.target as HTMLElement).style.background = 'var(--bg-surface)'; }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: 4,
                    background: 'var(--bg-base)', border: `1px solid ${isForce ? 'var(--red)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: isForce ? 'var(--red)' : 'var(--text-muted)', flexShrink: 0,
                  }}>{a.key}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isForce ? 'var(--red)' : undefined }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: isForce ? 'var(--red)' : 'var(--text-muted)', opacity: isForce ? 0.7 : 1 }}>{a.description}</div>
                    {isForce && (
                      <div style={{ fontSize: 10, color: 'var(--red)', opacity: 0.6, marginTop: 2 }}>
                        ⚠ Sobrescribe el historial remoto. Puede causar pérdida de commits.
                      </div>
                    )}
                  </div>
                  {isApplying && (
                    <span className="spinner-sm" />
                  )}
                </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
          {actions.length > 0 && <span>1-{actions.length} seleccionar</span>}
          <span>ESC cerrar</span>
        </div>
      </div>
    </div>
  );
}
