import { useCallback, useEffect, useState } from 'react';

/**
 * Shared feed display-density preference (Comfortable | Compact | Dense).
 *
 * Single source of truth for the density setting. The Settings screen's
 * segmented control and every card surface (filings, watchlist, results
 * calendar, news, home) read and write the SAME localStorage key
 * (`bse_feed_density`), so changing it in Settings updates all feeds
 * instantly — same tab via a custom event, other tabs via `storage`.
 *
 * Previously this was broken: Settings wrote `bse_feed_density` while the
 * filings feed read a different key (`nexus_feed_density`), and no feed
 * actually changed its layout from the value. Both are fixed here.
 */
export type FeedDensity = 'comfortable' | 'compact' | 'dense';

const STORAGE_KEY = 'bse_feed_density';
const LEGACY_KEY = 'nexus_feed_density';
export const DENSITY_EVENT = 'bse:feed-density-change';

export const DEFAULT_DENSITY: FeedDensity = 'compact';

function isDensity(v: unknown): v is FeedDensity {
  return v === 'comfortable' || v === 'compact' || v === 'dense';
}

function readDensity(): FeedDensity {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isDensity(saved)) return saved;
    // One-time migration from the old feed-local key, then drop it.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (isDensity(legacy)) {
      try {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
      } catch {}
      return legacy;
    }
  } catch {}
  return DEFAULT_DENSITY;
}

export function useFeedDensity(): [FeedDensity, (d: FeedDensity) => void] {
  const [density, setDensityState] = useState<FeedDensity>(readDensity);

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<FeedDensity>).detail;
      setDensityState(isDensity(next) ? next : readDensity());
    };
    window.addEventListener(DENSITY_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(DENSITY_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const setDensity = useCallback((d: FeedDensity) => {
    if (!isDensity(d)) return;
    try {
      localStorage.setItem(STORAGE_KEY, d);
    } catch {}
    setDensityState(d);
    window.dispatchEvent(new CustomEvent<FeedDensity>(DENSITY_EVENT, { detail: d }));
  }, []);

  return [density, setDensity];
}
