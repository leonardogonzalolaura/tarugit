import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RepoInfo } from '../types';
import { SavedRepo } from './RepoManager';
import { BranchSelector } from './BranchSelector';

interface NavbarProps {
  repoInfo: RepoInfo | null;
  repos: SavedRepo[];
  activeRepoPath: string;
  onSelectRepo: (path: string) => void;
  onAddRepo: () => void;
  onCloneRepo: () => void;
  onShowGraph?: () => void;
  showGraph: boolean;
  onShowActions?: () => void;
  showActions: boolean;
  hasUncommittedChanges?: boolean;
  onBranchSwitch?: () => void;
  onConflictOperation?: (op: { type: 'merge' | 'rebase' }) => void;
}

type SyncStatus = 'behind' | 'ahead' | 'diverged' | 'synced' | 'no-remote' | 'no-upstream' | 'unknown';

export function Navbar({ 
  repoInfo, 
  repos, 
  activeRepoPath, 
  onSelectRepo, 
  onAddRepo, 
  onCloneRepo,
  onShowGraph,
  showGraph,
  onShowActions,
  showActions,
  hasUncommittedChanges = false,
  onBranchSwitch = () => {},
  onConflictOperation
}: NavbarProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unknown');
  const [aheadCount, setAheadCount] = useState(0);
  const [behindCount, setBehindCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  const activeRepo = repos.find(r => r.path === activeRepoPath);

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
    const check = async () => {
      try {
        const status = await invoke<{ ahead: number; behind: number; has_remote: boolean; has_upstream: boolean }>(
          'git_status_remote', { repoPath: activeRepoPath, branchName: repoInfo.current_branch }
        );
        if (!cancelled) applyRemoteStatus(status);
      } catch { if (!cancelled) setSyncStatus('unknown'); }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [repoInfo?.current_branch, activeRepoPath]);

  const updateSyncStatus = async () => {
    if (!repoInfo) return;
    try {
      const status = await invoke<{ ahead: number; behind: number; has_remote: boolean; has_upstream: boolean }>(
        'git_status_remote', { repoPath: activeRepoPath, branchName: repoInfo.current_branch }
      );
      applyRemoteStatus(status);
    } catch { }
  };

  const handlePull = async () => {
    setSyncing(true);
    setShowMenu(false);
    try {
      await invoke<string>('pull_branch', { repoPath: activeRepoPath, branchName: repoInfo!.current_branch });
      onBranchSwitch();
      await updateSyncStatus();
    } catch (_) { } finally { setSyncing(false); }
  };

  const doPush = async (force: boolean) => {
    setSyncing(true);
    setShowMenu(false);
    try {
      await invoke<string>('push_branch', { repoPath: activeRepoPath, branchName: repoInfo!.current_branch, force });
      onBranchSwitch();
      await updateSyncStatus();
    } catch (_) { } finally { setSyncing(false); }
  };

  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      if (showMenu && !(e.target as Element).closest('.sync-btn-group')) setShowMenu(false);
      if (showRepoDropdown && !(e.target as Element).closest('.navbar-repo-dropdown') && !(e.target as Element).closest('.navbar-repo-btn')) setShowRepoDropdown(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowMenu(false); setShowRepoDropdown(false); }
    };
    document.addEventListener('click', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('click', clickHandler); document.removeEventListener('keydown', keyHandler); };
  }, [showMenu, showRepoDropdown]);

  const syncLabel = syncing ? '' 
    : syncStatus === 'behind' ? `↓${behindCount}`
    : syncStatus === 'ahead' ? `↑${aheadCount}`
    : syncStatus === 'diverged' ? `↑↓`
    : syncStatus === 'no-upstream' ? '☁'
    : '✓';

  const syncTitle = syncing ? 'Sincronizando...'
    : syncStatus === 'behind' ? `Pull (${behindCount} commits)`
    : syncStatus === 'ahead' ? `Push (${aheadCount} commits)`
    : syncStatus === 'diverged' ? `↑${aheadCount} ↓${behindCount}`
    : syncStatus === 'no-upstream' ? 'Publicar rama'
    : syncStatus === 'synced' ? 'Sincronizado'
    : 'Sincronizar';

  const getMainAction = () => {
    if (syncing) return () => {};
    if (syncStatus === 'behind') return handlePull;
    if (syncStatus === 'ahead') return () => doPush(false);
    if (syncStatus === 'diverged') return () => doPush(true);
    if (syncStatus === 'no-upstream') return () => doPush(false);
    return () => {};
  };

  const isDisabled = syncing || syncStatus === 'synced' || syncStatus === 'no-remote';

  return (
    <>
      <div className="navbar">
        <div className="navbar-left">
          <button className="navbar-repo-btn" onClick={() => setShowRepoDropdown(!showRepoDropdown)}>
            <svg className="navbar-repo-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
            </svg>
            <span className="navbar-repo-name">{activeRepo?.name || 'Seleccionar repositorio'}</span>
            <span className="navbar-repo-chevron">▼</span>
          </button>

          {showRepoDropdown && (
            <div className="navbar-repo-dropdown">
              <div className="navbar-repo-dropdown-header">Repositorios</div>
              <div className="navbar-repo-dropdown-actions">
                <button className="navbar-repo-action" onClick={() => { setShowRepoDropdown(false); onAddRepo(); }}>+ Agregar</button>
                <button className="navbar-repo-action" onClick={() => { setShowRepoDropdown(false); onCloneRepo(); }}>📥 Clonar</button>
              </div>
              <div className="navbar-repo-dropdown-list">
                {repos.map(r => (
                  <button key={r.id} className={`navbar-repo-item ${r.path === activeRepoPath ? 'active' : ''}`}
                    onClick={() => { onSelectRepo(r.path); setShowRepoDropdown(false); }}>
                    <span className="navbar-repo-item-info">
                      <span className="navbar-repo-item-name">{r.name}</span>
                      <span className="navbar-repo-item-path">{r.path}</span>
                    </span>
                    {r.path === activeRepoPath && <span className="navbar-repo-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {repoInfo && (
            <>
              <span className="navbar-sep" />
              <BranchSelector
                repoPath={activeRepoPath}
                currentBranch={repoInfo.current_branch}
                hasUncommittedChanges={hasUncommittedChanges}
                onBranchSwitch={onBranchSwitch}
                onConflictOperation={onConflictOperation}
              />
              <span className="navbar-sep" />
              <div className="sync-btn-group" style={{ position: 'relative' }}>
                <button className="sync-btn" onClick={getMainAction()} disabled={isDisabled} title={syncTitle}>
                  {syncing ? <span className="spinner-sm" /> : <span className="sync-icon">{syncLabel}</span>}
                </button>
                <button className="sync-chevron" onClick={e => { e.stopPropagation(); if (!syncing) setShowMenu(!showMenu); }} disabled={syncing}>▼</button>
                {showMenu && !syncing && (
                  <div className="sync-dropdown">
                    <div className="sync-dropdown-header">
                      <span className="sync-branch">{repoInfo.current_branch}</span>
                      <span className="sync-detail">
                        {syncStatus === 'no-upstream' ? 'Sin upstream'
                          : syncStatus === 'diverged' ? 'Divergido'
                          : aheadCount > 0 && behindCount > 0 ? `↑${aheadCount} ↓${behindCount}`
                          : aheadCount > 0 ? `↑${aheadCount}`
                          : behindCount > 0 ? `↓${behindCount}`
                          : 'Sincronizado'}
                      </span>
                    </div>
                    <button className="sync-menu-item" onClick={() => { handlePull(); }} disabled={syncStatus === 'no-upstream'}>
                      <span>⬇️</span> Pull{behindCount > 0 ? ` (${behindCount})` : ''}
                    </button>
                    <button className="sync-menu-item" onClick={() => { doPush(false); }}>
                      <span>{syncStatus === 'no-upstream' ? '☁️' : '⬆️'}</span>
                      {syncStatus === 'no-upstream' ? 'Publicar rama' : `Push${aheadCount > 0 ? ` (${aheadCount})` : ''}`}
                    </button>
                    <div className="sync-divider" />
                    <button className="sync-menu-item danger" onClick={() => { doPush(true); }}>
                      <span>⚠️</span> Force Push
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="navbar-right">
          {repoInfo && (
            <button
              className={`navbar-graph-btn${showGraph ? ' active' : ''}`}
              onClick={onShowGraph}
              title={showGraph ? 'Cerrar grafo' : 'Ver grafo de commits'}
            >
              🌳 <span style={{ fontSize: 11 }}>Grafo</span>
            </button>
          )}
          {repoInfo && (
            <button
              className={`navbar-graph-btn${showActions ? ' active' : ''}`}
              onClick={onShowActions}
              title={showActions ? 'Cerrar Actions' : 'Ver GitHub Actions'}
            >
              ⚡ <span style={{ fontSize: 11 }}>Actions</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
