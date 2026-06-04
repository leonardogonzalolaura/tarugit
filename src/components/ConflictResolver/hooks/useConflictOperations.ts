import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { OperationContext, ConflictFileBlock } from '../ConflictResolver.types';
import { mergeBlocks } from '../utils/conflictParser';

export function useConflictOperations(repoPath: string, filePath: string) {
  const [loading, setLoading] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveResolution = async (blocks: ConflictFileBlock[]) => {
    setLoading(true);
    try {
      const mergedText = mergeBlocks(blocks);
      await invoke('resolve_conflict', { repoPath, filePath, mergedText });
      
      // Verificar si hay más conflictos
      const repoInfo = await invoke<any>('get_repo_status', { repoPath });
      const stillConflicted = repoInfo.files.filter((f: any) => f.status === 'conflicted').length;
      
      if (stillConflicted > 0) {
        return { success: true, stillConflicted, message: `Aún quedan ${stillConflicted} archivo(s) con conflictos` };
      } else {
        setShowPostModal(true);
        return { success: true, stillConflicted: 0, message: 'Todos los conflictos resueltos' };
      }
    } catch (e) {
      throw new Error(`Error al resolver conflicto: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const postAction = async (action: 'continue' | 'abort' | 'done', context?: OperationContext) => {
    setBusy(true);
    try {
      if (!context || action === 'done') return { success: true };
      
      if (action === 'continue') {
        if (context.type === 'rebase') await invoke('rebase_continue', { repoPath });
        else if (context.type === 'cherry-pick') await invoke('cherry_pick_continue', { repoPath });
      } else if (action === 'abort') {
        if (context.type === 'merge') await invoke('merge_abort', { repoPath });
        else if (context.type === 'rebase') await invoke('rebase_abort', { repoPath });
        else if (context.type === 'cherry-pick') await invoke('cherry_pick_abort', { repoPath });
      }
      return { success: true };
    } catch (e) {
      const errStr = String(e);
      if (errStr.toLowerCase().includes('conflict')) {
        return { success: false, hasNextConflict: true, message: 'El siguiente commit también tiene conflictos' };
      }
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return { saveResolution, postAction, loading, showPostModal, setShowPostModal, busy };
}