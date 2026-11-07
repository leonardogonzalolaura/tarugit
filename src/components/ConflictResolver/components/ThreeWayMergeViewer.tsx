import React, { useCallback, useMemo, useRef } from 'react';
import { ConflictFileBlock, LayoutMode } from '../ConflictResolver.types';
import { ConflictBlockRow } from './ConflictBlockRow';
import { useResizer } from '../hooks/useResizer';

interface ThreeWayMergeViewerProps {
  layout: LayoutMode;
  blocks: ConflictFileBlock[];
  scrollRefs: {
    oursRef: React.RefObject<HTMLDivElement | null>;
    resultRef: React.RefObject<HTMLDivElement | null>;
    theirsRef: React.RefObject<HTMLDivElement | null>;
  };
  syncScroll: (ref: React.RefObject<HTMLDivElement | null>) => () => void;
  hoveredBlockId: string | null;
  onHoverChange: (id: string | null) => void;
  onAcceptOurs: (blockId: string) => void;
  onAcceptTheirs: (blockId: string) => void;
  onAcceptBoth: (blockId: string) => void;
  onIgnore: (blockId: string) => void;
  onUpdateContent: (blockId: string, value: string) => void;
  operationContext?: { type: 'merge' | 'rebase' | 'cherry-pick' };
  filePath: string;
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
  onUpdateContent: (blockId: string, value: string) => void,
  filePath: string
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
        filePath={filePath}
      />
    );
  });
}

function renderBlockCell(
  block: ConflictFileBlock,
  paneType: 'ours' | 'result' | 'theirs',
  conflictNum: number,
  totalConflicts: number,
  hoveredBlockId: string | null,
  onHoverChange: (id: string | null) => void,
  onAcceptOurs: (blockId: string) => void,
  onAcceptTheirs: (blockId: string) => void,
  onAcceptBoth: (blockId: string) => void,
  onIgnore: (blockId: string) => void,
  onUpdateContent: (blockId: string, value: string) => void,
  filePath: string
) {
  const isHovered = hoveredBlockId === block.id;

  if (block.type === 'clean') {
    return (
      <div className="cr-block clean" style={{ opacity: isHovered ? .4 : 1 }}>
        <div className="cr-block-text">{block.content}</div>
      </div>
    );
  }

  return (
    <ConflictBlockRow
      block={block}
      conflictNumber={conflictNum}
      totalConflicts={totalConflicts}
      onHoverEnter={() => onHoverChange(block.id)}
      onHoverLeave={() => onHoverChange(null)}
      onAcceptOurs={() => onAcceptOurs(block.id)}
      onAcceptTheirs={() => onAcceptTheirs(block.id)}
      onAcceptBoth={() => onAcceptBoth(block.id)}
      onIgnore={() => onIgnore(block.id)}
      onUpdateContent={(val) => onUpdateContent(block.id, val)}
      pane={paneType}
      filePath={filePath}
    />
  );
}

