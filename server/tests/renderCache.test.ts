import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RenderCache } from '../utils/renderCache.js';

describe('RenderCache (Step 05: Cache Rendered Pages)', () => {
  let cache: RenderCache;

  beforeEach(() => {
    cache = new RenderCache({ maxEntries: 3, defaultTtlMs: 5000 });
  });

  test('should store and retrieve rendered pages successfully (HIT & MISS)', () => {
    assert.strictEqual(cache.get('ann:12345'), null);
    const stats1 = cache.getStats();
    assert.strictEqual(stats1.misses, 1);
    assert.strictEqual(stats1.hits, 0);

    const renderedHtml = '<html><head><title>Test Announcement</title></head><body>Content</body></html>';
    const entry = cache.set('ann:12345', renderedHtml, 'text/html; charset=utf-8');

    assert.ok(entry.etag);
    assert.strictEqual(entry.body, renderedHtml);

    const cached = cache.get('ann:12345');
    assert.notStrictEqual(cached, null);
    assert.strictEqual(cached?.body, renderedHtml);
    assert.strictEqual(cached?.etag, entry.etag);

    const stats2 = cache.getStats();
    assert.strictEqual(stats2.hits, 1);
    assert.strictEqual(stats2.activeEntries, 1);
  });

  test('should generate consistent and unique ETags for content', () => {
    const etag1 = cache.generateEtag('<html>Page A</html>');
    const etag2 = cache.generateEtag('<html>Page A</html>');
    const etag3 = cache.generateEtag('<html>Page B</html>');

    assert.strictEqual(etag1, etag2);
    assert.notStrictEqual(etag1, etag3);
    assert.ok(etag1.startsWith('W/"'));
  });

  test('should evict oldest items according to LRU policy when maxEntries is exceeded', () => {
    cache.set('page:1', 'content 1', 'text/html');
    cache.set('page:2', 'content 2', 'text/html');
    cache.set('page:3', 'content 3', 'text/html');

    assert.strictEqual(cache.getStats().activeEntries, 3);

    // Adding 4th item should evict oldest ('page:1')
    cache.set('page:4', 'content 4', 'text/html');

    assert.strictEqual(cache.get('page:1'), null);
    assert.notStrictEqual(cache.get('page:2'), null);
    assert.notStrictEqual(cache.get('page:3'), null);
    assert.notStrictEqual(cache.get('page:4'), null);
    assert.strictEqual(cache.getStats().evictions, 1);
  });

  test('should support targeted and prefix invalidation', () => {
    cache.set('ann:101', 'Announcement 101', 'text/html');
    cache.set('ann:102', 'Announcement 102', 'text/html');
    cache.set('comp:RELIANCE', 'Company Reliance', 'text/html');

    // Invalidate single key
    const deleted1 = cache.invalidate('comp:RELIANCE');
    assert.strictEqual(deleted1, 1);
    assert.strictEqual(cache.get('comp:RELIANCE'), null);

    // Invalidate prefix
    const deleted2 = cache.invalidate('ann:');
    assert.strictEqual(deleted2, 2);
    assert.strictEqual(cache.get('ann:101'), null);
    assert.strictEqual(cache.get('ann:102'), null);
  });

  test('should expire entries after TTL', async () => {
    const fastCache = new RenderCache({ defaultTtlMs: 25 });
    fastCache.set('temp', 'temporary content', 'text/html');

    assert.notStrictEqual(fastCache.get('temp'), null);

    await new Promise((resolve) => setTimeout(resolve, 40));

    assert.strictEqual(fastCache.get('temp'), null);
  });
});
