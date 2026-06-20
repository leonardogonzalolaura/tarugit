import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '../components/Toast';

export function useStash() {
  const [stashes, setStashes] = useState<{ index: number; id: string; name: string; message: string }[]>([]);
  const [showStashModal, setShowStashModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSaveStash = async (repoPath: string, message: string, includeUntracked: boolean, filesToStash: string[] | null, onSuccess?: () => void) => {
    setLoading(true);
    try {
      const msg = await invoke<string>('save_stash', {
        repoPath,
        message: message || null,
        includeUntracked,
        files: filesToStash
      });
      toast.success(msg);
      setShowStashModal(false);
      onSuccess?.();
    } catch (e) {
      toast.error(`Error al guardar stash: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    stashes, setStashes,
    showStashModal, setShowStashModal,
    loading,
    handleSaveStash,
  };
}
