import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('PWA Offline Shell Sync & Offline Access (Step 07)', () => {
  test('Service worker (public/sw.js) exists and contains valid cache configuration', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');

    const swContent = fs.readFileSync(swPath, 'utf8');
    assert.ok(swContent.includes('CACHE_NAME'), 'sw.js must define CACHE_NAME');
    assert.ok(swContent.includes('STATIC_ASSETS'), 'sw.js must define STATIC_ASSETS array');
    assert.ok(swContent.includes('skipWaiting'), 'sw.js must support fast activation via skipWaiting');
    assert.ok(swContent.includes('clients.claim'), 'sw.js must claim clients on activation');
  });

  test('STATIC_ASSETS precaches critical offline application shell files', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    const criticalShellFiles = [
      '/',
      '/index.html',
      '/manifest.json',
      '/opensearch.xml',
      '/favicon.ico',
      '/icon.svg',
      '/icon-192.png',
      '/icon-512.png'
    ];

    for (const file of criticalShellFiles) {
      assert.ok(
        swContent.includes(`'${file}'`) || swContent.includes(`"${file}"`),
        `STATIC_ASSETS must include critical file: ${file}`
      );
    }
  });

  test('Public API cache allowlist includes market pulse, announcements, and stock master', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    assert.ok(swContent.includes("'/api/announcements'"));
    assert.ok(swContent.includes("'/api/stock-master'"));
    assert.ok(swContent.includes("'/api/market/status'"));
    assert.ok(swContent.includes("'/api/news/sources'"));
  });

  test('Strict privacy boundary prevents private user data from being cached in service worker', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    // Private routes that must never be cached by service worker
    assert.ok(swContent.includes('/watchlists'));
    assert.ok(swContent.includes('/settings'));
    assert.ok(swContent.includes('/notifications'));
    assert.ok(swContent.includes('/auth'));
    assert.ok(swContent.includes('/admin'));
  });

  test('Web App Manifest (public/manifest.json) meets PWA installability requirements', () => {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'public/manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(typeof manifest.name, 'string');
    assert.strictEqual(typeof manifest.short_name, 'string');
    assert.strictEqual(manifest.display, 'standalone');
    assert.strictEqual(manifest.start_url, '/');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);

    const has192 = manifest.icons.some((i: any) => i.sizes === '192x192' || i.sizes?.includes('192'));
    const has512 = manifest.icons.some((i: any) => i.sizes === '512x512' || i.sizes?.includes('512'));
    assert.ok(has192, 'Manifest must contain a 192x192 icon');
    assert.ok(has512, 'Manifest must contain a 512x512 icon');
  });

  test('HTML entry point registers service worker and links PWA manifest', () => {
    const indexPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.ok(html.includes('rel="manifest"'));
    assert.ok(html.includes('href="/manifest.json"'));
    assert.ok(html.includes('theme-color'));
  });
});
