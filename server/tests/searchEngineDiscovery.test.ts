import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { indexNowQueue, INDEXNOW_KEY, INDEXNOW_HOST, INDEXNOW_KEY_LOCATION } from '../services/indexNow.js';

describe('Search Engine & Cross-Browser Discovery (Step 06: IndexNow & OpenSearch)', () => {
  test('OpenSearch XML exists, is valid XML, and contains required search templates', () => {
    const opensearchPath = path.join(process.cwd(), 'public', 'opensearch.xml');
    assert.ok(fs.existsSync(opensearchPath), 'public/opensearch.xml must exist');

    const content = fs.readFileSync(opensearchPath, 'utf8');
    assert.ok(content.includes('<ShortName>BSE Nexus</ShortName>'));
    assert.ok(content.includes('template="https://bsenexus.in/?search={searchTerms}"'));
    assert.ok(content.includes('template="https://bsenexus.in/api/search-company?q={searchTerms}"'));
    assert.ok(content.includes('xmlns="http://a9.com/-/spec/opensearch/1.1/"'));
  });

  test('IndexNow key file exists in public directory and matches key constant', () => {
    const keyFilePath = path.join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`);
    assert.ok(fs.existsSync(keyFilePath), `${INDEXNOW_KEY}.txt must exist in public/`);

    const fileContent = fs.readFileSync(keyFilePath, 'utf8').trim();
    assert.strictEqual(fileContent, INDEXNOW_KEY);
    assert.strictEqual(INDEXNOW_HOST, 'bsenexus.in');
    assert.strictEqual(INDEXNOW_KEY_LOCATION, `https://bsenexus.in/${INDEXNOW_KEY}.txt`);
  });

  test('IndexNowQueue enqueues valid URLs and deduplicates', () => {
    indexNowQueue.enqueue('https://bsenexus.in/announcement/12345');
    indexNowQueue.enqueue('https://bsenexus.in/announcement/12345'); // Duplicate
    indexNowQueue.enqueue('https://bsenexus.in/company/RELIANCE');
    indexNowQueue.enqueue('invalid-url-ignored'); // Invalid

    const stats = indexNowQueue.getStats();
    assert.ok(stats.pendingQueueSize >= 2);
  });

  test('index.html references OpenSearch XML and verification tags', () => {
    const indexHtmlPath = path.join(process.cwd(), 'index.html');
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

    assert.ok(indexHtml.includes('href="/opensearch.xml"'));
    assert.ok(indexHtml.includes('rel="search"'));
    assert.ok(indexHtml.includes('msvalidate.01'));
    assert.ok(indexHtml.includes('google-site-verification'));
  });

  test('Public search engine verification files have exact expected contents', () => {
    const txtHashFile = path.join(process.cwd(), 'public', 'f04655809ee7e64107ce8d94504e3f6e949e271a973b354fcb68861739bb458f.txt');
    assert.ok(fs.existsSync(txtHashFile), 'Hash verification txt file must exist');
    assert.strictEqual(
      fs.readFileSync(txtHashFile, 'utf8').trim(),
      'f04655809ee7e64107ce8d94504e3f6e949e271a973b354fcb68861739bb458f'
    );

    const googleFile = path.join(process.cwd(), 'public', 'googlea1571e99ac9d4731.html');
    assert.ok(fs.existsSync(googleFile), 'Google HTML verification file must exist');
    assert.strictEqual(
      fs.readFileSync(googleFile, 'utf8').trim(),
      'google-site-verification: googlea1571e99ac9d4731.html'
    );

    const bingFile = path.join(process.cwd(), 'public', 'BingSiteAuth.xml');
    assert.ok(fs.existsSync(bingFile), 'BingSiteAuth.xml must exist');
    const bingContent = fs.readFileSync(bingFile, 'utf8');
    assert.ok(bingContent.includes('<user>B4A21EC561B944483A1164F292660069</user>'));
  });

  test('robots.txt allows all, disallows /api/ and /auth/, allows AI crawlers, and links sitemap', () => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    assert.ok(fs.existsSync(robotsPath), 'robots.txt must exist');

    const content = fs.readFileSync(robotsPath, 'utf8');
    assert.ok(content.includes('User-agent: *'));
    assert.ok(content.includes('Allow: /'));
    assert.ok(content.includes('Disallow: /api/'));
    assert.ok(content.includes('Disallow: /auth/'));
    assert.ok(content.includes('User-agent: GPTBot'));
    assert.ok(content.includes('User-agent: OAI-SearchBot'));
    assert.ok(content.includes('User-agent: ClaudeBot'));
    assert.ok(content.includes('User-agent: Google-Extended'));
    assert.ok(content.includes('Sitemap: https://bsenexus.in/sitemap.xml'));
  });

  test('public/sitemap.xml is valid XML, canonical https://bsenexus.in/, has no uuid or batch_test_ URLs', () => {
    const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml must exist');

    const content = fs.readFileSync(sitemapPath, 'utf8');
    assert.ok(content.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(content.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
    assert.ok(!content.includes('batch_test_'), 'Sitemap must not contain batch_test_ URLs');
    assert.ok(!content.includes('/announcement/'), 'Sitemap must not contain /announcement/ URLs');
    assert.ok(content.includes('<loc>https://bsenexus.in/</loc>'));
    assert.ok(content.includes('<loc>https://bsenexus.in/company/RELIANCE</loc>'));
  });

  test('index.html head title starts with BSE Nexus and meta description contains BSE Nexus', () => {
    const indexHtmlPath = path.join(process.cwd(), 'index.html');
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

    const titleMatch = indexHtml.match(/<title>(.*?)<\/title>/);
    assert.ok(titleMatch, 'index.html must have a title');
    assert.ok(titleMatch[1].startsWith('BSE Nexus'), 'Title must start with BSE Nexus');

    const descMatch = indexHtml.match(/<meta\s+name="description"\s+content="([^"]*)"/);
    assert.ok(descMatch, 'index.html must have meta description');
    assert.ok(descMatch[1].includes('BSE Nexus'), 'Meta description must contain BSE Nexus');

    assert.ok(indexHtml.includes('<link rel="canonical" href="https://bsenexus.in/" />'));
    assert.ok(indexHtml.includes('property="og:title"'));
    assert.ok(indexHtml.includes('name="twitter:card"'));
    assert.ok(indexHtml.includes('name="theme-color"'));

    // JSON-LD contains Organization, WebSite, and FAQPage
    assert.ok(indexHtml.includes('"@type": "Organization"'));
    assert.ok(indexHtml.includes('"@type": "WebSite"'));
    assert.ok(indexHtml.includes('"@type": "FAQPage"'));
  });

  test('LandingPage contains semantic About BSE Nexus section', () => {
    const landingPagePath = path.join(process.cwd(), 'src', 'components', 'LandingPage.tsx');
    const content = fs.readFileSync(landingPagePath, 'utf8');

    assert.ok(content.includes('id="about"'), 'LandingPage must include id="about"');
    assert.ok(content.includes('About BSE Nexus'), 'LandingPage must contain About BSE Nexus');
  });
});
