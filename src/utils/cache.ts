/**
 * High-performance client-side cache for instantaneous Stale-While-Revalidate (SWR)
 * rendering, eliminating layout shifts (CLS) and optimizing First Contentful Paint (FCP).
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export function getCacheItem<T>(key: string, maxAgeMs: number = 5 * 60 * 1000): T | null {
  // 1. Check in-memory cache first (fastest, zero deserialization overhead)
  const mem = memoryCache.get(key);
  if (mem) {
    if (Date.now() - mem.timestamp < maxAgeMs) {
      return mem.data as T;
    }
    memoryCache.delete(key);
  }

  // 2. Fall back to localStorage for cross-session persistence
  // (survives app restarts — sessionStorage would be wiped on every login)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`nexus_cache_${key}`);
      if (stored) {
        const parsed: CacheEntry<T> = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          // Re-populate memory cache for subsequent instant lookups
          memoryCache.set(key, parsed);
          return parsed.data;
        } else {
          window.localStorage.removeItem(`nexus_cache_${key}`);
        }
      }
    }
  } catch (err) {
    // Gracefully handle localStorage quota or private-browsing restrictions
  }

  return null;
}

export function setCacheItem<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now()
  };

  // Always update in-memory store
  memoryCache.set(key, entry);

  // Persist in localStorage for cross-session instant loading
  // (survives app restarts — sessionStorage would be wiped on every login)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`nexus_cache_${key}`, JSON.stringify(entry));
    }
  } catch (err) {
    // Quota reached or security error - in-memory cache remains active
  }
}

export function invalidateCacheItem(key: string): void {
  memoryCache.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`nexus_cache_${key}`);
    }
  } catch (err) {}
}

export function clearAllCache(): void {
  memoryCache.clear();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('nexus_cache_')) {
          keysToRemove.push(k);
        }
      }
      // BUGFIX (1 Oct 2026 audit LOGIC-006): Was calling sessionStorage.removeItem
      // instead of localStorage.removeItem — the cache was NEVER actually cleared.
      // Calling clearAllCache() was a no-op; stale data persisted across sessions
      // and could leak between accounts on shared devices.
      keysToRemove.forEach(k => window.localStorage.removeItem(k));
    }
  } catch (err) {}
}
