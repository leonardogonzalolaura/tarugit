import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { RepoInfo } from '../types';
import { toast } from '../components/Toast';

export type ConflictOperation = {
  type: 'merge' | 'rebase' | 'cherry-pick';
  originalBranch?: string;
};

export function useRepository(addRepo: (path: string) => void) {
  const [repoPath, setRepoPath] = useState('');
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setRefreshTrigger] = useState(0);
  const [conflictOperation, setConflictOperation] = useState<ConflictOperation | null>(null);
  const refreshingRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (!repoPath || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const [result, stashList] = await Promise.all([
        invoke<RepoInfo>('get_repo_status', { repoPath }),
        invoke<any[]>('get_stash_list', { repoPath }),
      ]);
      setRepoInfo(result);
      return { repoInfo: result, stashes: stashList };
    } catch { return undefined; }
    finally {
      refreshingRef.current = false;
    }
  }, [repoPath]);

  useEffect(() => {
    if (!repoPath) return;
    let unlisten: UnlistenFn | null = null;

    invoke('start_repo_watcher', { repoPath }).catch((e) =>
      console.warn('[watcher] No se pudo iniciar:', e)
    );

    listen<void>('repo-changed', () => {
      refreshStatus();
    }).then((fn) => { unlisten = fn; });

    return () => {
      unlisten?.();
      invoke('stop_repo_watcher').catch(() => {});
    };
  }, [repoPath, refreshStatus]);

  const openRepo = useCallback(async (path?: string) => {
    const targetPath = path ?? repoPath;
    if (!targetPath) return;
    setLoading(true);
    try {
      const result = await invoke<RepoInfo>('open_repository', { path: targetPath });
      setRepoPath(targetPath);
      setRepoInfo(result);
      setConflictOperation(null);
      return result;
    } catch (e) {
      toast.error(`Error al abrir: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    const saved = localStorage.getItem('tarugit_repos');
    if (saved) {
      try {
        const repos = JSON.parse(saved);
        if (Array.isArray(repos) && repos.length > 0) {
          const sorted = [...repos].sort((a: any, b: any) => b.lastOpenedAt - a.lastOpenedAt);
          const last = sorted[0];
          if (last?.path) openRepo(last.path);
        }
      } catch (e) {
        console.error('Error al abrir repo inicial:', e);
      }
    }
  }, []);

  const cloneRepo = useCallback(async (url: string, targetPath: string) => {
    setLoading(true);
    try {
      const result = await invoke<RepoInfo>('clone_repository', { url, path: targetPath });
      setRepoPath(targetPath);
      setRepoInfo(result);
      addRepo(targetPath);
      toast.success('Repositorio clonado exitosamente');
      return result;
    } catch (e) {
      toast.error(`Error al clonar: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [addRepo]);

  const handleBranchSwitch = useCallback(async () => {
    await refreshStatus();
    setConflictOperation(null);
  }, [refreshStatus]);

  const handleConflictDetected = useCallback((op: ConflictOperation) => {
    setConflictOperation(op);
    toast.warning(`Se detectaron conflictos durante el ${op.type}. Selecciona los archivos en conflicto para resolverlos.`);
  }, []);

  const handleOperationAborted = useCallback(async () => {
    await refreshStatus();
    setConflictOperation(null);
    setRefreshTrigger(prev => prev + 1);
  }, [refreshStatus]);

  return {
    repoPath, setRepoPath,
    repoInfo, setRepoInfo,
    loading, setLoading,
    conflictOperation, setConflictOperation,
    refreshStatus, openRepo, cloneRepo,
    handleBranchSwitch, handleConflictDetected, handleOperationAborted,
  };
}
