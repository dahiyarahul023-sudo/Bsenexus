import { useRef, useCallback, type TouchEvent } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxVerticalRatio?: number;
  disabled?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 48,
  maxVerticalRatio = 0.8,
  disabled = false
}: SwipeGestureOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = false;
  }, [disabled]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || startX.current === null || startY.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Check if movement is primarily horizontal
    if (Math.abs(diffX) > Math.abs(diffY) * (1 / maxVerticalRatio) && Math.abs(diffX) > 10) {
      isHorizontalSwipe.current = true;
    }
  }, [disabled, maxVerticalRatio]);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (disabled || startX.current === null || startY.current === null) {
      startX.current = null;
      startY.current = null;
      isHorizontalSwipe.current = false;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - startX.current;
    const diffY = endY - startY.current;

    if (isHorizontalSwipe.current && Math.abs(diffX) >= threshold && Math.abs(diffY) <= Math.abs(diffX) * maxVerticalRatio) {
      if (diffX < 0) {
        // Swiped Left -> Move to Next
        onSwipeLeft?.();
      } else {
        // Swiped Right -> Move to Prev
        onSwipeRight?.();
      }
    }

    startX.current = null;
    startY.current = null;
    isHorizontalSwipe.current = false;
  }, [disabled, onSwipeLeft, onSwipeRight, threshold, maxVerticalRatio]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
}
