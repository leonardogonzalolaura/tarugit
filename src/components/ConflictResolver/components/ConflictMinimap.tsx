import { useState } from 'react';
import { ConflictFileBlock } from '../ConflictResolver.types';

interface ConflictMinimapProps {
  blocks: ConflictFileBlock[];
  totalHeight: number;
  scrollTop: number;
  containerHeight: number;
  onJump: (blockId: string) => void;
}

const SvgChevronUp = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M3.22 10.53a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8 6.56l-3.72 3.72a.75.75 0 0 1-1.06 0Z"/></svg>;
const SvgChevronDown = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M12.78 5.47a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06L8 9.44l3.72-3.72a.75.75 0 0 1 1.06 0Z"/></svg>;

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

  const markerColor = (block: ConflictFileBlock) => {
    if (!block.resolution || block.resolution === 'pending') return '#f87171';
    switch (block.resolution) {
      case 'ours': return '#3dd68c';
      case 'theirs': return '#f97316';
      case 'both': return '#a78bfa';
      default: return '#6b7280';
    }
  };

  return (
    <>
      <button className="cr-mm-nav-btn" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0} title="Conflicto anterior">
        <SvgChevronUp />
      </button>

      <div
        className="cr-mm-bar"
        style={{ height: mapHeight }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / mapHeight;
          const idx = Math.min(Math.floor(ratio * conflictBlocks.length), conflictBlocks.length - 1);
          goTo(idx);
        }}
      >
        <div className="cr-mm-thumb" style={{ top: thumbTop, height: thumbHeight }} />

        {conflictBlocks.map((block, idx) => {
          const pos = conflictBlocks.length === 1 ? 0.5 : idx / (conflictBlocks.length - 1);
          const markerTop = pos * (mapHeight - 6);
          const isPending = !block.resolution || block.resolution === 'pending';
          const isActive = idx === currentIdx;
          const color = markerColor(block);

          return (
            <div
              key={block.id}
              className={`cr-mm-marker${isActive ? ' active' : ''}${isPending ? ' pending' : ' resolved'}`}
              title={`Conflicto ${idx + 1}: ${isPending ? 'Pendiente' : 'Resuelto'}`}
              onClick={(e) => { e.stopPropagation(); goTo(idx); }}
              style={{ top: markerTop, background: color, boxShadow: `0 0 ${isActive ? 8 : 4}px ${color}` }}
            />
          );
        })}
      </div>

      <div className="cr-mm-count">{currentIdx + 1}/{conflictBlocks.length}</div>

      <button className="cr-mm-nav-btn" onClick={() => goTo(currentIdx + 1)} disabled={currentIdx === conflictBlocks.length - 1} title="Siguiente conflicto">
        <SvgChevronDown />
      </button>
    </>
  );
}
