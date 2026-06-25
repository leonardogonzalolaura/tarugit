import { useRef, useCallback, useState, RefObject } from 'react';
import { ScrollInfo } from '../ConflictResolver.types';

export function useSyncScroll() {
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
      if (isSyncing.current) return;
      const src = sourceRef.current;
      if (!src) return;
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
  }, []);

  const jumpToBlock = useCallback((blockId: string) => {
    for (const ref of [oursRef, resultRef, theirsRef]) {
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
    }

    if (resultRef.current) {
      setScrollInfo(prev => ({ ...prev, scrollTop: resultRef.current!.scrollTop }));
    }
  }, []);

  return { oursRef, resultRef, theirsRef, scrollInfo, syncScroll, jumpToBlock };
}
