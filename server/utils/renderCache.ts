import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface CacheEntry {
  body: string;
  contentType: string;
  etag: string;
  statusCode: number;
  headers?: Record<string, string>;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export interface CacheOptions {
  ttlMs: number;
  maxEntries?: number;
  staleWhileRevalidateSec?: number;
  publicCache?: boolean;
}

export class RenderCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: { maxEntries?: number; defaultTtlMs?: number } = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.defaultTtlMs = options.defaultTtlMs || 5 * 60 * 1000; // 5 mins default
  }

  /**
   * Generates a weak ETag from payload string
   */
  public generateEtag(content: string): string {
    const hash = crypto.createHash('sha1').update(content).digest('base64url').slice(0, 16);
    return `W/"${hash}-${content.length.toString(36)}"`;
  }

  /**
   * Retrieve cached item if present and unexpired
   */
  public get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (entry.expiresAt < now) {
      // Expired - delete from cache
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Refresh LRU position
    this.cache.delete(key);
    this.cache.set(key, entry);

    entry.hits++;
    this.hits++;
    return entry;
  }

  /**
   * Set cache entry with LRU eviction
   */
  public set(
    key: string,
    body: string,
    contentType: string,
    options?: Partial<CacheOptions>,
    statusCode = 200,
    headers?: Record<string, string>
  ): CacheEntry {
    const now = Date.now();
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    const etag = this.generateEtag(body);

    // Evict oldest if capacity exceeded
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }

    const entry: CacheEntry = {
      body,
      contentType,
      etag,
      statusCode,
      headers,
      createdAt: now,
      expiresAt: now + ttlMs,
      hits: 0
    };

    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Invalidate specific key or keys matching pattern
   */
  public invalidate(keyOrPrefix: string): number {
    let deletedCount = 0;
    if (this.cache.has(keyOrPrefix)) {
      this.cache.delete(keyOrPrefix);
      deletedCount++;
    } else {
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith(keyOrPrefix)) {
          this.cache.delete(key);
          deletedCount++;
        }
      }
    }
    return deletedCount;
  }

  /**
   * Clear entire cache
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Diagnostic statistics
   */
  public getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let totalBytes = 0;

    for (const [, entry] of this.cache) {
      if (entry.expiresAt >= now) {
        activeEntries++;
        totalBytes += entry.body.length;
      }
    }

    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? Number(((this.hits / totalRequests) * 100).toFixed(1)) : 0;

    return {
      activeEntries,
      maxEntries: this.maxEntries,
      totalBytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRatioPercent: hitRatio
    };
  }

  /**
   * Express middleware factory for caching rendered HTML or JSON GET routes
   */
  public middleware(options: CacheOptions & { keyGenerator?: (req: Request) => string }) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only cache GET or HEAD requests
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      const key = options.keyGenerator ? options.keyGenerator(req) : `${req.baseUrl || ''}${req.path}`;
      const cached = this.get(key);

      // Check conditional If-None-Match header
      const clientEtag = req.headers['if-none-match'];

      if (cached) {
        res.setHeader('ETag', cached.etag);
        res.setHeader('X-Cache', 'HIT');

        const maxAgeSec = Math.max(1, Math.floor(options.ttlMs / 1000));
        const swr = options.staleWhileRevalidateSec || Math.max(60, maxAgeSec * 2);
        const cacheVisibility = options.publicCache === false ? 'private' : 'public';
        res.setHeader('Cache-Control', `${cacheVisibility}, max-age=${maxAgeSec}, stale-while-revalidate=${swr}`);

        // If client already has fresh ETag, return 304 Not Modified
        if (clientEtag && clientEtag === cached.etag) {
          return res.status(304).end();
        }

        res.status(cached.statusCode);
        res.setHeader('Content-Type', cached.contentType);
        if (cached.headers) {
          for (const [hName, hVal] of Object.entries(cached.headers)) {
            res.setHeader(hName, hVal);
          }
        }
        return res.send(cached.body);
      }

      // Intercept res.send on MISS
      res.setHeader('X-Cache', 'MISS');
      const originalSend = res.send.bind(res);

      res.send = ((bodyContent: any) => {
        // Only cache successful 200 responses
        if (res.statusCode === 200 && typeof bodyContent === 'string') {
          const contentType = (res.getHeader('Content-Type') as string) || 'text/html; charset=utf-8';
          const maxAgeSec = Math.max(1, Math.floor(options.ttlMs / 1000));
          const swr = options.staleWhileRevalidateSec || Math.max(60, maxAgeSec * 2);
          const cacheVisibility = options.publicCache === false ? 'private' : 'public';

          const entry = this.set(key, bodyContent, contentType, options);
          res.setHeader('ETag', entry.etag);
          res.setHeader('Cache-Control', `${cacheVisibility}, max-age=${maxAgeSec}, stale-while-revalidate=${swr}`);

          if (clientEtag && clientEtag === entry.etag) {
            return res.status(304).end();
          }
        }
        return originalSend(bodyContent);
      }) as any;

      next();
    };
  }
}

// Global Singletons for distinct render domains
export const pageRenderCache = new RenderCache({ maxEntries: 1000, defaultTtlMs: 30 * 60 * 1000 }); // 30 min for announcement/company pages
export const apiResponseCache = new RenderCache({ maxEntries: 500, defaultTtlMs: 3 * 60 * 1000 });  // 3 min for public JSON feeds
export const staticGuideCache = new RenderCache({ maxEntries: 100, defaultTtlMs: 24 * 60 * 60 * 1000 }); // 24 hours for market guides
