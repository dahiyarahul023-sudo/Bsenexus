/**
 * Apple-Grade Scroll State & Restoration System ("Scroll is state")
 *
 * Implements the 5 Core Principles from WWDC & Design Motion:
 * 1. Save scrollY per entry (position is state — restore it on return)
 * 2. A route is not a reset (SPA route/tab switches preserve or rehydrate position)
 * 3. Offset by the header (subtract sticky navbar/ticker height: scrollTo(y - headerOffset))
 * 4. scroll-margin-top (ensures jump links & anchors never tuck under sticky chrome)
 * 5. Mind the infinite feed (prevent buried/unreachable footer)
 */

export const STICKY_HEADER_OFFSET = 96; // 56px top bar + 32px ticker + breathing room
const STORAGE_PREFIX = 'bse_scroll_pos_';
const memoryScrollCache = new Map<string, number>();

// Enforce manual scroll restoration so the browser doesn't fight our state manager
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  try {
    window.history.scrollRestoration = 'manual';
  } catch {}
}

/**
 * Save current scroll position for a specific key (tab, route, or section)
 */
export function saveScrollPosition(key: string, y?: number): void {
  if (typeof window === 'undefined' || !key) return;
  const currentY = typeof y === 'number' ? y : (window.scrollY || document.documentElement.scrollTop || 0);
  
  memoryScrollCache.set(key, currentY);
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, currentY.toString());
  } catch {}
}

/**
 * Get the saved scroll position for a key
 */
export function getSavedScrollPosition(key: string): number | null {
  if (typeof window === 'undefined' || !key) return null;

  if (memoryScrollCache.has(key)) {
    return memoryScrollCache.get(key)!;
  }

  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw !== null) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        memoryScrollCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {}

  return null;
}

/**
 * Clear saved scroll position for a specific key
 */
export function clearScrollPosition(key: string): void {
  memoryScrollCache.delete(key);
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {}
}

export interface RestoreOptions {
  behavior?: ScrollBehavior;
  offset?: number;
  fallbackToTop?: boolean;
}

/**
 * Restore scroll position for a key with frame-synced requestAnimationFrame
 */
export function restoreScrollPosition(
  key: string, 
  options: RestoreOptions = {}
): boolean {
  if (typeof window === 'undefined' || !key) return false;

  const { behavior = 'instant', offset = 0, fallbackToTop = true } = options;
  const savedY = getSavedScrollPosition(key);

  if (savedY !== null && savedY > 0) {
    const targetY = Math.max(0, savedY - offset);
    
    // Double requestAnimationFrame ensures the DOM of the restored tab is fully painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: targetY,
          behavior
        });
      });
    });
    return true;
  }

  if (fallbackToTop) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior });
    });
  }

  return false;
}

/**
 * Smoothly scroll to an element with sticky header clearance
 */
export function scrollToElementWithOffset(
  target: HTMLElement | string,
  offset: number = STICKY_HEADER_OFFSET,
  behavior: ScrollBehavior = 'smooth'
): void {
  if (typeof window === 'undefined') return;

  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const targetY = Math.max(0, currentScrollY + rect.top - offset);

  window.scrollTo({
    top: targetY,
    behavior
  });
}
