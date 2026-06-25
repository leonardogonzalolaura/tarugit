import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StashInfo } from '../types';

interface StashPanelProps {
  repoPath: string;
  stashes: StashInfo[];
  loading: boolean;
  onRefresh: () => void;
  onSelectStash?: (stash: StashInfo) => void;
  selectedStashId?: string | null;
}

const SvgArchive = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="currentcolor"><path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v1.5A1.75 1.75 0 0 1 14.25 6H1.75A1.75 1.75 0 0 1 0 4.25v-1.5C0 1.784.784 1 1.75 1ZM1.75 7h1.5v2.25c0 .414.336.75.75.75h6a.75.75 0 0 0 .75-.75V7h1.5v2.25A2.25 2.25 0 0 1 10 11.5H6a2.25 2.25 0 0 1-2.25-2.25Zm10.5-2.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>;
const SvgClear = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M4.22 2.22A.75.75 0 0 1 4.75 2h8.5a.75.75 0 0 1 .53 1.28L10.56 6.5l3.22 3.22a.75.75 0 0 1-.53 1.28H4.75a.75.75 0 0 1-.75-.75V3a.75.75 0 0 1 .22-.78Z"/><path d="M1 12.5a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9A.75.75 0 0 1 1 12.5Z"/></svg>;
const SvgRefresh = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M1.705 8.005a6.295 6.295 0 0 1 10.64-4.383l.833.834v-1.8a.75.75 0 0 1 1.5 0v3.716a.75.75 0 0 1-.75.75H10.21a.75.75 0 0 1 0-1.5h1.405l-.77-.77a4.795 4.795 0 0 0-8.115 3.303.75.75 0 0 1-1.025.15.75.75 0 0 1-.15-1.05v-.05c0-.033.074.07 0-.09Zm8.82 4.157a4.795 4.795 0 0 0 3.25-4.537.75.75 0 0 1 1.5 0 6.296 6.296 0 0 1-10.64 4.383l-.833-.834v1.8a.75.75 0 0 1-1.5 0V10.16a.75.75 0 0 1 .75-.75h3.716a.75.75 0 0 1 0 1.5H4.867l.77.77a4.795 4.795 0 0 0 4.888 1.482Z"/></svg>;
const SvgPop = () => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.22 11.78a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 1 0-1.06-1.06L8.5 9.44V1.75a.75.75 0 0 0-1.5 0v7.69L4.53 6.97a.75.75 0 0 0-1.06 1.06Z"/><path d="M2.75 13.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5Z"/></svg>;
const SvgApply = () => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentcolor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/><path d="m11.78 5.97-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06L6.78 8.91l3.94-3.94a.75.75 0 0 1 1.06 1.06Z"/></svg>;
const SvgTrash = () => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentcolor"><path d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1 0-1.5H5V1.75A1.75 1.75 0 0 1 6.75 0h2.5A1.75 1.75 0 0 1 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.75 1.75 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15Z"/></svg>;
const SvgEmpty = () => <svg width="28" height="28" viewBox="0 0 16 16" fill="currentcolor" opacity=".35"><path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v1.5A1.75 1.75 0 0 1 14.25 6H1.75A1.75 1.75 0 0 1 0 4.25v-1.5C0 1.784.784 1 1.75 1ZM1.75 7h1.5v2.25c0 .414.336.75.75.75h6a.75.75 0 0 0 .75-.75V7h1.5v2.25A2.25 2.25 0 0 1 10 11.5H6a2.25 2.25 0 0 1-2.25-2.25ZM6.5 2.5a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1Z"/></svg>;

export function StashPanel({ repoPath, stashes, loading, onRefresh, onSelectStash, selectedStashId }: StashPanelProps) {
  const [localLoading, setLocalLoading] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

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
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el stash "${stashId}"?`)) return;
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

  const handleClearAll = async () => {
    if (!confirm(`¿Estás seguro de eliminar TODOS los stashes (${stashes.length})? Esta acción no se puede deshacer.`)) return;
    setClearingAll(true);
    try {
      const msg = await invoke<string>('clear_all_stashes', { repoPath });
      alert(`✅ ${msg}`);
      onRefresh();
    } catch (e) {
      alert(`⚠️ Error al limpiar stashes: ${e}`);
    } finally {
      setClearingAll(false);
    }
  };

  if (stashes.length === 0) {
    return (
      <div className="sp-empty">
        <SvgEmpty />
        <div className="sp-empty-title">Sin stashes guardados</div>
        <div className="sp-empty-desc">
          Usa stash para guardar temporalmente tus cambios y mantener limpio tu espacio de trabajo.
        </div>
      </div>
    );
  }

  const isDisabled = loading || !!localLoading || clearingAll;

  return (
    <div className="sp">
      <div className="sp-header">
        <div className="sp-title">
          <SvgArchive />
          Stashes
          <span className="sp-count">{stashes.length}</span>
        </div>
        <div className="sp-header-actions">
          <button className="sp-btn danger" onClick={handleClearAll} disabled={isDisabled || stashes.length === 0} title="Eliminar todos los stashes">
            {clearingAll ? <span style={{fontSize:10}}>...</span> : <SvgClear />}
          </button>
          <button className="sp-btn" onClick={onRefresh} disabled={isDisabled} title="Actualizar">
            <SvgRefresh />
          </button>
        </div>
      </div>

      <div className="sp-list">
        {stashes.map((stash) => {
          const isStashLoading = localLoading === stash.id;
          const isSelected = selectedStashId === stash.id;

          return (
            <div
              key={stash.id}
              className={`sp-item${isSelected ? ' selected' : ''}`}
              onClick={() => onSelectStash?.(stash)}
            >
              <div className="sp-item-head">
                <span className="sp-item-badge">{stash.name}</span>
              </div>
              <div className="sp-item-msg">{stash.message}</div>
              <div className="sp-item-actions" onClick={e => e.stopPropagation()}>
                <button
                  className="sp-act-btn pop"
                  onClick={() => handlePop(stash.id)}
                  disabled={isDisabled}
                  title="Aplica los cambios y elimina este stash"
                >
                  {isStashLoading ? '...' : <><SvgPop /> Pop</>}
                </button>
                <button
                  className="sp-act-btn apply"
                  onClick={() => handleApply(stash.id)}
                  disabled={isDisabled}
                  title="Aplica los cambios manteniendo el stash"
                >
                  {isStashLoading ? '...' : <><SvgApply /> Aplicar</>}
                </button>
                <button
                  className="sp-act-btn drop"
                  onClick={() => handleDrop(stash.id)}
                  disabled={isDisabled}
                  title="Eliminar este stash"
                >
                  <SvgTrash />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
