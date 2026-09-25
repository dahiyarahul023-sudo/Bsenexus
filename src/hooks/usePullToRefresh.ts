import { useState, useEffect, useRef, useCallback } from 'react';
import { triggerThresholdTick, triggerSuccessHaptic } from '../utils/haptics';

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  pullThreshold?: number;
  restingHeight?: number;
  disabled?: boolean;
}

/**
 * Apple-grade Rubber-band elasticity formula
 * From WWDC "Designing Fluid Interfaces"
 */
function rubberband(overshoot: number, dimension = 280, constant = 0.55): number {
  if (overshoot <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function usePullToRefresh<T extends HTMLElement = HTMLDivElement>({
  onRefresh,
  pullThreshold = 68,
  restingHeight = 48,
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
  const hasTickedRef = useRef(false);

  pullDistanceRef.current = pullDistance;
  isRefreshingRef.current = isRefreshing;
  isPullingRef.current = isPulling;

  // --- Touch Event Handlers ---
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshingRef.current || !containerRef.current) return;

    // 1. Check if page is at top
    const isPageAtTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    // 2. Check if container itself is scrolled to top
    const isContainerAtTop = containerRef.current.scrollTop <= 0;

    if (isPageAtTop && isContainerAtTop) {
      startYRef.current = e.touches[0]?.clientY || 0;
      startXRef.current = e.touches[0]?.clientX || 0;
      isDraggingRef.current = true;
      isHorizontalScrollRef.current = false;
      hasTickedRef.current = false;
    } else {
      isDraggingRef.current = false;
    }
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || disabled || isRefreshingRef.current || !containerRef.current) return;

    const isPageScrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 0;
    const isContainerScrolled = containerRef.current.scrollTop > 0;

    // If page or container scrolled down, cancel pull gesture
    if (isPageScrolled || isContainerScrolled) {
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      hasTickedRef.current = false;
      return;
    }

    const currentY = e.touches[0]?.clientY || 0;
    const currentX = e.touches[0]?.clientX || 0;
    const rawDiffY = currentY - startYRef.current;
    const rawDiffX = currentX - startXRef.current;

    // Horizontal dominant cancels pull
    if (!isHorizontalScrollRef.current && Math.abs(rawDiffX) > Math.abs(rawDiffY) && Math.abs(rawDiffX) > 8) {
      isHorizontalScrollRef.current = true;
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      hasTickedRef.current = false;
      return;
    }

    if (isHorizontalScrollRef.current) return;

    if (rawDiffY > 6) {
      if (e.cancelable) {
        e.preventDefault();
      }

      // Non-linear physical rubber-band resistance
      const resistedDistance = rubberband(rawDiffY, 280, 0.55);
      pullDistanceRef.current = resistedDistance;
      setPullDistance(resistedDistance);
      setIsPulling(true);

      // Haptic tick: Arms the thumb the instant the threshold line is crossed
      if (resistedDistance >= pullThreshold && !hasTickedRef.current) {
        hasTickedRef.current = true;
        triggerThresholdTick();
      } else if (resistedDistance < pullThreshold && hasTickedRef.current) {
        // User reversed motion above threshold - re-arm for next potential cross
        hasTickedRef.current = false;
      }
    } else if (rawDiffY <= 0) {
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      hasTickedRef.current = false;
    }
  }, [disabled, pullThreshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current && !isPullingRef.current) return;

    isDraggingRef.current = false;
    setIsPulling(false);
    hasTickedRef.current = false;

    const currentDist = pullDistanceRef.current;

    // THRESHOLD PROMISE: Fires past the line, never before
    if (currentDist >= pullThreshold && !isRefreshingRef.current) {
      setIsRefreshing(true);
      isRefreshingRef.current = true;
      // Settle at resting spinner height
      setPullDistance(restingHeight);
      pullDistanceRef.current = restingHeight;

      try {
        await Promise.resolve(onRefresh());
        triggerSuccessHaptic();
      } catch (err) {
        console.error('Pull to refresh failed:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          isRefreshingRef.current = false;
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }, 320);
      }
    } else {
      // Release below threshold -> snap back immediately, no reload
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }
  }, [pullThreshold, restingHeight, onRefresh]);

  const handleTouchCancel = useCallback(() => {
    isDraggingRef.current = false;
    isPullingRef.current = false;
    hasTickedRef.current = false;
    pullDistanceRef.current = 0;
    setPullDistance(0);
    setIsPulling(false);
  }, []);

  // --- Mouse / Pointer Dragging Support (Desktop Simulation & Touchpad) ---
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (disabled || isRefreshingRef.current || !containerRef.current) return;
    if (e.pointerType === 'touch') return; // Handled by TouchEvents
    if (e.button !== 0) return; // Only left-click

    const isPageAtTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    const isContainerAtTop = containerRef.current.scrollTop <= 0;

    if (isPageAtTop && isContainerAtTop) {
      startYRef.current = e.clientY;
      startXRef.current = e.clientX;
      isDraggingRef.current = true;
      isHorizontalScrollRef.current = false;
      hasTickedRef.current = false;
    }
  }, [disabled]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || disabled || isRefreshingRef.current || !containerRef.current) return;
    if (e.pointerType === 'touch') return;

    const rawDiffY = e.clientY - startYRef.current;
    const rawDiffX = e.clientX - startXRef.current;

    if (Math.abs(rawDiffX) > Math.abs(rawDiffY) && Math.abs(rawDiffX) > 10) {
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    if (rawDiffY > 8) {
      const resistedDistance = rubberband(rawDiffY, 280, 0.55);
      pullDistanceRef.current = resistedDistance;
      setPullDistance(resistedDistance);
      setIsPulling(true);

      if (resistedDistance >= pullThreshold && !hasTickedRef.current) {
        hasTickedRef.current = true;
        triggerThresholdTick();
      } else if (resistedDistance < pullThreshold && hasTickedRef.current) {
        hasTickedRef.current = false;
      }
    } else if (rawDiffY <= 0) {
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [disabled, pullThreshold]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      handleTouchEnd();
    }
  }, [handleTouchEnd]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    
    // Pointer Events for Desktop browser preview
    el.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handleTouchCancel, { passive: true });
    window.addEventListener('blur', handleTouchCancel);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
      el.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handleTouchCancel);
      window.removeEventListener('blur', handleTouchCancel);
    };
  }, [
    handleTouchStart, 
    handleTouchMove, 
    handleTouchEnd, 
    handleTouchCancel, 
    handlePointerDown, 
    handlePointerMove, 
    handlePointerUp
  ]);

  const progress = Math.min(1, pullDistance / pullThreshold);
  const isThresholdReached = pullDistance >= pullThreshold;

  return {
    containerRef,
    pullDistance,
    isPulling,
    isRefreshing,
    progress,
    isThresholdReached,
    threshold: pullThreshold
  };
}

