import React, { useCallback } from 'react';
import { ConflictFileBlock, LayoutMode, ScrollInfo } from '../ConflictResolver.types';
import { ConflictBlockRow } from './ConflictBlockRow';
import { ConflictMinimap } from './ConflictMinimap';

interface ThreeWayMergeViewerProps {
  layout: LayoutMode;
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

function renderBlocks(
  blocks: ConflictFileBlock[],
  paneType: 'ours' | 'result' | 'theirs',
  hoveredBlockId: string | null,
  onHoverChange: (id: string | null) => void,
  onAcceptOurs: (blockId: string) => void,
  onAcceptTheirs: (blockId: string) => void,
  onAcceptBoth: (blockId: string) => void,
  onIgnore: (blockId: string) => void,
  onUpdateContent: (blockId: string, value: string) => void
) {
  let conflictCounter = 0;
  return blocks.map((block) => {
    const isHovered = hoveredBlockId === block.id;
    if (block.type === 'conflict') conflictCounter++;

    if (block.type === 'clean') {
      return (
        <div key={block.id} className="cr-block clean" style={{ opacity: isHovered ? .4 : 1 }}>
          <div className="cr-block-text">{block.content}</div>
        </div>
      );
    }

    return (
      <ConflictBlockRow
        key={block.id}
        block={block}
        conflictNumber={conflictCounter}
        totalConflicts={blocks.filter(b => b.type === 'conflict').length}
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
}

export function ThreeWayMergeViewer({
  layout,
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
  const isRebase = operationContext?.type === 'rebase';

  const onScrollOurs = useCallback(() => {
    if (layout === 'vertical') return;
    syncScroll(oursRef)();
  }, [syncScroll, layout]);
  const onScrollResult = useCallback(() => {
    if (layout !== 'side') return;
    syncScroll(resultRef)();
  }, [syncScroll, layout]);
  const onScrollTheirs = useCallback(() => {
    if (layout === 'vertical') return;
    syncScroll(theirsRef)();
  }, [syncScroll, layout]);

  const renderPane = (paneType: 'ours' | 'result' | 'theirs', ref: React.RefObject<HTMLDivElement | null>, onScroll: () => void) => (
    <div ref={ref} onScroll={onScroll} className={`cr-pane-body ${paneType}`}>
      {renderBlocks(blocks, paneType, hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent)}
    </div>
  );

  if (layout === 'diff-result') {
    return (
      <div className="cr-layout-stacked">
        <div className="cr-diff-row-headers" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px',
          background: 'var(--border)', flexShrink: 0
        }}>
          <div className="cr-pane-header ours"><SvgArrowLeft /> Tus Cambios Locales</div>
          <div className="cr-pane-header theirs">Cambios Entrantes <SvgArrowRight /></div>
        </div>

        <div className="cr-diff-row" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px',
          background: 'var(--border)', overflow: 'hidden'
        }}>
          {renderPane(isRebase ? 'theirs' : 'ours', isRebase ? theirsRef : oursRef, isRebase ? onScrollTheirs : onScrollOurs)}
          {renderPane(isRebase ? 'ours' : 'theirs', isRebase ? oursRef : theirsRef, isRebase ? onScrollOurs : onScrollTheirs)}
        </div>

        <div className="cr-pane-header result" style={{ flexShrink: 0 }}>
          <SvgPencil /> Resultado Fusionado
          <span className="editable-hint">editable</span>
        </div>

        <div className="cr-result-row" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div ref={resultRef} onScroll={onScrollResult} className="cr-pane-body result" style={{ paddingRight: 36, height: '100%', boxSizing: 'border-box' }}>
            {renderBlocks(blocks, 'result', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent)}
          </div>
          <div className="cr-minimap right">
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
      </div>
    );
  }

  if (layout === 'vertical') {
    const topContent = isRebase ? 'theirs' : 'ours';
    const bottomContent = isRebase ? 'ours' : 'theirs';
    const topLabel = isRebase ? 'Cambios Entrantes' : 'Tus Cambios Locales';
    const bottomLabel = isRebase ? 'Tus Cambios Locales' : 'Cambios Entrantes';
    const topRef = isRebase ? theirsRef : oursRef;
    const bottomRef = isRebase ? oursRef : theirsRef;
    const topScroll = isRebase ? onScrollTheirs : onScrollOurs;
    const bottomScroll = isRebase ? onScrollOurs : onScrollTheirs;

    return (
      <div className="cr-layout-vertical">
        <div className="cr-pane-header ours" style={{ flexShrink: 0 }}>
          <SvgArrowLeft /> {topLabel}
        </div>
        <div className="cr-vert-section">{renderPane(topContent as 'ours' | 'theirs', topRef, topScroll)}</div>

        <div className="cr-pane-header theirs" style={{ flexShrink: 0 }}>
          {bottomLabel} <SvgArrowRight />
        </div>
        <div className="cr-vert-section">{renderPane(bottomContent as 'ours' | 'theirs', bottomRef, bottomScroll)}</div>

        <div className="cr-pane-header result" style={{ flexShrink: 0 }}>
          <SvgPencil /> Resultado Fusionado
          <span className="editable-hint">editable</span>
        </div>
        <div className="cr-vert-section" style={{ position: 'relative' }}>
          <div ref={resultRef} onScroll={onScrollResult} className="cr-pane-body result" style={{ paddingRight: 36, height: '100%', boxSizing: 'border-box' }}>
            {renderBlocks(blocks, 'result', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent)}
          </div>
          <div className="cr-minimap right">
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
      </div>
    );
  }

  // layout === 'side' (default)
  const leftPaneContent = isRebase ? renderBlocks(blocks, 'theirs', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent)
    : renderBlocks(blocks, 'ours', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent);
  const rightPaneContent = isRebase ? renderBlocks(blocks, 'ours', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent)
    : renderBlocks(blocks, 'theirs', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent);

  const leftRef = isRebase ? theirsRef : oursRef;
  const rightRef = isRebase ? oursRef : theirsRef;
  const onScrollLeft = isRebase ? onScrollTheirs : onScrollOurs;
  const onScrollRight = isRebase ? onScrollOurs : onScrollTheirs;

  return (
    <>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '1px',
        background: 'var(--border)', flexShrink: 0
      }}>
        <div className="cr-pane-header ours"><SvgArrowLeft /> Tus Cambios Locales</div>
        <div className="cr-pane-header result">
          <SvgPencil /> Resultado Fusionado
          <span className="editable-hint">editable</span>
        </div>
        <div className="cr-pane-header theirs">Cambios Entrantes <SvgArrowRight /></div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', flex: 1,
        overflow: 'hidden', gap: '1px', background: 'var(--border)', position: 'relative'
      }}>
        <div ref={leftRef} onScroll={onScrollLeft} className="cr-pane-body ours">{leftPaneContent}</div>
        <div ref={resultRef} onScroll={onScrollResult} className="cr-pane-body result" style={{ paddingRight: 38 }}>
          {renderBlocks(blocks, 'result', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent)}
        </div>
        <div ref={rightRef} onScroll={onScrollRight} className="cr-pane-body theirs">{rightPaneContent}</div>

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