export function ThreeWayMergeViewer({
  layout,
  blocks,
  scrollRefs,
  syncScroll,
  hoveredBlockId,
  onHoverChange,
  onAcceptOurs,
  onAcceptTheirs,
  onAcceptBoth,
  onIgnore,
  onUpdateContent,
  operationContext,
  filePath
}: ThreeWayMergeViewerProps) {
  const { oursRef, resultRef, theirsRef } = scrollRefs;
  const isRebase = operationContext?.type === 'rebase';

  // Resizers para cada layout
  const sideResizer = useResizer(3, [30, 40, 30]);
  const stackedResizer = useResizer(2, [45, 55]);
  const verticalResizer = useResizer(3, [33.33, 33.34, 33.33]);

  // Ref al contenedor del layout side para cálculo correcto de containerSize
  const sideContainerRef = useRef<HTMLDivElement>(null);

  const onScrollOurs = useCallback(() => {
    if (layout === 'vertical') return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae?.tagName === 'TEXTAREA' || ae?.closest('.cm-editor')) return;
    syncScroll(oursRef)();
  }, [syncScroll, layout]);
  const onScrollResult = useCallback(() => {
    if (layout !== 'side') return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae?.tagName === 'TEXTAREA' || ae?.closest('.cm-editor')) return;
    syncScroll(resultRef)();
  }, [syncScroll, layout]);
  const onScrollTheirs = useCallback(() => {
    if (layout === 'vertical') return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae?.tagName === 'TEXTAREA' || ae?.closest('.cm-editor')) return;
    syncScroll(theirsRef)();
  }, [syncScroll, layout]);

  const { conflictNumberMap, totalConflicts } = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    for (const block of blocks) {
      if (block.type === 'conflict') count++;
      map.set(block.id, count);
    }
    return { conflictNumberMap: map, totalConflicts: count };
  }, [blocks]);

  // ─── Layout: diff-result ──────────────────────────────────────────────────
  if (layout === 'diff-result') {
    const localType = isRebase ? 'theirs' : 'ours';
    const remoteType = isRebase ? 'ours' : 'theirs';
    const localRef = isRebase ? theirsRef : oursRef;
    const localScroll = isRebase ? onScrollTheirs : onScrollOurs;
    const [topPct, bottomPct] = stackedResizer.sizes;

    return (
      <div className="cr-layout-stacked">
        {/* ── Sección superior: diff local/remoto ── */}
        <div style={{ flex: `0 0 ${topPct}%`, minHeight: 80, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px',
            background: 'var(--border)', flexShrink: 0
          }}>
            <div className="cr-pane-header ours"><SvgArrowLeft /> {isRebase ? 'Cambios Entrantes' : 'Tus Cambios Locales'}</div>
            <div className="cr-pane-header theirs">{isRebase ? 'Tus Cambios Locales' : 'Cambios Entrantes'} <SvgArrowRight /></div>
          </div>
          <div ref={localRef} onScroll={localScroll} className="cr-diff-scroll" style={{ flex: 1 }}>
            <div className="cr-diff-grid">
              {blocks.flatMap((block) => {
                const cn = conflictNumberMap.get(block.id) || 0;
                return [
                  <div key={`${block.id}-local`} className="cr-cell local">
                    {renderBlockCell(block, localType, cn, totalConflicts, hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
                  </div>,
                  <div key={`${block.id}-remote`} className="cr-cell remote">
                    {renderBlockCell(block, remoteType, cn, totalConflicts, hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
                  </div>
                ];
              })}
            </div>
          </div>
        </div>

        {/* ── Divisor horizontal ── */}
        <div
          className="cr-resizer cr-resizer-h"
          onMouseDown={(e) => stackedResizer.startDrag(0, 'vertical', e)}
          title="Arrastrar para redimensionar"
        />

        {/* ── Sección inferior: resultado ── */}
        <div style={{ flex: `0 0 ${bottomPct}%`, minHeight: 80, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="cr-pane-header result" style={{ flexShrink: 0 }}>
            <SvgPencil /> Resultado Fusionado
            <span className="editable-hint">editable</span>
          </div>
          <div ref={resultRef} onScroll={onScrollResult} className="cr-pane-body result" style={{ height: '100%', boxSizing: 'border-box' }}>
            {renderBlocks(blocks, 'result', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Layout: vertical ─────────────────────────────────────────────────────
  if (layout === 'vertical') {
    const topContent = isRebase ? 'theirs' : 'ours';
    const bottomContent = isRebase ? 'ours' : 'theirs';
    const topLabel = isRebase ? 'Cambios Entrantes' : 'Tus Cambios Locales';
    const bottomLabel = isRebase ? 'Tus Cambios Locales' : 'Cambios Entrantes';
    const topRef = isRebase ? theirsRef : oursRef;
    const bottomRef = isRebase ? oursRef : theirsRef;
    const topScroll = isRebase ? onScrollTheirs : onScrollOurs;
    const bottomScroll = isRebase ? onScrollOurs : onScrollTheirs;
    const [s0, s1, s2] = verticalResizer.sizes;

    return (
      <div className="cr-layout-vertical">
        {/* ── Panel 1 ── */}
        <div style={{ flex: `0 0 ${s0}%`, minHeight: 60, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="cr-pane-header ours" style={{ flexShrink: 0 }}>
            <SvgArrowLeft /> {topLabel}
          </div>
          <div ref={topRef} onScroll={topScroll} className={`cr-pane-body ${topContent}`} style={{ flex: 1 }}>
            {renderBlocks(blocks, topContent as 'ours' | 'theirs', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
          </div>
        </div>

        {/* ── Divisor 1 ── */}
        <div
          className="cr-resizer cr-resizer-h"
          onMouseDown={(e) => verticalResizer.startDrag(0, 'vertical', e)}
          title="Arrastrar para redimensionar"
        />

        {/* ── Panel 2 ── */}
        <div style={{ flex: `0 0 ${s1}%`, minHeight: 60, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="cr-pane-header theirs" style={{ flexShrink: 0 }}>
            {bottomLabel} <SvgArrowRight />
          </div>
          <div ref={bottomRef} onScroll={bottomScroll} className={`cr-pane-body ${bottomContent}`} style={{ flex: 1 }}>
            {renderBlocks(blocks, bottomContent as 'ours' | 'theirs', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
          </div>
        </div>

        {/* ── Divisor 2 ── */}
        <div
          className="cr-resizer cr-resizer-h"
          onMouseDown={(e) => verticalResizer.startDrag(1, 'vertical', e)}
          title="Arrastrar para redimensionar"
        />

        {/* ── Panel 3: Resultado ── */}
        <div style={{ flex: `0 0 ${s2}%`, minHeight: 60, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="cr-pane-header result" style={{ flexShrink: 0 }}>
            <SvgPencil /> Resultado Fusionado
            <span className="editable-hint">editable</span>
          </div>
          <div ref={resultRef} onScroll={onScrollResult} className="cr-pane-body result" style={{ height: '100%', boxSizing: 'border-box' }}>
            {renderBlocks(blocks, 'result', hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Layout: side (default) — row-based aligned rendering ─────────────────
  // El grid unificado preserva la alineación de filas entre paneles.
  // Los resizers son overlays absolutamente posicionados que modifican gridTemplateColumns.
  const leftPaneType = isRebase ? 'theirs' : 'ours';
  const rightPaneType = isRebase ? 'ours' : 'theirs';
  const leftRef = isRebase ? theirsRef : oursRef;
  const onScrollLeft = isRebase ? onScrollTheirs : onScrollOurs;
  const [s0, s1, s2] = sideResizer.sizes;
  // gridTemplateColumns con los resizers embebidos como columnas de 5px
  const gridColsWithResizers = `${s0}fr 5px ${s1}fr 5px ${s2}fr`;
  // Posición visual de los resizers: cada fr-value es s0/(s0+s1+s2)*100% del espacio total de fr
  // Los separadores de 5px se distribuyen entre los 100% restantes.
  // Para la posición visual simplificamos usando los fr como si fueran % directos
  // (el error máximo en 1200px es <1px por separador, totalmente inapreciable).
  const resizerPos1 = s0;           // posición del primer resizer (% del total)
  const resizerPos2 = s0 + s1;      // posición del segundo resizer (% del total)

  return (
    <>
      {/* Cabeceras sincronizadas con el mismo grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridColsWithResizers,
        gap: 0,
        background: 'var(--border)',
        flexShrink: 0
      }}>
        <div className="cr-pane-header ours"><SvgArrowLeft /> {isRebase ? 'Cambios Entrantes' : 'Tus Cambios Locales'}</div>
        <div style={{ background: 'var(--border)' }} />
        <div className="cr-pane-header result">
          <SvgPencil /> Resultado Fusionado
          <span className="editable-hint">editable</span>
        </div>
        <div style={{ background: 'var(--border)' }} />
        <div className="cr-pane-header theirs">{isRebase ? 'Tus Cambios Locales' : 'Cambios Entrantes'} <SvgArrowRight /></div>
      </div>

      {/* Contenedor de scroll + grid de contenido */}
      <div ref={sideContainerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div ref={leftRef} onScroll={onScrollLeft} className="cr-merge-scroll">
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridColsWithResizers,
            gap: 0,
            background: 'var(--border)',
          }}>
            {blocks.flatMap((block) => {
              const cn = conflictNumberMap.get(block.id) || 0;
              return [
                <div key={`${block.id}-left`} className="cr-cell ours">
                  {renderBlockCell(block, leftPaneType, cn, totalConflicts, hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
                </div>,
                // Columna del resizer 1 — solo primera fila visible como handle, resto relleno
                <div key={`${block.id}-sep1`} style={{ background: 'var(--border)' }} />,
                <div key={`${block.id}-result`} className="cr-cell result">
                  {renderBlockCell(block, 'result', cn, totalConflicts, hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
                </div>,
                // Columna del resizer 2
                <div key={`${block.id}-sep2`} style={{ background: 'var(--border)' }} />,
                <div key={`${block.id}-right`} className="cr-cell theirs">
                  {renderBlockCell(block, rightPaneType, cn, totalConflicts, hoveredBlockId, onHoverChange, onAcceptOurs, onAcceptTheirs, onAcceptBoth, onIgnore, onUpdateContent, filePath)}
                </div>,
              ];
            })}
          </div>
        </div>

        {/* Resizers superpuestos — posición calculada sobre el contenedor */}
        <SideResizer
          pct={resizerPos1}
          index={0}
          onMouseDown={(e) => sideResizer.startDrag(0, 'horizontal', e, sideContainerRef)}
        />
        <SideResizer
          pct={resizerPos2}
          index={1}
          onMouseDown={(e) => sideResizer.startDrag(1, 'horizontal', e, sideContainerRef)}
        />
      </div>
    </>
  );
}

/** Resizer vertical superpuesto sobre el layout side.
 *  Se posiciona en el porcentaje acumulado del contenedor. */
function SideResizer({
  pct,
  index,
  onMouseDown,
}: {
  pct: number;
  index: number;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `calc(${pct}% - 3px)`,
        width: 6,
        cursor: 'col-resize',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={onMouseDown}
      title="Arrastrar para redimensionar"
      data-resizer={index}
    >
      <div className="cr-resizer-v-handle" />
    </div>
  );
}
