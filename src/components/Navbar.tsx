import { useState } from 'react';
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
  const activeRepo = repos.find(r => r.path === activeRepoPath);
  const sorted = [...repos].sort((a, b) => {
    if (a.path === activeRepoPath) return -1;
    if (b.path === activeRepoPath) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  const handlePull = async () => {
    if (!repoInfo) return;
    setSyncing(true);
    try {
      const result = await invoke<string>('pull_branch', {
        repoPath: activeRepoPath,
        branchName: repoInfo.current_branch
      });
      alert(result);
      onBranchSwitch();
    } catch (e) {
      alert(`❌ Error al hacer pull:\n${e}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePush = async (force = false) => {
    if (!repoInfo) return;
    if (force && !confirm(`¿Estás seguro de que deseas hacer FORCE PUSH en la rama "${repoInfo.current_branch}"?\n\nEsta acción sobrescribirá la rama remota y puede borrar commits de otros colaboradores.`)) {
      return;
    }
    setSyncing(true);
    try {
      const result = await invoke<string>('push_branch', {
        repoPath: activeRepoPath,
        branchName: repoInfo.current_branch,
        force
      });
      alert(result);
      onBranchSwitch();
    } catch (e) {
      alert(`❌ Error al hacer push:\n${e}`);
    } finally {
      setSyncing(false);
    }
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
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', padding: '5px 10px', borderRadius: '5px', fontSize: '13px', fontWeight: 700, lineHeight: 1 }}
          >+</button>
          <button
            onClick={onCloneRepo}
            title="Clonar repositorio"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px 8px', borderRadius: '5px', fontSize: '12px', lineHeight: 1 }}
          >📥</button>
        </div>

        {/* BranchSelector y botones de sincronización integrados aquí */}
        {repoInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <BranchSelector
              repoPath={activeRepoPath}
              currentBranch={repoInfo.current_branch}
              hasUncommittedChanges={hasUncommittedChanges}
              onBranchSwitch={onBranchSwitch}
              onConflictOperation={onConflictOperation}
            />

            <button
              onClick={handlePull}
              disabled={syncing}
              title="Traer (Pull) cambios del servidor remoto"
              style={{
                background: 'var(--bg-secondary, #1e1e1e)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                cursor: syncing ? 'not-allowed' : 'pointer',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
                opacity: syncing ? 0.6 : 1
              }}
            >
              ⬇️ Pull
            </button>

            <button
              onClick={() => handlePush(false)}
              disabled={syncing}
              title="Enviar (Push) cambios al servidor remoto"
              style={{
                background: 'var(--accent, #4f46e5)',
                border: '1px solid var(--accent)',
                color: 'white',
                cursor: syncing ? 'not-allowed' : 'pointer',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
                opacity: syncing ? 0.6 : 1
              }}
            >
              ⬆️ Push
            </button>

            <button
              onClick={() => handlePush(true)}
              disabled={syncing}
              title="Forzar envío (Force Push)"
              style={{
                background: 'transparent',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: 'var(--red, #ef4444)',
                cursor: syncing ? 'not-allowed' : 'pointer',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                opacity: syncing ? 0.6 : 1
              }}
            >
              💥 Force
            </button>
            {syncing && <span className="spinner-sm" style={{ marginLeft: '4px' }} />}
          </div>
        )}
      </div>

    </div>
  );
}