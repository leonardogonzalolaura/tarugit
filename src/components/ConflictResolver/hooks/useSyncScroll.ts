import { useRef, useCallback, useState, RefObject } from 'react';
import { ScrollInfo, LayoutMode } from '../ConflictResolver.types';

export function useSyncScroll(layout: LayoutMode = 'side') {
  const oursRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const theirsRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const [scrollInfo, setScrollInfo] = useState<ScrollInfo>({
    scrollTop: 0,
    totalHeight: 0,
    containerHeight: 0
  });

  const syncScroll = useCallback((sourceRef: RefObject<HTMLDivElement | null>) => {
    return () => {
      // No sincronizar mientras el usuario edita el Resultado: evita re-renders que roban foco
      const ae = document.activeElement as HTMLElement | null;
      if (ae?.tagName === 'TEXTAREA' && (ae.classList.contains('cr-block-textarea') || ae.classList.contains('cr-focus-textarea'))) {
        return;
      }
      if (isSyncing.current) return;
      const src = sourceRef.current;
      if (!src) return;

      if (layout === 'side') {
        setScrollInfo({
          scrollTop: src.scrollTop,
          totalHeight: src.scrollHeight,
          containerHeight: src.clientHeight
        });
        return;
      }

      isSyncing.current = true;
      const scrollTop = src.scrollTop;
      for (const ref of [oursRef, resultRef, theirsRef]) {
        if (ref === sourceRef || !ref.current) continue;
        ref.current.scrollTop = scrollTop;
      }
      setScrollInfo({
        scrollTop,
        totalHeight: src.scrollHeight,
        containerHeight: src.clientHeight
      });
      isSyncing.current = false;
    };
  }, [layout]);

  const jumpToBlock = useCallback((blockId: string) => {
    const refsToSearch = layout === 'side'
      ? [oursRef]
      : layout === 'diff-result'
        ? [oursRef, resultRef]
        : [oursRef, resultRef, theirsRef];

    for (const ref of refsToSearch) {
      const container = ref.current;
      if (!container) continue;

      const target = container.querySelector(`[data-conflict-block="${blockId}"]`) as HTMLElement;
      if (!target) continue;

      let offsetTop = 0;
      let el: HTMLElement | null = target;
      while (el && el !== container) {
        offsetTop += el.offsetTop;
        el = el.offsetParent as HTMLElement;
      }

      container.scrollTop = Math.max(0, offsetTop - 16);
      break;
    }

    if (oursRef.current) {
      setScrollInfo(prev => ({ ...prev, scrollTop: oursRef.current!.scrollTop }));
    }
  }, [layout]);

  return { oursRef, resultRef, theirsRef, scrollInfo, syncScroll, jumpToBlock };
}
