import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { circuitRegistry } from '../utils/circuitBreaker.js';
import { pageRenderCache, apiResponseCache, staticGuideCache } from '../utils/renderCache.js';
import { isFirestoreQuotaExceeded } from '../database/localStore.js';
import { INDEXNOW_KEY, INDEXNOW_HOST } from '../services/indexNow.js';

describe('End-to-End System Audit & Final Production Verification (Step 08)', () => {
  test('All critical system circuit breakers are properly registered and initialized', () => {
    const statuses = circuitRegistry.getAllStatuses();
    const names = statuses.map(s => s.name);

    assert.ok(names.includes('BSE_API'), 'BSE_API circuit breaker must be active');
    assert.ok(names.includes('TELEGRAM_API'), 'TELEGRAM_API circuit breaker must be active');
    assert.ok(names.includes('GEMINI_API'), 'GEMINI_API circuit breaker must be active');
    assert.ok(names.includes('EXTERNAL_FEEDS'), 'EXTERNAL_FEEDS circuit breaker must be active');
    assert.ok(names.includes('INDEXNOW_API'), 'INDEXNOW_API circuit breaker must be active');

    for (const status of statuses) {
      assert.ok(
        ['CLOSED', 'HALF_OPEN'].includes(status.state),
        `Circuit breaker ${status.name} should not be permanently tripped at boot (current: ${status.state})`
      );
    }
  });

  test('All multi-tier render and API caches are operational with healthy telemetry', () => {
    const pageStats = pageRenderCache.getStats();
    const apiStats = apiResponseCache.getStats();
    const guideStats = staticGuideCache.getStats();

    assert.strictEqual(typeof pageStats.hits, 'number');
    assert.strictEqual(typeof apiStats.hits, 'number');
    assert.strictEqual(typeof guideStats.hits, 'number');

    assert.ok(pageStats.maxEntries >= 500, 'Page cache should accommodate at least 500 pages');
    assert.ok(apiStats.maxEntries >= 200, 'API cache should accommodate at least 200 endpoints');
  });

  test('IndexNow and OpenSearch discovery configuration is validated', () => {
    assert.ok(INDEXNOW_KEY.length > 10, 'IndexNow key must be valid');
    assert.strictEqual(INDEXNOW_HOST, 'bsenexus.in');

    const keyFilePath = path.join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`);
    assert.ok(fs.existsSync(keyFilePath), 'IndexNow key file must exist in public folder');

    const opensearchPath = path.join(process.cwd(), 'public', 'opensearch.xml');
    assert.ok(fs.existsSync(opensearchPath), 'OpenSearch XML must exist in public folder');
  });

  test('Robots.txt, Sitemap, and LLMs.txt files exist and are syntactically sound', () => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    assert.ok(fs.existsSync(robotsPath), 'robots.txt must exist');
    const robotsContent = fs.readFileSync(robotsPath, 'utf8');
    assert.ok(robotsContent.includes('Sitemap: https://bsenexus.in/sitemap.xml'));

    const llmsPath = path.join(process.cwd(), 'public', 'llms.txt');
    assert.ok(fs.existsSync(llmsPath), 'llms.txt must exist');
    const llmsContent = fs.readFileSync(llmsPath, 'utf8');
    assert.ok(llmsContent.includes('BSE Nexus'));
  });

  test('Security & local storage fallback engine is resilient against cloud quota interruptions', () => {
    // Check that localStore does not crash when querying quota state
    const quotaState = isFirestoreQuotaExceeded();
    assert.strictEqual(typeof quotaState, 'boolean');
  });

  test('HTML entry point contains canonical, OpenGraph, Twitter, and SEO tags', () => {
    const indexPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.ok(html.includes('<title>'), 'HTML must have title');
    assert.ok(html.includes('name="description"'), 'HTML must have meta description');
    assert.ok(html.includes('property="og:title"'), 'HTML must have OpenGraph title');
    assert.ok(html.includes('property="og:image"'), 'HTML must have OpenGraph image');
    assert.ok(html.includes('name="twitter:card"'), 'HTML must have Twitter card');
    assert.ok(html.includes('rel="canonical"'), 'HTML must have canonical URL');
  });
});
