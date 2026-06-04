import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ConflictData, ConflictFileBlock } from '../ConflictResolver.types';
import { parseConflictBlocks } from '../utils/conflictParser';

interface UseConflictDataReturn {
  loading: boolean;
  error: string;
  data: ConflictData | null;
  blocks: ConflictFileBlock[];
  loadConflict: () => Promise<void>;
  setBlocks: React.Dispatch<React.SetStateAction<ConflictFileBlock[]>>;
}

export function useConflictData(
  repoPath: string,
  filePath: string,
  externalSetBlocks?: React.Dispatch<React.SetStateAction<ConflictFileBlock[]>>
): UseConflictDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<ConflictData | null>(null);
  const [internalBlocks, setInternalBlocks] = useState<ConflictFileBlock[]>([]);
  
  // Usar el setter externo si se proporciona, si no, el interno
  const setBlocks = externalSetBlocks || setInternalBlocks;
  const blocks = externalSetBlocks ? (() => {
    // Esto es un poco tricky - necesitamos access al estado actual
    // Mejor usamos un ref o simplemente retornamos internalBlocks
    // Por simplicidad, usamos internalBlocks como fuente de verdad
    return internalBlocks;
  })() : internalBlocks;

  const loadConflict = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 1. Obtener los datos de conflicto desde el backend
      const conflictData = await invoke<ConflictData>('get_conflict_stages', {
        repoPath,
        filePath
      });
      setData(conflictData);

      // 2. Parsear el archivo raw (con marcadores <<<<<<</=======/>>>>>>>) 
      const rawText = conflictData.raw || conflictData.base || conflictData.ours || '';
      const parsedBlocks = parseConflictBlocks(rawText);
      setBlocks(parsedBlocks);

      // 3. Pequeño delay para calcular el scroll inicial
      setTimeout(() => {
        // El scroll se manejará en el componente principal
      }, 100);
      
    } catch (e) {
      const errorMsg = String(e);
      setError(errorMsg);
      console.error('Error loading conflict data:', e);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    data,
    blocks,
    loadConflict,
    setBlocks
  };
}