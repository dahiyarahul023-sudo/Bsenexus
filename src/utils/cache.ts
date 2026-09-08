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

  // 2. Fall back to sessionStorage for cross-navigation state preservation
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(`nexus_cache_${key}`);
      if (stored) {
        const parsed: CacheEntry<T> = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          // Re-populate memory cache for subsequent instant lookups
          memoryCache.set(key, parsed);
          return parsed.data;
        } else {
          window.sessionStorage.removeItem(`nexus_cache_${key}`);
        }
      }
    }
  } catch (err) {
    // Gracefully handle sessionStorage quota or private-browsing restrictions
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

  // Attempt to persist in sessionStorage for cross-tab-navigation instant loading
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(`nexus_cache_${key}`, JSON.stringify(entry));
    }
  } catch (err) {
    // Quota reached or security error - in-memory cache remains active
  }
}

export function invalidateCacheItem(key: string): void {
  memoryCache.delete(key);
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(`nexus_cache_${key}`);
    }
  } catch (err) {}
}

export function clearAllCache(): void {
  memoryCache.clear();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith('nexus_cache_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
    }
  } catch (err) {}
}
