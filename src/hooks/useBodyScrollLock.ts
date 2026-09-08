import { useEffect, useRef } from 'react';

// Set of active lock keys to ensure clean cleanup without count drift
const activeLocks = new Set<string>();
let originalBodyOverflow = '';
let originalPaddingRight = '';

function applyLock(id: string) {
  if (typeof document === 'undefined') return;

  if (activeLocks.size === 0) {
    originalBodyOverflow = document.body.style.overflow || '';
    originalPaddingRight = document.body.style.paddingRight || '';

    // Measure scrollbar width to prevent layout shift on desktop
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = 'hidden';
  }
  activeLocks.add(id);
}

function releaseLock(id: string) {
  if (typeof document === 'undefined') return;

  activeLocks.delete(id);

  if (activeLocks.size === 0) {
    document.body.style.overflow = originalBodyOverflow;
    document.body.style.paddingRight = originalPaddingRight;
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.documentElement.style.overflow = '';
  }
}

/**
 * Hook to lock background body scroll while a modal, drawer, or overlay is open.
 * Automatically and safely restores page scrolling when `isOpen` is false or component unmounts.
 */
export function useBodyScrollLock(isOpen: boolean = false) {
  const lockIdRef = useRef<string>('');

  if (!lockIdRef.current) {
    lockIdRef.current = 'lock_' + Math.random().toString(36).substring(2, 9);
  }

  useEffect(() => {
    const id = lockIdRef.current;
    if (!isOpen) {
      releaseLock(id);
      return;
    }

    applyLock(id);

    return () => {
      releaseLock(id);
    };
  }, [isOpen]);
}

