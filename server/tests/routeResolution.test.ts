import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Route Resolution & Dedicated Pages Architecture (/pricing, /guides, 404)', () => {
  // Test 1: Dedicated components exist and do not fabricate unconfirmed claims
  test('Dedicated UI components exist for PricingPage, GuidesPage, and NotFoundPage', () => {
    const pricingPath = path.join(process.cwd(), 'src', 'components', 'PricingPage.tsx');
    const guidesPath = path.join(process.cwd(), 'src', 'components', 'GuidesPage.tsx');
    const notFoundPath = path.join(process.cwd(), 'src', 'components', 'NotFoundPage.tsx');

    assert.ok(fs.existsSync(pricingPath), 'src/components/PricingPage.tsx must exist');
    assert.ok(fs.existsSync(guidesPath), 'src/components/GuidesPage.tsx must exist');
    assert.ok(fs.existsSync(notFoundPath), 'src/components/NotFoundPage.tsx must exist');

    const pricingCode = fs.readFileSync(pricingPath, 'utf8');
    // Confirmed claims from LandingPage.tsx
    assert.ok(pricingCode.includes('₹499'), 'Pricing must reflect confirmed ₹499/mo launch pricing');
    assert.ok(pricingCode.includes('100% Free') || pricingCode.includes('Free'), 'Pricing must reflect Free Community tier');
    assert.ok(!pricingCode.includes('₹999') && !pricingCode.includes('₹1999'), 'Pricing must not fabricate enterprise pricing');

    const guidesCode = fs.readFileSync(guidesPath, 'utf8');
    assert.ok(guidesCode.includes('SEBI') || guidesCode.includes('Regulation 30'), 'Guides must cover SEBI regulations');
  });

  // Test 2: App.tsx routes to dedicated pages on direct load, refresh, and popstate
  test('App.tsx implements client-side route resolution with popstate listener', () => {
    const appPath = path.join(process.cwd(), 'src', 'App.tsx');
    const appCode = fs.readFileSync(appPath, 'utf8');

    assert.ok(appCode.includes('getAppPathRoute'), 'App.tsx must define getAppPathRoute');
    assert.ok(appCode.includes("path === '/pricing'"), 'App.tsx must resolve /pricing route');
    assert.ok(appCode.includes("path === '/guides'"), 'App.tsx must resolve /guides route');
    assert.ok(appCode.includes("window.addEventListener('popstate'"), 'App.tsx must handle browser back/forward buttons');
    assert.ok(appCode.includes('<PricingPage'), 'App.tsx must render PricingPage for /pricing');
    assert.ok(appCode.includes('<GuidesPage'), 'App.tsx must render GuidesPage for /guides');
    assert.ok(appCode.includes('<NotFoundPage'), 'App.tsx must render NotFoundPage for unknown routes');
  });

  // Test 3: server.ts has server-rendered endpoints for /pricing and /guides
  test('server.ts registers crawlable, server-rendered routes for /pricing and /guides', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverCode = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverCode.includes("app.get(['/pricing', '/pricing/']"), 'server.ts must have /pricing route handler');
    assert.ok(serverCode.includes("app.get(['/guides', '/guides/']"), 'server.ts must have /guides route handler');
    assert.ok(serverCode.includes("renderPricingPage()"), 'server.ts must use renderPricingPage');
    assert.ok(serverCode.includes("renderGuidesIndexPage()"), 'server.ts must use renderGuidesIndexPage');
  });

  // Test 4: server.ts implements intentional redirects (/plans -> /pricing, /market-guides -> /guides)
  test('server.ts implements intentional 301 redirects for aliases', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverCode = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverCode.includes("app.get(['/plans', '/plans/'], (_req, res) => {"), 'server.ts must handle /plans');
    assert.ok(serverCode.includes("res.redirect(301, '/pricing')"), '/plans must redirect 301 to /pricing');
    assert.ok(serverCode.includes("app.get(['/market-guides', '/market-guides/'], (_req, res) => {"), 'server.ts must handle /market-guides');
    assert.ok(serverCode.includes("res.redirect(301, '/guides')"), '/market-guides must redirect 301 to /guides');
  });

  // Test 5: server.ts serves true HTTP 404 for invalid routes instead of silent homepage fallback
  test('server.ts returns HTTP 404 with renderGeneral404Page for invalid routes', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverCode = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverCode.includes('renderGeneral404Page'), 'server.ts must implement renderGeneral404Page');
    assert.ok(serverCode.includes('res.status(404)'), 'server.ts must send 404 status code');
  });

  // Test 6: TAB_SEO_CONFIG and sitemaps include /pricing and /guides with unique metadata
  test('SEO metadata config and sitemaps correctly specify unique canonical URLs and titles', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverCode = fs.readFileSync(serverPath, 'utf8');

    // Canonical & Title for pricing
    assert.ok(serverCode.includes('canonical: "https://bsenexus.in/pricing"'), 'Pricing canonical must be https://bsenexus.in/pricing');
    assert.ok(serverCode.includes('Pricing & Plans — 100% Free Launch Access | BSE Nexus'), 'Pricing title must be defined');

    // Canonical & Title for guides
    assert.ok(serverCode.includes('canonical: "https://bsenexus.in/guides"'), 'Guides canonical must be https://bsenexus.in/guides');
    assert.ok(serverCode.includes('Indian Equity Research Guides & Market Intelligence | BSE Nexus'), 'Guides title must be defined');

    // Sitemap includes
    assert.ok(serverCode.includes('<loc>https://bsenexus.in/pricing</loc>'), 'Sitemap must contain /pricing');
    assert.ok(serverCode.includes('<loc>https://bsenexus.in/guides</loc>'), 'Sitemap must contain /guides');
  });

  // Test 7: Direct render HTML validation (SSR output verification)
  test('Server render functions generate complete HTML with heading hierarchy, OpenGraph, and canonicals', async () => {
    // Dynamic import to test rendered HTML strings
    const { renderPricingPage, renderGuidesIndexPage, renderGeneral404Page, renderFaqPage } = await import('../../server.ts');

    // Test Pricing HTML
    const pricingHtml = renderPricingPage();
    assert.ok(pricingHtml.includes('<title>Pricing &amp; Plans — 100% Free Launch Access | BSE Nexus</title>'), 'Pricing title must match');
    assert.ok(pricingHtml.includes('<link rel="canonical" href="https://bsenexus.in/pricing"'), 'Pricing canonical link');
    assert.ok(pricingHtml.includes('<meta property="og:title" content="Pricing &amp; Plans — 100% Free Launch Access | BSE Nexus"'), 'Pricing OG title');
    assert.ok(pricingHtml.includes('<meta property="og:url" content="https://bsenexus.in/pricing"'), 'Pricing OG url');
    assert.ok(pricingHtml.includes('<h1>'), 'Pricing page must have an h1 element');
    assert.ok(pricingHtml.includes('₹499'), 'Pricing page must show ₹499 launch rate');
    assert.ok(pricingHtml.includes('Free'), 'Pricing page must show Free tier');

    // Test Guides HTML
    const guidesHtml = renderGuidesIndexPage();
    assert.ok(guidesHtml.includes('<title>Indian Equity Research Guides &amp; Market Intelligence | BSE Nexus</title>'), 'Guides title must match');
    assert.ok(guidesHtml.includes('<link rel="canonical" href="https://bsenexus.in/guides"'), 'Guides canonical link');
    assert.ok(guidesHtml.includes('<meta property="og:title" content="Indian Equity Research Guides &amp; Market Intelligence | BSE Nexus"'), 'Guides OG title');
    assert.ok(guidesHtml.includes('<meta property="og:url" content="https://bsenexus.in/guides"'), 'Guides OG url');
    assert.ok(guidesHtml.includes('<h1>'), 'Guides page must have an h1 element');

    // Test 404 HTML
    const notFoundHtml = renderGeneral404Page('/invalid-random-url');
    assert.ok(notFoundHtml.includes('<title>404 — Page Not Found | BSE Nexus</title>'), '404 title must match');
    assert.ok(notFoundHtml.includes('/invalid-random-url'), '404 page must display requested invalid path');
    assert.ok(notFoundHtml.includes('404'), '404 page must display 404');
    assert.ok(notFoundHtml.includes('Back to Live Terminal'), '404 page must provide wayfinding back to terminal');

    // Test Existing FAQ preservation
    const faqHtml = renderFaqPage();
    assert.ok(faqHtml.includes('FAQPage'), 'FAQ page must preserve schema.org FAQPage JSON-LD');
  });

  after(() => {
    setTimeout(() => process.exit(0), 100);
  });
});
