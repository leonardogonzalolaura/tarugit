import { useState } from 'react';
import { ConflictFileBlock } from '../ConflictResolver.types';

interface ConflictMinimapProps {
  blocks: ConflictFileBlock[];
  totalHeight: number;
  scrollTop: number;
  containerHeight: number;
  onJump: (blockId: string) => void;
}

export function ConflictMinimap({ blocks, totalHeight, scrollTop, containerHeight, onJump }: ConflictMinimapProps) {
  const [currentIdx, setCurrentIdx] = useState(0);

  const conflictBlocks = blocks.filter(b => b.type === 'conflict');
  if (conflictBlocks.length === 0) return null;

  const mapHeight = Math.min(Math.max(containerHeight * 0.6, 80), 180);
  const thumbHeight = totalHeight > containerHeight
    ? Math.max((containerHeight / totalHeight) * mapHeight, 20)
    : mapHeight;
  const thumbTop = totalHeight > containerHeight
    ? (scrollTop / (totalHeight - containerHeight)) * (mapHeight - thumbHeight)
    : 0;

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(conflictBlocks.length - 1, idx));
    setCurrentIdx(clamped);
    onJump(conflictBlocks[clamped].id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      {/* Botón prev */}
      <button
        onClick={() => goTo(currentIdx - 1)}
        disabled={currentIdx === 0}
        title="Conflicto anterior"
        style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer', opacity: currentIdx === 0 ? 0.3 : 1, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >▲</button>

      {/* Minimap barra */}
      <div
        style={{ width: '28px', height: `${mapHeight}px`, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / mapHeight;
          const idx = Math.min(Math.floor(ratio * conflictBlocks.length), conflictBlocks.length - 1);
          goTo(idx);
        }}
      >
        {/* Thumb de scroll */}
        <div style={{ position: 'absolute', left: '2px', right: '2px', top: `${thumbTop}px`, height: `${thumbHeight}px`, background: 'var(--accent)', borderRadius: '12px', opacity: 0.35, pointerEvents: 'none' }} />

        {/* Marcadores */}
        {conflictBlocks.map((block, idx) => {
          const pos = conflictBlocks.length === 1 ? 0.5 : idx / (conflictBlocks.length - 1);
          const markerTop = pos * (mapHeight - 6);
          const isPending = !block.resolution || block.resolution === 'pending';
          const isActive = idx === currentIdx;
          const color = isPending ? '#f87171'
            : block.resolution === 'ours' ? '#3dd68c'
              : block.resolution === 'theirs' ? '#f97316'
                : block.resolution === 'both' ? '#a78bfa'
                  : '#6b7280';

          return (
            <div
              key={block.id}
              title={`Conflicto ${idx + 1}: ${isPending ? '⚠️ Pendiente' : '✅ Resuelto'}`}
              onClick={(e) => { e.stopPropagation(); goTo(idx); }}
              style={{ position: 'absolute', left: '3px', right: '3px', top: `${markerTop}px`, height: isActive ? '6px' : '4px', background: color, borderRadius: '3px', boxShadow: `0 0 ${isActive ? 8 : 4}px ${color}`, opacity: isPending ? 1 : 0.75, cursor: 'pointer', transition: 'all 0.15s' }}
            />
          );
        })}
      </div>

      {/* Contador */}
      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.2 }}>
        {currentIdx + 1}/{conflictBlocks.length}
      </div>

      {/* Botón next */}
      <button
        onClick={() => goTo(currentIdx + 1)}
        disabled={currentIdx === conflictBlocks.length - 1}
        title="Siguiente conflicto"
        style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: currentIdx === conflictBlocks.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIdx === conflictBlocks.length - 1 ? 0.3 : 1, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >▼</button>
    </div>
  );
}
