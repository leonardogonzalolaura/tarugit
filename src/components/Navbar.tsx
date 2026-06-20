import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RepoInfo } from '../types';
import { SavedRepo } from './RepoManager';
import { BranchSelector } from './BranchSelector';

interface NavbarProps {
  repoInfo: RepoInfo | null;
  repos: SavedRepo[];
  activeRepoPath: string;
  onSelectRepo: (path: string) => void;
  onRemoveRepo: (id: string) => void;
  onAddRepo: () => void;
  onCloneRepo: () => void;
  hasUncommittedChanges?: boolean;
  onBranchSwitch?: () => void;
  onConflictOperation?: (op: { type: 'merge' | 'rebase' }) => void;
}

type SyncStatus = 'behind' | 'ahead' | 'diverged' | 'synced' | 'no-remote' | 'no-upstream' | 'unknown';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ConfirmModal {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

let toastCounter = 0;

export function Navbar({ 
  repoInfo, 
  repos, 
  activeRepoPath, 
  onSelectRepo, 
  onAddRepo, 
  onCloneRepo,
  hasUncommittedChanges = false,
  onBranchSwitch = () => {},
  onConflictOperation
}: NavbarProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unknown');
  const [aheadCount, setAheadCount] = useState(0);
  const [behindCount, setBehindCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

  const activeRepo = repos.find(r => r.path === activeRepoPath);
  const sorted = [...repos].sort((a, b) => {
    if (a.path === activeRepoPath) return -1;
    if (b.path === activeRepoPath) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const askConfirm = (modal: ConfirmModal) => setConfirmModal(modal);

  const applyRemoteStatus = (status: { ahead: number; behind: number; has_remote: boolean; has_upstream: boolean }) => {
    setAheadCount(status.ahead);
    setBehindCount(status.behind);
    if (!status.has_remote) setSyncStatus('no-remote');
    else if (!status.has_upstream) setSyncStatus('no-upstream');
    else if (status.ahead > 0 && status.behind > 0) setSyncStatus('diverged');
    else if (status.ahead > 0) setSyncStatus('ahead');
    else if (status.behind > 0) setSyncStatus('behind');
    else setSyncStatus('synced');
  };

  useEffect(() => {
    if (!repoInfo || !activeRepoPath) return;
    let cancelled = false;
    const checkSyncStatus = async () => {
      try {
        const status = await invoke<{ ahead: number; behind: number; has_remote: boolean; has_upstream: boolean }>(
          'git_status_remote', { repoPath: activeRepoPath, branchName: repoInfo.current_branch }
        );
        if (!cancelled) applyRemoteStatus(status);
      } catch { if (!cancelled) setSyncStatus('unknown'); }
    };
    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [repoInfo?.current_branch, activeRepoPath]);

  const updateSyncStatus = async () => {
    if (!repoInfo) return;
    try {
      const status = await invoke<{ ahead: number; behind: number; has_remote: boolean; has_upstream: boolean }>(
        'git_status_remote', { repoPath: activeRepoPath, branchName: repoInfo.current_branch }
      );
      applyRemoteStatus(status);
    } catch { /* silencioso */ }
  };

  const handlePull = async () => {
    if (!repoInfo) return;
    setSyncing(true);
    setShowMenu(false);
    try {
      await invoke<string>('pull_branch', { repoPath: activeRepoPath, branchName: repoInfo.current_branch });
      showToast('Pull completado con éxito', 'success');
      onBranchSwitch();
      await updateSyncStatus();
    } catch (e) {
      showToast(`Error al hacer pull: ${e}`, 'error');
    } finally { setSyncing(false); }
  };

  const doPush = async (force: boolean) => {
    setSyncing(true);
    setShowMenu(false);
    try {
      await invoke<string>('push_branch', { repoPath: activeRepoPath, branchName: repoInfo!.current_branch, force });
      if (force) showToast('Force push completado', 'warning');
      else if (syncStatus === 'no-upstream') showToast(`Rama "${repoInfo!.current_branch}" publicada en origin`, 'success');
      else showToast('Push completado con éxito', 'success');
      onBranchSwitch();
      await updateSyncStatus();
    } catch (e) {
      const msg = String(e);
      const isDiverge = msg.includes('non-fast-forward') || msg.includes('fetch first') || msg.includes('rejected');
      if (isDiverge && !force) {
        showToast('Historial divergente. Usa Force Push para sobrescribir.', 'warning');
        setSyncStatus('diverged');
      } else {
        showToast(`Error al hacer push: ${msg}`, 'error');
      }
    } finally { setSyncing(false); }
  };

  const handlePush = (force = false) => {
    if (!repoInfo) return;
    if (force) {
      askConfirm({
        title: 'Force Push',
        body: `Vas a sobrescribir la rama remota "${repoInfo.current_branch}" con tu historial local.\n\nEsto es útil después de un squash o rebase, pero eliminará commits remotos que no estén en tu rama.\n\n¿Continuar?`,
        confirmLabel: 'Sí, hacer Force Push',
        danger: true,
        onConfirm: () => { setConfirmModal(null); doPush(true); }
      });
    } else { doPush(false); }
  };

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'behind': return { icon: '⬇️', text: 'Pull', count: behindCount, badgeBg: 'var(--accent)' };
      case 'ahead': return { icon: '⬆️', text: 'Push', count: aheadCount, badgeBg: 'var(--green)' };
      case 'diverged': return { icon: '⚡', text: 'Divergido', count: null, badgeBg: 'var(--yellow)' };
      case 'synced': return { icon: '✓', text: 'Sincronizado', count: null, badgeBg: 'var(--text-muted)' };
      case 'no-remote': return { icon: '🔗', text: 'Sin remoto', count: null, badgeBg: 'var(--text-muted)' };
      case 'no-upstream': return { icon: '☁️', text: 'Publicar', count: null, badgeBg: 'var(--accent)' };
      default: return { icon: '🔄', text: 'Sincronizar', count: null, badgeBg: 'var(--accent)' };
    }
  };

  const statusConfig = getStatusConfig();
  const isDisabled = syncing || syncStatus === 'synced' || syncStatus === 'no-remote';
  const showCountBadge = (syncStatus === 'behind' || syncStatus === 'ahead') && statusConfig.count && statusConfig.count > 0;

  const getMainAction = () => {
    if (syncing) return () => {};
    if (syncStatus === 'behind') return handlePull;
    if (syncStatus === 'ahead') return () => handlePush(false);
    if (syncStatus === 'diverged') return () => handlePush(true);
    if (syncStatus === 'no-upstream') return () => handlePush(false);
    return () => {};
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMenu && !(e.target as Element).closest('.sync-btn-group')) setShowMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  return (
    <>
      <div style={{
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            style={{
              pointerEvents: 'all', padding: '10px 14px', borderRadius: '8px',
              fontSize: '12px', fontFamily: 'var(--font-mono)', maxWidth: '340px',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5',
              cursor: 'pointer', animation: 'toastIn 0.25s ease',
              background: toast.type === 'error' ? 'var(--red-bg, #3a1010)'
                : toast.type === 'success' ? 'var(--green-bg, #0e2a1a)'
                : toast.type === 'warning' ? 'var(--yellow-bg, #2a200a)'
                : 'var(--bg-elevated)',
              border: `1px solid ${
                toast.type === 'error' ? 'var(--red)'
                : toast.type === 'success' ? 'var(--green)'
                : toast.type === 'warning' ? 'var(--yellow)'
                : 'var(--border)'}`,
              color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {confirmModal && (
        <div className="confirm-overlay" onClick={() => setConfirmModal(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}
            style={{ borderColor: confirmModal.danger ? 'var(--red)' : 'var(--border)' }}>
            <h3 className={`confirm-title ${confirmModal.danger ? 'confirm-title--danger' : ''}`}>
              {confirmModal.title}
            </h3>
            <p className="confirm-body">{confirmModal.body}</p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmModal.onConfirm}
                style={{ background: confirmModal.danger ? 'var(--red)' : 'var(--accent)', color: 'white' }}>
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">♉</span>
          <h1 className="navbar-title">TaruGit</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <select
              value={activeRepo?.id || ''}
              onChange={e => { const repo = repos.find(r => r.id === e.target.value); if (repo) onSelectRepo(repo.path); }}
              className="navbar-repo-select"
              style={{ color: activeRepo ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {sorted.length === 0 && <option value="">— sin repositorios —</option>}
              {sorted.map(repo => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}{repo.currentBranch ? ` (${repo.currentBranch})` : ''}{repo.hasChanges ? ' ●' : ''}
                </option>
              ))}
            </select>

            <button onClick={onAddRepo} title="Agregar repositorio" className="btn-icon" style={{ fontSize: '14px', fontWeight: 700 }}>+</button>
            <button onClick={onCloneRepo} title="Clonar repositorio" className="btn-icon">📥</button>
          </div>

          {repoInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
              <BranchSelector
                repoPath={activeRepoPath}
                currentBranch={repoInfo.current_branch}
                hasUncommittedChanges={hasUncommittedChanges}
                onBranchSwitch={onBranchSwitch}
                onConflictOperation={onConflictOperation}
              />

              <div className="sync-btn-group">
                <button
                  className={`sync-btn-main ${syncStatus === 'diverged' ? 'sync-btn-main--diverged' : ''} ${syncStatus === 'no-upstream' ? 'sync-btn-main--no-upstream' : ''}`}
                  onClick={getMainAction()}
                  disabled={isDisabled}
                  title={syncStatus === 'diverged' ? "Divergido: Clic para Force Push" : ""}
                >
                  {syncing ? <span className="spinner-sm" /> : <span style={{ fontSize: '12px' }}>{statusConfig.icon}</span>}
                  <span>{syncing ? 'Sincronizando…' : statusConfig.text}</span>
                  {showCountBadge && !syncing && (
                    <span style={{ marginLeft: '6px', background: statusConfig.badgeBg, color: 'white', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '10px' }}>
                      {statusConfig.count}
                    </span>
                  )}
                </button>

                <button
                  className="sync-btn-dropdown"
                  onClick={e => { e.stopPropagation(); if (!syncing) setShowMenu(!showMenu); }}
                  disabled={syncing}
                  title="Opciones de sincronización"
                >▼</button>

                {showMenu && !syncing && (
                  <div className="navbar-menu">
                    <div className="navbar-menu-header">
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {repoInfo.current_branch}
                      </div>
                      <div style={{ fontSize: '11px', color: syncStatus === 'diverged' ? 'var(--yellow)' : syncStatus === 'no-upstream' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {syncStatus === 'no-upstream' && '☁️ Rama solo existe localmente — usa Publicar'}
                        {syncStatus === 'diverged' && '⚡ Historial divergente detectado'}
                        {syncStatus !== 'no-upstream' && syncStatus !== 'diverged' && (
                          <>{aheadCount > 0 && `↑ ${aheadCount} commit${aheadCount !== 1 ? 's' : ''} local(es)  `}{behindCount > 0 && `↓ ${behindCount} commit${behindCount !== 1 ? 's' : ''} remoto(s)`}{aheadCount === 0 && behindCount === 0 && '✓ Sincronizado con remoto'}</>
                        )}
                      </div>
                    </div>

                    {syncStatus === 'diverged' ? (
                      <div style={{ padding: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.4' }}>
                          Tu rama local y la remota tienen commits diferentes. Elige una acción:
                        </div>
                        <button onClick={() => handlePush(true)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '12px' }}>
                            ⚠️ Force Push <span style={{ fontSize: '9px', background: 'var(--yellow)', color: 'black', padding: '1px 4px', borderRadius: '3px' }}>Recomendado</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Sobrescribe el remoto con tus commits locales.</div>
                        </button>
                        <button onClick={handlePull}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '12px' }}>⬇️ Pull & Merge</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Trae los cambios remotos con merge.</div>
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={handlePull} disabled={syncStatus === 'no-upstream'} className="navbar-menu-item">
                          <span>⬇️</span> Pull {behindCount > 0 && `(${behindCount})`}
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>⌘P</span>
                        </button>
                        <button onClick={() => handlePush(false)} className="navbar-menu-item" style={{ borderBottom: 'none' }}>
                          <span>{syncStatus === 'no-upstream' ? '☁️' : '⬆️'}</span>
                          {syncStatus === 'no-upstream' ? 'Publicar rama' : `Push ${aheadCount > 0 ? `(${aheadCount})` : ''}`}
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>⌘⇧P</span>
                        </button>
                        <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                        <button onClick={() => handlePush(true)} disabled={syncStatus === 'no-upstream'}
                          className="navbar-menu-item navbar-menu-item--danger" style={{ borderBottom: 'none' }}>
                          <span>⚠️</span> Force Push
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--red)' }}>peligroso</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
