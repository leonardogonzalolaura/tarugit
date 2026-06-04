import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface OperationStatusBarProps {
  repoPath: string;
  onOperationAborted: () => void;
  onOperationContinued: () => void;
}

interface RepoState {
  is_rebasing: boolean;
  is_merging: boolean;
  is_cherry_picking: boolean;
  current_operation: string | null;
}

export function OperationStatusBar({ repoPath, onOperationAborted, onOperationContinued }: OperationStatusBarProps) {
  const [state, setState] = useState<RepoState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!repoPath) return;
    checkState();
    // Verificar cada 3 segundos
    const interval = setInterval(checkState, 3000);
    return () => clearInterval(interval);
  }, [repoPath]);

  const checkState = async () => {
    try {
      const result = await invoke<RepoState>('get_repo_state', { repoPath });
      setState(result);
    } catch (e) {
      console.error('Error checking repo state:', e);
    }
  };

  const handleAbort = async () => {
    if (!state?.current_operation) return;
    
    setLoading(true);
    try {
      let cmd = '';
      if (state.is_rebasing) cmd = 'rebase_abort';
      else if (state.is_merging) cmd = 'merge_abort';
      else if (state.is_cherry_picking) cmd = 'cherry_pick_abort';
      
      if (cmd) {
        await invoke(cmd, { repoPath });
        alert(`✅ ${state.current_operation} cancelado exitosamente`);
        onOperationAborted();
        await checkState();
      }
    } catch (e) {
      alert(`Error al cancelar ${state.current_operation}: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!state?.current_operation) return;
    
    setLoading(true);
    try {
      let cmd = '';
      if (state.is_rebasing) cmd = 'rebase_continue';
      else if (state.is_cherry_picking) cmd = 'cherry_pick_continue';
      
      if (cmd) {
        await invoke(cmd, { repoPath });
        alert(`✅ ${state.current_operation} continuado exitosamente`);
        onOperationContinued();
        await checkState();
      } else if (state.is_merging) {
        alert('Para continuar un merge, primero resuelve los conflictos y luego haz commit');
      }
    } catch (e) {
      const errStr = String(e);
      if (errStr.toLowerCase().includes('conflict')) {
        alert('⚠️ Aún hay conflictos por resolver. Resuelve todos los conflictos antes de continuar.');
      } else {
        alert(`Error al continuar ${state.current_operation}: ${e}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!state || (!state.is_rebasing && !state.is_merging && !state.is_cherry_picking)) {
    return null;
  }

  const operationNames = {
    rebase: 'Rebase',
    merge: 'Merge',
    'cherry-pick': 'Cherry-Pick'
  };
  
  const operationName = state.current_operation 
    ? operationNames[state.current_operation as keyof typeof operationNames] 
    : 'Operación';
  
  const canContinue = state.is_rebasing || state.is_cherry_picking;
  const canAbort = true;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(248,113,113,0.1))',
      borderBottom: '1px solid var(--border)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <div>
          <strong style={{ color: 'var(--yellow)' }}>
            {operationName} en curso con conflictos
          </strong>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            Resuelve los conflictos en los archivos marcados
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        {canContinue && (
          <button
            onClick={handleContinue}
            disabled={loading}
            className="btn-primary"
            style={{
              background: 'var(--green-bg)',
              color: 'var(--green)',
              border: '1px solid var(--green-border)',
              padding: '6px 14px',
              fontSize: '12px'
            }}
          >
            {loading ? <span className="spinner-sm" /> : '✅'} Continuar
          </button>
        )}
        
        {canAbort && (
          <button
            onClick={handleAbort}
            disabled={loading}
            className="btn-secondary"
            style={{
              borderColor: 'var(--red-border)',
              color: 'var(--red)',
              padding: '6px 14px',
              fontSize: '12px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(248,113,113,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {loading ? <span className="spinner-sm" /> : '🚫'} Cancelar {operationName}
          </button>
        )}
      </div>
    </div>
  );
}