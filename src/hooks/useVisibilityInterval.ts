import { useEffect, useRef } from 'react';

/**
 * Shared visibility-gated interval hook.
 * - Skips periodic polling execution while the tab is in background (document.hidden === true).
 * - Immediately resumes and triggers the callback as soon as the tab becomes visible (visibilitychange).
 * - Avoids background battery & network bandwidth drain and eliminates polling storms.
 */
export function useVisibilityInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let isMounted = true;
    let lastRunTime = Date.now();

    const runCallback = () => {
      if (!isMounted) return;
      lastRunTime = Date.now();
      try {
        savedCallback.current();
      } catch (err) {
        console.error("Visibility interval error:", err);
      }
    };

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      runCallback();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && isMounted) {
        // If tab just became visible and at least 2.5s passed since last run, fetch immediately
        if (Date.now() - lastRunTime >= 2500) {
          runCallback();
        }
      }
    };

    const intervalId = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
