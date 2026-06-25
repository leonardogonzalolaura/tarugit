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
  operationContext?: { type: 'merge' | 'rebase' | 'cherry-pick' };
}

const SvgArrowLeft = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.22 8.03a.75.75 0 0 1 0-1.06l4.5-4.5a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L5.06 7h8.19a.75.75 0 0 1 0 1.5H5.06l2.72 2.72a.75.75 0 0 1 0 1.06Z"/></svg>;
const SvgArrowRight = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L10.94 9.5H2.75a.75.75 0 0 1 0-1.5h8.19L8.22 4.03a.75.75 0 0 1 0-1.06Z"/></svg>;
const SvgPencil = () => <svg width="10" height="10" viewBox="0 0 16 16" fill="currentcolor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L4.513 10.08a.25.25 0 0 0-.064.108l-.562 1.967 1.967-.562a.25.25 0 0 0 .108-.064l7.147-7.147a.25.25 0 0 0 0-.354l-1.086-1.086Z"/></svg>;

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
  operationContext
}: ThreeWayMergeViewerProps) {
  const { oursRef, resultRef, theirsRef } = scrollRefs;
  const totalConflicts = blocks.filter(b => b.type === 'conflict').length;
  const isRebase = operationContext?.type === 'rebase';

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
            className="cr-block clean"
            style={{ opacity: isHovered ? .4 : 1 }}
          >
            <div className="cr-block-text">{block.content}</div>
          </div>
        );
      }

      return (
        <ConflictBlockRow
          key={block.id}
          block={block}
          conflictNumber={conflictCounter}
          totalConflicts={totalConflicts}
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

  const leftPaneContent = isRebase ? renderBlocks('theirs') : renderBlocks('ours');
  const rightPaneContent = isRebase ? renderBlocks('ours') : renderBlocks('theirs');

  const leftRef = isRebase ? theirsRef : oursRef;
  const rightRef = isRebase ? oursRef : theirsRef;
  const onScrollLeft = isRebase ? onScrollTheirs : onScrollOurs;
  const onScrollRight = isRebase ? onScrollOurs : onScrollTheirs;

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        gap: '1px',
        background: 'var(--border)',
        flexShrink: 0
      }}>
        <div className="cr-pane-header ours">
          <SvgArrowLeft /> Tus Cambios Locales
        </div>
        <div className="cr-pane-header result">
          <SvgPencil /> Resultado Fusionado
          <span className="editable-hint">editable</span>
        </div>
        <div className="cr-pane-header theirs">
          Cambios Entrantes <SvgArrowRight />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        flex: 1,
        overflow: 'hidden',
        gap: '1px',
        background: 'var(--border)',
        position: 'relative'
      }}>
        <div ref={leftRef} onScroll={onScrollLeft} className="cr-pane-body ours">
          {leftPaneContent}
        </div>
        <div ref={resultRef} onScroll={onScrollResult} className="cr-pane-body result" style={{ paddingRight: 38 }}>
          {renderBlocks('result')}
        </div>
        <div ref={rightRef} onScroll={onScrollRight} className="cr-pane-body theirs">
          {rightPaneContent}
        </div>

        <div className="cr-minimap">
          <div className="cr-minimap-inner">
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
