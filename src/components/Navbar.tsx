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

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Confirm modal ────────────────────────────────────────────────────────────
  const askConfirm = (modal: ConfirmModal) => setConfirmModal(modal);

  // ── Sync status ──────────────────────────────────────────────────────────────
  const applyRemoteStatus = (status: { ahead: number; behind: number; has_remote: boolean; has_upstream: boolean }) => {
    setAheadCount(status.ahead);
    setBehindCount(status.behind);
    if (!status.has_remote) {
      setSyncStatus('no-remote');
    } else if (!status.has_upstream) {
      setSyncStatus('no-upstream');
    } else if (status.ahead > 0 && status.behind > 0) {
      setSyncStatus('diverged');
    } else if (status.ahead > 0) {
      setSyncStatus('ahead');
    } else if (status.behind > 0) {
      setSyncStatus('behind');
    } else {
      setSyncStatus('synced');
    }
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
      } catch {
        if (!cancelled) setSyncStatus('unknown');
      }
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

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handlePull = async () => {
    if (!repoInfo) return;
    setSyncing(true);
    setShowMenu(false);
    try {
      await invoke<string>('pull_branch', {
        repoPath: activeRepoPath,
        branchName: repoInfo.current_branch
      });
      showToast('⬇️ Pull completado con éxito', 'success');
      onBranchSwitch();
      await updateSyncStatus();
    } catch (e) {
      const msg = String(e);
      showToast(`❌ Error al hacer pull:\n${msg}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const doPush = async (force: boolean) => {
    setSyncing(true);
    setShowMenu(false);
    try {
      await invoke<string>('push_branch', {
        repoPath: activeRepoPath,
        branchName: repoInfo!.current_branch,
        force
      });
      if (force) {
        showToast('⚠️ Force push completado', 'warning');
      } else if (syncStatus === 'no-upstream') {
        showToast(`☁️ Rama "${repoInfo!.current_branch}" publicada en origin`, 'success');
      } else {
        showToast('⬆️ Push completado con éxito', 'success');
      }
      onBranchSwitch();
      await updateSyncStatus();
    } catch (e) {
      const msg = String(e);
      // Si el error contiene "non-fast-forward" o "fetch first", sugerir force push
      const isSquashDiverge = msg.includes('non-fast-forward') || msg.includes('fetch first') || msg.includes('rejected');
      if (isSquashDiverge && !force) {
        showToast('⚡ Historial divergente (ej. squash). Usa Force Push para sobreescribir el remoto.', 'warning');
        setSyncStatus('diverged');
      } else {
        showToast(`❌ Error al hacer push:\n${msg}`, 'error');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handlePush = (force = false) => {
    if (!repoInfo) return;
    if (force) {
      askConfirm({
        title: '⚠️ Force Push',
        body: `Vas a sobreescribir la rama remota "${repoInfo.current_branch}" con tu historial local.\n\nEsto es útil después de un squash o rebase, pero eliminará commits remotos que no estén en tu rama.\n\n¿Continuar?`,
        confirmLabel: 'Sí, hacer Force Push',
        danger: true,
        onConfirm: () => { setConfirmModal(null); doPush(true); }
      });
    } else {
      doPush(false);
    }
  };

  // ── Botón inteligente ─────────────────────────────────────────────────────────
  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'behind':
        return { icon: '⬇️', text: 'Pull', count: behindCount, bgClass: 'sync-btn--pull', badgeBg: 'var(--accent)' };
      case 'ahead':
        return { icon: '⬆️', text: 'Push', count: aheadCount, bgClass: 'sync-btn--push', badgeBg: 'var(--green)' };
      case 'diverged':
        return { icon: '⚡', text: 'Divergido', count: null, bgClass: 'sync-btn--diverged', badgeBg: 'var(--yellow)' };
      case 'synced':
        return { icon: '✓', text: 'Sincronizado', count: null, bgClass: 'sync-btn--synced', badgeBg: 'var(--text-muted)' };
      case 'no-remote':
        return { icon: '🔗', text: 'Sin remoto', count: null, bgClass: 'sync-btn--no-remote', badgeBg: 'var(--text-muted)' };
      case 'no-upstream':
        return { icon: '☁️', text: 'Publicar', count: null, bgClass: 'sync-btn--no-upstream', badgeBg: 'var(--accent)' };
      default:
        return { icon: '🔄', text: 'Sincronizar', count: null, bgClass: 'sync-btn--default', badgeBg: 'var(--accent)' };
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

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMenu && !(e.target as Element).closest('.sync-menu-container')) {
        setShowMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  const menuItemStyle = (disabled = false): React.CSSProperties => ({
    width: '100%',
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-light)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    textAlign: 'left',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'background 0.15s',
    fontFamily: 'var(--font-mono)'
  });

  return (
    <>
      {/* ── Toast container ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            style={{
              pointerEvents: 'all',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              maxWidth: '340px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.5',
              cursor: 'pointer',
              animation: 'toastIn 0.25s ease',
              background: toast.type === 'error' ? 'var(--red-bg, #3a1010)'
                : toast.type === 'success' ? 'var(--green-bg, #0e2a1a)'
                : toast.type === 'warning' ? 'var(--yellow-bg, #2a200a)'
                : 'var(--bg-elevated)',
              border: `1px solid ${
                toast.type === 'error' ? 'var(--red)'
                : toast.type === 'success' ? 'var(--green)'
                : toast.type === 'warning' ? 'var(--yellow)'
                : 'var(--border)'}`,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.4))'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* ── Confirm modal ─────────────────────────────────────────────────────── */}
      {confirmModal && (
        <div
          onClick={() => setConfirmModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${confirmModal.danger ? 'var(--red)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: confirmModal.danger ? 'var(--red)' : 'var(--text-primary)' }}>
              {confirmModal.title}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {confirmModal.body}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)',
                  background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                  fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-mono)'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  background: confirmModal.danger ? 'var(--red)' : 'var(--accent)',
                  color: 'white', fontSize: '12px', cursor: 'pointer',
                  fontWeight: 600, fontFamily: 'var(--font-mono)'
                }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Navbar ────────────────────────────────────────────────────────────── */}
      <div className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">♉</span>
          <h1 className="navbar-title">TaruGit</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <select
              value={activeRepo?.id || ''}
              onChange={e => {
                const repo = repos.find(r => r.id === e.target.value);
                if (repo) onSelectRepo(repo.path);
              }}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-elevated)',
                color: activeRepo ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                width: '320px',
                outline: 'none'
              }}
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

          {/* BranchSelector + Botón inteligente */}
          {repoInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
              <BranchSelector
                repoPath={activeRepoPath}
                currentBranch={repoInfo.current_branch}
                hasUncommittedChanges={hasUncommittedChanges}
                onBranchSwitch={onBranchSwitch}
                onConflictOperation={onConflictOperation}
              />

              <div className="sync-menu-container" style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                {/* Botón principal (Acción por defecto) */}
                <button
                  className={`sync-btn ${statusConfig.bgClass}`}
                  onClick={getMainAction()}
                  disabled={isDisabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px',
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${syncStatus === 'diverged' ? 'var(--yellow)' : syncStatus === 'no-upstream' ? 'var(--accent)' : 'var(--border)'}`,
                    borderRight: 'none',
                    borderTopLeftRadius: '6px',
                    borderBottomLeftRadius: '6px',
                    borderTopRightRadius: '0px',
                    borderBottomRightRadius: '0px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!isDisabled) {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.borderColor = syncStatus === 'diverged' ? 'var(--yellow)' : 'var(--accent)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isDisabled) {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      e.currentTarget.style.borderColor = syncStatus === 'diverged' ? 'var(--yellow)' : syncStatus === 'no-upstream' ? 'var(--accent)' : 'var(--border)';
                    }
                  }}
                 title={syncStatus === 'diverged' ? "Divergido: Clic para Force Push o usa la flecha para elegir" : ""}
                >
                  {syncing
                    ? <span className="spinner-sm" />
                    : <span style={{ fontSize: '12px' }}>{statusConfig.icon}</span>
                  }
                  <span>{syncing ? 'Sincronizando…' : statusConfig.text}</span>
                  {showCountBadge && !syncing && (
                    <span style={{
                      marginLeft: '6px',
                      background: statusConfig.badgeBg, color: 'white',
                      fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                      borderRadius: '10px', fontFamily: 'var(--font-mono)'
                    }}>
                      {statusConfig.count}
                    </span>
                  )}
                </button>

                {/* Botón de Flecha Dropdown */}
                <button
                  onClick={e => { e.stopPropagation(); if (!syncing) setShowMenu(!showMenu); }}
                  disabled={syncing}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '4px 8px',
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${syncStatus === 'diverged' ? 'var(--yellow)' : syncStatus === 'no-upstream' ? 'var(--accent)' : 'var(--border)'}`,
                    borderTopRightRadius: '6px',
                    borderBottomRightRadius: '6px',
                    borderTopLeftRadius: '0px',
                    borderBottomLeftRadius: '0px',
                    color: 'var(--text-primary)',
                    fontSize: '10px',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    opacity: syncing ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (!syncing) {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.borderColor = syncStatus === 'diverged' ? 'var(--yellow)' : 'var(--accent)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!syncing) {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      e.currentTarget.style.borderColor = syncStatus === 'diverged' ? 'var(--yellow)' : syncStatus === 'no-upstream' ? 'var(--accent)' : 'var(--border)';
                    }
                  }}
                  title="Opciones de sincronización"
                >
                  ▼
                </button>

                {/* Menú desplegable */}
                {showMenu && !syncing && (
                  <div
                    className="branch-selector-dropdown"
                    style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                      width: '300px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-md)',
                      zIndex: 1000, overflow: 'hidden'
                    }}
                  >
                    {/* Header info */}
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {repoInfo.current_branch}
                      </div>
                      <div style={{ fontSize: '11px', color: syncStatus === 'diverged' ? 'var(--yellow)' : syncStatus === 'no-upstream' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {syncStatus === 'no-upstream' && '☁️ Rama solo existe localmente — usa Publicar'}
                        {syncStatus === 'diverged' && '⚡ Historial divergente detectado'}
                        {syncStatus !== 'no-upstream' && syncStatus !== 'diverged' && (
                          <>
                            {aheadCount > 0 && `↑ ${aheadCount} commit${aheadCount !== 1 ? 's' : ''} local(es)  `}
                            {behindCount > 0 && `↓ ${behindCount} commit${behindCount !== 1 ? 's' : ''} remoto(s)`}
                            {aheadCount === 0 && behindCount === 0 && '✓ Sincronizado con remoto'}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Vista para estado Divergido */}
                    {syncStatus === 'diverged' ? (
                      <div style={{ padding: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.4' }}>
                          Tu rama local y la remota tienen commits diferentes. Elige una acción:
                        </div>
                        
                        {/* Opción recomendada: Force Push */}
                        <button
                          onClick={() => handlePush(true)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginBottom: '8px'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            e.currentTarget.style.borderColor = '#ef4444';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '12px' }}>
                            ⚠️ Force Push <span style={{ fontSize: '9px', background: 'var(--yellow)', color: 'black', padding: '1px 4px', borderRadius: '3px' }}>Recomendado (Squash/Rebase)</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Sobrescribe el remoto con tus commits locales (peligroso si otros trabajan aquí).
                          </div>
                        </button>

                        {/* Opción alternativa: Pull & Merge */}
                        <button
                          onClick={handlePull}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#60a5fa',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                            e.currentTarget.style.borderColor = '#3b82f6';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '12px' }}>
                            ⬇️ Pull & Merge
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Trae los cambios remotos e incorpóralos creando un commit de combinación (merge).
                          </div>
                        </button>
                      </div>
                    ) : (
                      // Vista estándar para otros estados
                      <>
                        {/* Pull */}
                        <button
                          onClick={handlePull}
                          disabled={syncStatus === 'no-upstream'}
                          style={menuItemStyle(syncStatus === 'no-upstream')}
                          onMouseEnter={e => { if (syncStatus !== 'no-upstream') e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span>⬇️</span> Pull {behindCount > 0 && `(${behindCount})`}
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>⌘P</span>
                        </button>

                        {/* Push / Publicar */}
                        <button
                          onClick={() => handlePush(false)}
                          style={{ ...menuItemStyle(), borderBottom: 'none' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span>{syncStatus === 'no-upstream' ? '☁️' : '⬆️'}</span>
                          {syncStatus === 'no-upstream' ? 'Publicar rama' : `Push ${aheadCount > 0 ? `(${aheadCount})` : ''}`}
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>⌘⇧P</span>
                        </button>

                        <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                        {/* Force Push */}
                        <button
                          onClick={() => handlePush(true)}
                          disabled={syncStatus === 'no-upstream'}
                          style={{
                            ...menuItemStyle(syncStatus === 'no-upstream'),
                            color: syncStatus === 'no-upstream' ? 'var(--text-muted)' : 'var(--red)',
                            borderBottom: 'none',
                            background: 'transparent'
                          }}
                          onMouseEnter={e => { if (syncStatus !== 'no-upstream') e.currentTarget.style.background = 'var(--red-bg)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span>⚠️</span>
                          Force Push
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