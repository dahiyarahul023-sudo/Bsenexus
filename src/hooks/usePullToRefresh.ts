import { useState, useEffect, useRef, useCallback } from 'react';

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  pullThreshold?: number;
  maxPullDistance?: number;
  disabled?: boolean;
}

export function usePullToRefresh<T extends HTMLElement = HTMLDivElement>({
  onRefresh,
  pullThreshold = 60,
  maxPullDistance = 96,
  disabled = false
}: UsePullToRefreshOptions) {
  const containerRef = useRef<T | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const isPullingRef = useRef(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalScrollRef = useRef(false);

  pullDistanceRef.current = pullDistance;
  isRefreshingRef.current = isRefreshing;
  isPullingRef.current = isPulling;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshingRef.current || !containerRef.current) return;

    // 1. Check if page is scrolled to top
    const isPageAtTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    // 2. Check if container itself (if internally scrollable) is scrolled to top
    const isContainerAtTop = containerRef.current.scrollTop <= 0;

    if (isPageAtTop && isContainerAtTop) {
      startYRef.current = e.touches[0]?.clientY || 0;
      startXRef.current = e.touches[0]?.clientX || 0;
      isDraggingRef.current = true;
      isHorizontalScrollRef.current = false;
    } else {
      isDraggingRef.current = false;
    }
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || disabled || isRefreshingRef.current || !containerRef.current) return;

    const isPageScrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 0;
    const isContainerScrolled = containerRef.current.scrollTop > 0;

    // If page or container has scrolled down, cancel pull (native scroll wins)
    if (isPageScrolled || isContainerScrolled) {
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const currentY = e.touches[0]?.clientY || 0;
    const currentX = e.touches[0]?.clientX || 0;
    const diffY = currentY - startYRef.current;
    const diffX = currentX - startXRef.current;

    // Horizontal-dominant movement cancels the pull
    if (!isHorizontalScrollRef.current && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
      isHorizontalScrollRef.current = true;
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    if (isHorizontalScrollRef.current) return;

    if (diffY > 12) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const calculatedDistance = Math.min(diffY * 0.5, maxPullDistance);
      pullDistanceRef.current = calculatedDistance;
      setPullDistance(calculatedDistance);
      setIsPulling(true);
    } else if (diffY <= 0) {
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }
  }, [disabled, maxPullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current && !isPullingRef.current) return;

    isDraggingRef.current = false;
    setIsPulling(false);

    const currentDist = pullDistanceRef.current;

    if (currentDist >= pullThreshold && !isRefreshingRef.current) {
      setIsRefreshing(true);
      isRefreshingRef.current = true;
      setPullDistance(pullThreshold);
      pullDistanceRef.current = pullThreshold;

      try {
        await Promise.resolve(onRefresh());
      } catch (err) {
        console.error('Pull to refresh failed:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          isRefreshingRef.current = false;
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }, 200);
      }
    } else {
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }
  }, [pullThreshold, onRefresh]);

  const handleTouchCancel = useCallback(() => {
    isDraggingRef.current = false;
    isPullingRef.current = false;
    pullDistanceRef.current = 0;
    setPullDistance(0);
    setIsPulling(false);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    window.addEventListener('blur', handleTouchCancel);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('blur', handleTouchCancel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    containerRef,
    pullDistance,
    isPulling,
    isRefreshing,
    progress: Math.min(1, pullDistance / pullThreshold)
  };
}

