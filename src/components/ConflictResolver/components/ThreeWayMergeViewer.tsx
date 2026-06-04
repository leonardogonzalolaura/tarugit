// components/ThreeWayMergeViewer.tsx
import React, { useCallback } from 'react';
import { ConflictFileBlock, ScrollInfo } from '../ConflictResolver.types';
import { ConflictBlockRow } from './ConflictBlockRow';
import { ConflictMinimap } from './ConflictMinimap';

interface ThreeWayMergeViewerProps {
  blocks: ConflictFileBlock[];
  scrollRefs: {
    oursRef: React.RefObject<HTMLDivElement | null>;
    resultRef: React.RefObject<HTMLDivElement | null>;
    theirsRef: React.RefObject<HTMLDivElement | null>;
  };
  scrollInfo: ScrollInfo;
  syncScroll: (ref: React.RefObject<HTMLDivElement | null>) => () => void;
  jumpToBlock: (blockId: string) => void;
  hoveredBlockId: string | null;
  onHoverChange: (id: string | null) => void;
  onAcceptOurs: (blockId: string) => void;
  onAcceptTheirs: (blockId: string) => void;
  onAcceptBoth: (blockId: string) => void;
  onIgnore: (blockId: string) => void;
  onUpdateContent: (blockId: string, value: string) => void;
  operationContext?: { type: 'merge' | 'rebase' | 'cherry-pick' }; // ← AÑADIR ESTA LÍNEA
}

export function ThreeWayMergeViewer({
  blocks,
  scrollRefs,
  scrollInfo,
  syncScroll,
  jumpToBlock,
  hoveredBlockId,
  onHoverChange,
  onAcceptOurs,
  onAcceptTheirs,
  onAcceptBoth,
  onIgnore,
  onUpdateContent,
  operationContext // ← AÑADIR ESTA LÍNEA
}: ThreeWayMergeViewerProps) {
  const { oursRef, resultRef, theirsRef } = scrollRefs;
  const totalConflicts = blocks.filter(b => b.type === 'conflict').length;
  const isRebase = operationContext?.type === 'rebase';

  // Handlers de scroll
  const onScrollOurs = useCallback(() => syncScroll(oursRef)(), [syncScroll]);
  const onScrollResult = useCallback(() => syncScroll(resultRef)(), [syncScroll]);
  const onScrollTheirs = useCallback(() => syncScroll(theirsRef)(), [syncScroll]);

  const renderBlocks = (paneType: 'ours' | 'result' | 'theirs') => {
    let conflictCounter = 0;
    return blocks.map((block) => {
      const isHovered = hoveredBlockId === block.id;
      if (block.type === 'conflict') conflictCounter++;

      if (block.type === 'clean') {
        return (
          <div
            key={block.id}
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              padding: '2px 4px',
              marginBottom: '8px',
              opacity: isHovered ? 0.4 : 1,
              transition: 'opacity 0.15s'
            }}
          >
            {block.content}
          </div>
        );
      }

      return (
        <ConflictBlockRow
          key={block.id}
          block={block}
          conflictNumber={conflictCounter}
          totalConflicts={totalConflicts}
          isHovered={isHovered}
          onHoverEnter={() => onHoverChange(block.id)}
          onHoverLeave={() => onHoverChange(null)}
          onAcceptOurs={() => onAcceptOurs(block.id)}
          onAcceptTheirs={() => onAcceptTheirs(block.id)}
          onAcceptBoth={() => onAcceptBoth(block.id)}
          onIgnore={() => onIgnore(block.id)}
          onUpdateContent={(val) => onUpdateContent(block.id, val)}
          pane={paneType}
        />
      );
    });
  };

  // Si es rebase, intercambiamos visualmente los paneles izquierdo y derecho
  const leftPaneContent = isRebase ? renderBlocks('theirs') : renderBlocks('ours');
  const rightPaneContent = isRebase ? renderBlocks('ours') : renderBlocks('theirs');
  
  // Los refs también se intercambian durante rebase
  const leftRef = isRebase ? theirsRef : oursRef;
  const rightRef = isRebase ? oursRef : theirsRef;
  const onScrollLeft = isRebase ? onScrollTheirs : onScrollOurs;
  const onScrollRight = isRebase ? onScrollOurs : onScrollTheirs;

  return (
    <>
      {/* Títulos de los paneles - Siempre igual para el usuario */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        gap: '2px',
        background: 'var(--border)',
        flexShrink: 0
      }}>
        <div style={{ padding: '7px 12px', background: '#0f1e16', fontSize: '11px', fontWeight: 700, color: 'var(--green)' }}>
          ⬅️ Tus Cambios Locales
        </div>
        <div style={{ padding: '7px 12px', background: '#111128', fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>
          📝 Resultado Fusionado <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>editable</span>
        </div>
        <div style={{ padding: '7px 12px', background: '#1e0f0f', fontSize: '11px', fontWeight: 700, color: 'var(--red)' }}>
          Cambios Entrantes ➡️
        </div>
      </div>

      {/* Grid de 3 paneles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        flex: 1,
        overflow: 'hidden',
        gap: '2px',
        background: 'var(--border)',
        position: 'relative'
      }}>
        {/* Panel izquierdo - Siempre muestra TUS cambios locales */}
        <div style={{ background: '#0b150f', overflow: 'hidden' }}>
          <div 
            ref={leftRef} 
            onScroll={onScrollLeft} 
            style={{ height: '100%', overflowY: 'auto', padding: '12px' }}
          >
            {leftPaneContent}
          </div>
        </div>

        {/* Panel central - Resultado */}
        <div style={{ background: '#0d0d18', overflow: 'hidden' }}>
          <div ref={resultRef} onScroll={onScrollResult} style={{ height: '100%', overflowY: 'auto', padding: '12px', paddingRight: '44px' }}>
            {renderBlocks('result')}
          </div>
        </div>

        {/* Panel derecho - Siempre muestra cambios entrantes */}
        <div style={{ background: '#150b0b', overflow: 'hidden' }}>
          <div 
            ref={rightRef} 
            onScroll={onScrollRight} 
            style={{ height: '100%', overflowY: 'auto', padding: '12px' }}
          >
            {rightPaneContent}
          </div>
        </div>

        {/* Minimap */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 'calc(33.33% - 10px)', display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 20 }}>
          <div style={{ pointerEvents: 'all' }}>
            <ConflictMinimap
              blocks={blocks}
              totalHeight={scrollInfo.totalHeight}
              scrollTop={scrollInfo.scrollTop}
              containerHeight={scrollInfo.containerHeight}
              onJump={jumpToBlock}
            />
          </div>
        </div>
      </div>
    </>
  );
}