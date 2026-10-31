import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { RepoInfo, StartupArgs } from '../types';
import { toast } from '../components/Toast';

export type ConflictOperation = {
  type: 'merge' | 'rebase' | 'cherry-pick';
  originalBranch?: string;
};

export function useRepository(addRepo: (path: string) => void) {
  const [repoPath, setRepoPath] = useState('');
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [temporaryRepo, setTemporaryRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setRefreshTrigger] = useState(0);
  const [conflictOperation, setConflictOperation] = useState<ConflictOperation | null>(null);
  const refreshingRef = useRef(false);
  const bootstrappedRef = useRef(false);

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

  const openRepo = useCallback(async (
    path?: string,
    options?: { temporary?: boolean },
  ) => {
    const targetPath = path ?? repoPath;
    if (!targetPath) return;
    setLoading(true);
    try {
      const result = await invoke<RepoInfo>('open_repository', { path: targetPath });
      setRepoPath(targetPath);
      setRepoInfo(result);
      setConflictOperation(null);
      // Un worktree abierto manualmente también es temporal: no se guarda en
      // `tarugit_repos` a menos que el usuario pulse "Guardar".
      setTemporaryRepo(options?.temporary ?? result.is_worktree);
      return result;
    } catch (e) {
      toast.error(`Error al abrir: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const bootstrap = async () => {
      // Si FlowManager abrió TaruGit con `--open`, esa ruta tiene prioridad
      // sobre el último repositorio guardado.
      let startup: StartupArgs | null = null;
      try {
        startup = await invoke<StartupArgs>('get_startup_args');
      } catch {
        // La app puede estar corriendo en navegador (sin Tauri).
      }

      if (startup?.open) {
        const opened = await openRepo(startup.open, { temporary: true });
        if (opened) return;
        // Si el worktree temporal ya no existe, seguimos con el último repo
        // guardado en lugar de dejar la app vacía.
      }

      const saved = localStorage.getItem('tarugit_repos');
      if (!saved) return;

      try {
        const repos = JSON.parse(saved);
        if (Array.isArray(repos) && repos.length > 0) {
          const sorted = [...repos].sort((a: any, b: any) => b.lastOpenedAt - a.lastOpenedAt);
          const last = sorted[0];
          if (last?.path) await openRepo(last.path, { temporary: false });
        }
      } catch (e) {
        console.error('Error al abrir repo inicial:', e);
      }
    };

    void bootstrap();
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
    temporaryRepo, setTemporaryRepo,
    loading, setLoading,
    conflictOperation, setConflictOperation,
    refreshStatus, openRepo, cloneRepo,
    handleBranchSwitch, handleConflictDetected, handleOperationAborted,
  };
}
