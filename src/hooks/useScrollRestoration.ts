import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  saveScrollPosition, 
  getSavedScrollPosition, 
  restoreScrollPosition, 
  scrollToElementWithOffset,
  STICKY_HEADER_OFFSET 
} from '../utils/scrollState';

export interface UseScrollRestorationOptions {
  activeKey: string;
  enabled?: boolean;
  headerOffset?: number;
}

export function useScrollRestoration({
  activeKey,
  enabled = true,
  headerOffset = STICKY_HEADER_OFFSET
}: UseScrollRestorationOptions) {
  const prevKeyRef = useRef<string>(activeKey);
  const scrollTickingRef = useRef<boolean>(false);
  const [restoredInfo, setRestoredInfo] = useState<{ key: string; y: number } | null>(null);

  // Continuously record scroll position for current activeKey
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleScroll = () => {
      if (!scrollTickingRef.current) {
        scrollTickingRef.current = true;
        requestAnimationFrame(() => {
          const currentY = window.scrollY || document.documentElement.scrollTop || 0;
          if (activeKey) {
            saveScrollPosition(activeKey, currentY);
          }
          scrollTickingRef.current = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeKey, enabled]);

  // Handle Key / Tab / Route Transitions
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const prevKey = prevKeyRef.current;
    if (prevKey && prevKey !== activeKey) {
      // 1. Save scroll position of the page we are LEAVING
      const leavingY = window.scrollY || document.documentElement.scrollTop || 0;
      saveScrollPosition(prevKey, leavingY);

      // 2. Rehydrate scroll position of the page we are ENTERING
      const savedTargetY = getSavedScrollPosition(activeKey);
      if (savedTargetY !== null && savedTargetY > 0) {
        restoreScrollPosition(activeKey, {
          behavior: 'instant',
          fallbackToTop: false
        });

        // Flash subtle confirmation state
        setRestoredInfo({ key: activeKey, y: savedTargetY });
        const timer = setTimeout(() => {
          setRestoredInfo(null);
        }, 2200);

        prevKeyRef.current = activeKey;
        return () => clearTimeout(timer);
      } else {
        // Brand new route/tab - Start clean at top
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
        setRestoredInfo(null);
      }
    }

    prevKeyRef.current = activeKey;
  }, [activeKey, enabled]);

  // Handle Browser Back / Forward (popstate)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handlePopState = () => {
      requestAnimationFrame(() => {
        const savedY = getSavedScrollPosition(activeKey);
        if (savedY !== null && savedY > 0) {
          restoreScrollPosition(activeKey, { behavior: 'instant' });
        }
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeKey, enabled]);

  const scrollToId = useCallback((id: string, customOffset = headerOffset) => {
    scrollToElementWithOffset(id, customOffset);
  }, [headerOffset]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activeKey) {
      saveScrollPosition(activeKey, 0);
    }
  }, [activeKey]);

  return {
    restoredInfo,
    scrollToId,
    scrollToTop,
    saveCurrentScroll: () => saveScrollPosition(activeKey),
    restoreCurrentScroll: () => restoreScrollPosition(activeKey)
  };
}
