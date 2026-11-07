import { useCallback, useRef, useState } from 'react';

/** Divide un espacio entre dos o tres paneles de forma dinámica.
 *  Para paneles horizontales (resize en X) usa porcentajes de ancho.
 *  Para paneles verticales (resize en Y) usa porcentajes de alto.
 *
 *  `sizes` es un array de porcentajes que siempre suman 100.
 *  `count` indica cuántos paneles hay (2 o 3).
 */

const MIN_PCT = 8; // tamaño mínimo de panel en %

export type ResizerDir = 'horizontal' | 'vertical';

export function useResizer(
  count: 2 | 3,
  initialSizes?: number[]
): {
  sizes: number[];
  startDrag: (
    index: number,
    dir: ResizerDir,
    e: React.MouseEvent,
    containerRef?: React.RefObject<HTMLElement | null>
  ) => void;
  isDragging: boolean;
} {
  const defaultSizes =
    initialSizes ??
    (count === 3 ? [33.33, 33.34, 33.33] : [50, 50]);

  const [sizes, setSizes] = useState<number[]>(defaultSizes);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{
    index: number;
    dir: ResizerDir;
    startPos: number;
    startSizes: number[];
    containerSize: number;
  } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current) return;
    const { index, dir, startPos, startSizes, containerSize } = dragState.current;
    const pos = dir === 'horizontal' ? e.clientX : e.clientY;
    const delta = ((pos - startPos) / containerSize) * 100;

    const next = [...startSizes];
    const leftIdx = index;
    const rightIdx = index + 1;

    let newLeft = startSizes[leftIdx] + delta;
    let newRight = startSizes[rightIdx] - delta;

    if (newLeft < MIN_PCT) {
      newRight = newLeft + newRight - MIN_PCT;
      newLeft = MIN_PCT;
    }
    if (newRight < MIN_PCT) {
      newLeft = newLeft + newRight - MIN_PCT;
      newRight = MIN_PCT;
    }

    next[leftIdx] = newLeft;
    next[rightIdx] = newRight;
    setSizes(next);
  }, []);

  const onMouseUp = useCallback(() => {
    dragState.current = null;
    setIsDragging(false);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onMouseMove]);

  const startDrag = useCallback(
    (
      index: number,
      dir: ResizerDir,
      e: React.MouseEvent,
      containerRef?: React.RefObject<HTMLElement | null>
    ) => {
      e.preventDefault();
      e.stopPropagation();

      // Preferir el ref explícito; si no, subir al parentElement del target
      const container = containerRef?.current
        ?? (e.currentTarget as HTMLElement).parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const containerSize = dir === 'horizontal' ? rect.width : rect.height;

      dragState.current = {
        index,
        dir,
        startPos: dir === 'horizontal' ? e.clientX : e.clientY,
        startSizes: [...sizes],
        containerSize,
      };
      setIsDragging(true);
      document.body.style.cursor = dir === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [sizes, onMouseMove, onMouseUp]
  );

  return { sizes, startDrag, isDragging };
}
