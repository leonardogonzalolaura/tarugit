import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface StashInfo {
  index: number;
  id: string;
  name: string;
  message: string;
}

interface StashPanelProps {
  repoPath: string;
  stashes: StashInfo[];
  loading: boolean;
  onRefresh: () => void;
}

export function StashPanel({ repoPath, stashes, loading, onRefresh }: StashPanelProps) {
  const [localLoading, setLocalLoading] = useState<string | null>(null);

  const handleApply = async (stashId: string) => {
    setLocalLoading(stashId);
    try {
      const msg = await invoke<string>('apply_stash', { repoPath, stashId });
      alert(`✅ ${msg}`);
      onRefresh();
    } catch (e) {
      alert(`⚠️ Error al aplicar stash: ${e}`);
    } finally {
      setLocalLoading(null);
    }
  };

  const handlePop = async (stashId: string) => {
    setLocalLoading(stashId);
    try {
      const msg = await invoke<string>('pop_stash', { repoPath, stashId });
      alert(`✅ ${msg}`);
      onRefresh();
    } catch (e) {
      alert(`⚠️ Error al hacer pop de stash: ${e}`);
    } finally {
      setLocalLoading(null);
    }
  };

  const handleDrop = async (stashId: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el stash "${stashId}"?`)) {
      return;
    }
    setLocalLoading(stashId);
    try {
      const msg = await invoke<string>('drop_stash', { repoPath, stashId });
      alert(`✅ ${msg}`);
      onRefresh();
    } catch (e) {
      alert(`⚠️ Error al eliminar stash: ${e}`);
    } finally {
      setLocalLoading(null);
    }
  };

  if (stashes.length === 0) {
    return (
      <div className="file-list-empty" style={{ padding: '24px', textAlign: 'center' }}>
        <span style={{ fontSize: 32 }}>📦</span>
        <p style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600 }}>Sin stashes guardados</p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '200px', margin: '6px auto 0' }}>
          Usa stash para guardar temporalmente tus cambios y mantener limpio tu espacio de trabajo.
        </p>
      </div>
    );
  }

  return (
    <div className="stash-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-light)',
        fontSize: '11px',
        fontWeight: 'bold',
        color: 'var(--text-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>📦 STASHES GUARDADOS ({stashes.length})</span>
        <button 
          onClick={onRefresh} 
          disabled={loading || !!localLoading}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: '10px',
            padding: 0
          }}
        >
          🔄 Actualizar
        </button>
      </div>

      <div className="stash-list" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {stashes.map((stash) => {
          const isStashLoading = localLoading === stash.id;
          
          return (
            <div 
              key={stash.id} 
              className="stash-item"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: 'var(--accent)',
                  background: 'rgba(79, 70, 229, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {stash.name}
                </span>
              </div>
              
              <div style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                wordBreak: 'break-all',
                lineHeight: '1.4'
              }}>
                {stash.message}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => handlePop(stash.id)}
                  disabled={loading || !!localLoading}
                  className="btn-secondary"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  title="Aplica los cambios y elimina este stash de la lista"
                >
                  {isStashLoading ? '...' : '📥 Pop'}
                </button>
                <button
                  onClick={() => handleApply(stash.id)}
                  disabled={loading || !!localLoading}
                  className="btn-secondary"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  title="Aplica los cambios manteniendo este stash guardado"
                >
                  {isStashLoading ? '...' : '✨ Aplicar'}
                </button>
                <button
                  onClick={() => handleDrop(stash.id)}
                  disabled={loading || !!localLoading}
                  className="btn-secondary"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: 'var(--red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Eliminar este stash permanentemente"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
