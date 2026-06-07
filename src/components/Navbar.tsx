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
  onRemoveRepo: (id: string) => void;
  onAddRepo: () => void;
  onCloneRepo: () => void;
  hasUncommittedChanges?: boolean;
  onBranchSwitch?: () => void;
  onConflictOperation?: (op: { type: 'merge' | 'rebase' }) => void;
}

type SyncStatus = 'behind' | 'ahead' | 'diverged' | 'synced' | 'no-remote' | 'unknown';

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
  
  const activeRepo = repos.find(r => r.path === activeRepoPath);
  const sorted = [...repos].sort((a, b) => {
    if (a.path === activeRepoPath) return -1;
    if (b.path === activeRepoPath) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  // Detectar estado de sincronización con el remoto
  useEffect(() => {
    if (!repoInfo || !activeRepoPath) return;
    
    const checkSyncStatus = async () => {
      try {
        const status = await invoke<{ ahead: number; behind: number; has_remote: boolean }>('git_status_remote', {
          repoPath: activeRepoPath,
          branchName: repoInfo.current_branch
        });
        
        setAheadCount(status.ahead);
        setBehindCount(status.behind);
        
        if (!status.has_remote) {
          setSyncStatus('no-remote');
        } else if (status.ahead > 0 && status.behind > 0) {
          setSyncStatus('diverged');
        } else if (status.ahead > 0) {
          setSyncStatus('ahead');
        } else if (status.behind > 0) {
          setSyncStatus('behind');
        } else {
          setSyncStatus('synced');
        }
      } catch (error) {
        console.error('Error checking sync status:', error);
        setSyncStatus('unknown');
      }
    };
    
    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 10000);
    return () => clearInterval(interval);
  }, [repoInfo, activeRepoPath]);

  const handlePull = async () => {
    if (!repoInfo) return;
    setSyncing(true);
    setShowMenu(false);
    try {
      const result = await invoke<string>('pull_branch', {
        repoPath: activeRepoPath,
        branchName: repoInfo.current_branch
      });
      alert(result);
      onBranchSwitch();
      await updateSyncStatus();
    } catch (e) {
      alert(`❌ Error al hacer pull:\n${e}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePush = async (force = false) => {
    if (!repoInfo) return;
    if (force && !confirm(`⚠️ ¿FORCE PUSH en "${repoInfo.current_branch}"?\n\nSobrescribirás la rama remota. Esta acción es irreversible.`)) {
      return;
    }
    setSyncing(true);
    setShowMenu(false);
    try {
      const result = await invoke<string>('push_branch', {
        repoPath: activeRepoPath,
        branchName: repoInfo.current_branch,
        force
      });
      alert(result);
      onBranchSwitch();
      await updateSyncStatus();
    } catch (e) {
      alert(`❌ Error al hacer push:\n${e}`);
    } finally {
      setSyncing(false);
    }
  };

  const updateSyncStatus = async () => {
    try {
      const status = await invoke<{ ahead: number; behind: number; has_remote: boolean }>('git_status_remote', {
        repoPath: activeRepoPath,
        branchName: repoInfo?.current_branch
      });
      setAheadCount(status.ahead);
      setBehindCount(status.behind);
      if (!status.has_remote) {
        setSyncStatus('no-remote');
      } else if (status.ahead > 0 && status.behind > 0) {
        setSyncStatus('diverged');
      } else if (status.ahead > 0) {
        setSyncStatus('ahead');
      } else if (status.behind > 0) {
        setSyncStatus('behind');
      } else {
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Estados del botón - usando las variables CSS de tu app
  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'behind':
        return {
          icon: '⬇️',
          text: `Pull`,
          count: behindCount,
          bgClass: 'sync-btn--pull',
          badgeBg: 'var(--accent)'
        };
      case 'ahead':
        return {
          icon: '⬆️',
          text: `Push`,
          count: aheadCount,
          bgClass: 'sync-btn--push',
          badgeBg: 'var(--green)'
        };
      case 'diverged':
        return {
          icon: '⚠️',
          text: `Divergido`,
          count: null,
          bgClass: 'sync-btn--diverged',
          badgeBg: 'var(--yellow)'
        };
      case 'synced':
        return {
          icon: '✓',
          text: `Sincronizado`,
          count: null,
          bgClass: 'sync-btn--synced',
          badgeBg: 'var(--text-muted)'
        };
      case 'no-remote':
        return {
          icon: '🔗',
          text: `Sin remoto`,
          count: null,
          bgClass: 'sync-btn--no-remote',
          badgeBg: 'var(--text-muted)'
        };
      default:
        return {
          icon: '🔄',
          text: `Sincronizar`,
          count: null,
          bgClass: 'sync-btn--default',
          badgeBg: 'var(--accent)'
        };
    }
  };

  const statusConfig = getStatusConfig();
  const isDisabled = syncing || syncStatus === 'synced' || syncStatus === 'no-remote';
  const showCountBadge = (syncStatus === 'behind' || syncStatus === 'ahead') && statusConfig.count && statusConfig.count > 0;

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

  const getMainAction = () => {
    if (syncStatus === 'behind') return handlePull;
    if (syncStatus === 'ahead') return () => handlePush(false);
    if (syncStatus === 'diverged') return handlePull;
    return () => {};
  };

  return (
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

          <button
            onClick={onAddRepo}
            title="Agregar repositorio"
            className="btn-icon"
            style={{ fontSize: '14px', fontWeight: 700 }}
          >+</button>
          <button
            onClick={onCloneRepo}
            title="Clonar repositorio"
            className="btn-icon"
          >📥</button>
        </div>

        {/* BranchSelector y Botón Inteligente - Estilo consistente con tu UI */}
        {repoInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
            <BranchSelector
              repoPath={activeRepoPath}
              currentBranch={repoInfo.current_branch}
              hasUncommittedChanges={hasUncommittedChanges}
              onBranchSwitch={onBranchSwitch}
              onConflictOperation={onConflictOperation}
            />

            {/* Botón Inteligente - Estilo consistente con branch-selector */}
            <div className="sync-menu-container" style={{ position: 'relative' }}>
              <button
                className={`sync-btn ${statusConfig.bgClass}`}
                onClick={getMainAction()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isDisabled) setShowMenu(!showMenu);
                }}
                disabled={isDisabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isDisabled ? 0.5 : 1,
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }
                }}
              >
                <span style={{ fontSize: '12px' }}>{statusConfig.icon}</span>
                <span>{statusConfig.text}</span>
                <span style={{ fontSize: '9px', marginLeft: '2px', opacity: 0.6 }}>▼</span>
                
                {/* Badge de commits pendientes como el estilo de tus badges */}
                {showCountBadge && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: statusConfig.badgeBg,
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {statusConfig.count}
                  </span>
                )}
              </button>

              {/* Spinner de carga inline */}
              {syncing && (
                <span className="spinner-sm" style={{ marginLeft: '4px' }} />
              )}

              {/* Menú desplegable - Estilo consistente con branch-selector-dropdown */}
              {showMenu && (
                <div 
                  className="branch-selector-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '260px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {repoInfo.current_branch}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {aheadCount > 0 && `↑ ${aheadCount} commit${aheadCount !== 1 ? 's' : ''} local(es) `}
                      {behindCount > 0 && `↓ ${behindCount} commit${behindCount !== 1 ? 's' : ''} remoto(s)`}
                      {aheadCount === 0 && behindCount === 0 && '✓ Sincronizado con remoto'}
                    </div>
                  </div>
                  
                  <button
                    onClick={handlePull}
                    disabled={syncing}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: syncing ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background 0.15s',
                      opacity: syncing ? 0.5 : 1,
                      fontFamily: 'var(--font-mono)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>⬇️</span> Pull {behindCount > 0 && `(${behindCount})`}
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>⌘P</span>
                  </button>
                  
                  <button
                    onClick={() => handlePush(false)}
                    disabled={syncing}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: syncing ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background 0.15s',
                      opacity: syncing ? 0.5 : 1,
                      fontFamily: 'var(--font-mono)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>⬆️</span> Push {aheadCount > 0 && `(${aheadCount})`}
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>⌘⇧P</span>
                  </button>
                  
                  <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                  
                  <button
                    onClick={() => handlePush(true)}
                    disabled={syncing}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--red)',
                      textAlign: 'left',
                      cursor: syncing ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background 0.15s',
                      opacity: syncing ? 0.5 : 1,
                      fontFamily: 'var(--font-mono)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--red-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>⚠️</span> Force Push
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--red)' }}>peligroso</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}