import 'dotenv/config';
import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { createServer as createViteServer } from "vite";

import { authMiddleware, authRouter, apiRateLimiter, authRateLimiter } from "./server/security/auth.js";
import { apiRouter } from "./server/api/routes.js";
import { processAnnouncements, getConsecutiveFailures, pruneAndCheckStorageCapacity } from "./server/services/monitor.js";
import { fetchAndSyncResultsCalendar } from "./server/services/resultsCalendarService.js";
import { syncWatchlistHistoricalData, backfillRecentAnnouncements } from "./server/services/bse.js";
import { initWatchlists } from "./server/database/watchlistDao.js";
import { updateTelegramHealth } from "./server/services/telegram.js";
import { processAutomatedNewsAlerts } from "./server/services/stockNewsService.js";
import { addLog } from "./server/database/logDao.js";
import { getPollingIntervalMs, parseBseDate, getISTMarketStatus } from "./server/utils/helpers.js";
import { getAnnouncementById, getRecentAnnouncements } from "./server/database/announcementDao.js";
import { getScripCode, getAllStockEntries } from "./server/utils/stockResolver.js";
import { getCompanyIntelligence } from "./server/services/companyIntelService.js";
import { MARKET_GUIDES, getMarketGuides, getMarketGuideBySlug } from "./server/services/marketGuidesService.js";
import type { ServerMarketGuide as MarketGuide } from "./server/services/marketGuidesService.js";
import { resumeFirestoreNetwork } from "./server/database/firebase.js";
import { isFirestoreQuotaExceeded, getManualStorageMode, resetAdminPermissionDenied } from "./server/database/localStore.js";
import { pageRenderCache, staticGuideCache, apiResponseCache } from "./server/utils/renderCache.js";
import { INDEXNOW_KEY, indexNowQueue } from "./server/services/indexNow.js";
import { verifyRecaptchaToken } from "./server/security/recaptchaService.js";
import { getBackupStalenessMetrics } from "./server/services/bse.js";

// Global error handlers to prevent background quota/network exceptions from crashing the process
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection caught:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('Uncaught Exception caught:', err?.message || err);
});

const app = express();
const PORT = 3000;

// Trust reverse proxy (Cloud Run / Nginx) so client IP and rate-limiting work properly
app.set('trust proxy', 1);

// Enable Gzip compression in transit for JSON, text, HTML, and API responses (> 1KB threshold)
app.use(compression({
  threshold: 1024, // Don't compress payloads under 1KB
  level: 6,        // Optimal balance between CPU usage and compression ratio
  filter: (req, res) => {
    // 1. Honor client bypass header if requested
    if (req.headers['x-no-compression']) {
      return false;
    }

    // 2. Prevent double-compressing already-compressed payloads
    if (res.getHeader('Content-Encoding')) {
      return false;
    }

    // 3. Skip binary media / archives / PDFs / streams which are already compressed
    const contentType = res.getHeader('Content-Type');
    if (typeof contentType === 'string') {
      if (/^(image\/|video\/|audio\/|application\/(zip|x-zip|pdf|gzip|x-gzip|octet-stream))/i.test(contentType)) {
        return false;
      }
      // Never compress server-sent event streams
      if (contentType.includes('text/event-stream')) {
        return false;
      }
    }

    // 4. Default to standard compressible check (covers application/json, text/*, JS, CSS, SVG)
    return compression.filter(req, res);
  }
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// Explicit Service Worker handler with no-cache headers
app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  if (process.env.NODE_ENV !== 'production') {
    // In development mode, serve an unregistering Service Worker to prevent stale chunk conflicts
    res.send(`// Development Service Worker - clears all caches and self-unregisters
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});
`);
  } else {
    res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
  }
});

// HTML escaping utilities for SSR pages & SEO injection
function escapeHtmlText(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// In-memory cache for dynamic sitemap (15-minute TTL)
let sitemapMemoryCache: { xml: string; expiresAt: number } | null = null;

async function generateDynamicSitemap(): Promise<string> {
  const now = Date.now();
  if (sitemapMemoryCache && sitemapMemoryCache.expiresAt > now) {
    return sitemapMemoryCache.xml;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const staticTabs = [
    { loc: "https://bsenexus.in/", lastmod: todayStr, changefreq: "hourly", priority: "1.0" },
    { loc: "https://bsenexus.in/announcements", lastmod: todayStr, changefreq: "always", priority: "0.9" },
    { loc: "https://bsenexus.in/results-calendar", lastmod: todayStr, changefreq: "daily", priority: "0.9" },
    { loc: "https://bsenexus.in/watchlist", lastmod: todayStr, changefreq: "daily", priority: "0.8" },
    { loc: "https://bsenexus.in/companies", lastmod: todayStr, changefreq: "weekly", priority: "0.8" },
    { loc: "https://bsenexus.in/guides", lastmod: todayStr, changefreq: "weekly", priority: "0.8" },
    { loc: "https://bsenexus.in/faq", lastmod: todayStr, changefreq: "weekly", priority: "0.8" },
    { loc: "https://bsenexus.in/about", lastmod: todayStr, changefreq: "monthly", priority: "0.8" },
    { loc: "https://bsenexus.in/contact", lastmod: todayStr, changefreq: "monthly", priority: "0.8" },
    { loc: "https://bsenexus.in/disclaimer", lastmod: todayStr, changefreq: "monthly", priority: "0.8" },
    { loc: "https://bsenexus.in/privacy-policy", lastmod: todayStr, changefreq: "monthly", priority: "0.7" },
    { loc: "https://bsenexus.in/terms", lastmod: todayStr, changefreq: "monthly", priority: "0.7" }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const tab of staticTabs) {
    xml += `  <url>\n    <loc>${tab.loc}</loc>\n    <lastmod>${tab.lastmod}</lastmod>\n    <changefreq>${tab.changefreq}</changefreq>\n    <priority>${tab.priority}</priority>\n  </url>\n`;
  }

  try {
    const recent = await getRecentAnnouncements(500);
    const seenIds = new Set<string>();

    for (const ann of recent) {
      const newsId = ann.id || ann.newsId;
      if (!newsId || seenIds.has(newsId)) continue;
      seenIds.add(newsId);

      let pubTs = ann.bseTimestamp || ann.fetched_at;
      if (!pubTs && ann.bseTime) {
        pubTs = parseBseDate(ann.bseTime);
      }
      if (!pubTs || isNaN(pubTs) || pubTs <= 0) {
        pubTs = now;
      }
      const lastmod = new Date(pubTs).toISOString().split('T')[0];

      xml += `  <url>\n    <loc>https://bsenexus.in/announcement/${escapeHtmlAttr(newsId)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>never</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    }

    // Append individual company/stock pages from master database
    try {
      const stockEntries = getAllStockEntries();
      const seenSymbols = new Set<string>();
      for (const entry of stockEntries) {
        const sym = entry.symbol?.trim().toUpperCase();
        if (!sym || seenSymbols.has(sym) || !/^[A-Z0-9-]{2,15}$/.test(sym)) continue;
        seenSymbols.add(sym);
        xml += `  <url>\n    <loc>https://bsenexus.in/company/${escapeHtmlAttr(sym)}</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }
    } catch (stockErr) {
      console.warn("Error adding stock entries to sitemap:", stockErr);
    }

    // Append educational Market Guides
    try {
      for (const guide of MARKET_GUIDES) {
        const slug = guide.slug || guide.id;
        if (!slug) continue;
        xml += `  <url>\n    <loc>https://bsenexus.in/guides/${escapeHtmlAttr(slug)}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }
    } catch (guideErr) {
      console.warn("Error adding market guides to sitemap:", guideErr);
    }
    if (seenIds.size > 0) {
      sitemapMemoryCache = {
        xml,
        expiresAt: now + 15 * 60 * 1000
      };
    } else {
      // Short cache if announcement memory store is still warming up
      sitemapMemoryCache = {
        xml,
        expiresAt: now + 5000
      };
    }
  } catch (err) {
    console.warn("Error generating dynamic sitemap announcements:", err);
  }

  xml += `</urlset>\n`;

  if (!sitemapMemoryCache) {
    sitemapMemoryCache = {
      xml,
      expiresAt: now + 5000
    };
  }

  return xml;
}

const AI_STUDIO_REDIRECT_SCRIPT = `  <script>
    (function() {
      try {
        if (window.location.hostname && window.location.hostname.indexOf('ai.studio') !== -1) {
          var robotsMeta = document.querySelector('meta[name="robots"]');
          if (robotsMeta) {
            robotsMeta.setAttribute('content', 'noindex, nofollow');
          } else {
            robotsMeta = document.createElement('meta');
            robotsMeta.name = 'robots';
            robotsMeta.content = 'noindex, nofollow';
            document.head.appendChild(robotsMeta);
          }
          window.location.replace('https://bsenexus.in' + window.location.pathname + window.location.search);
        }
      } catch (e) {}
    })();
  </script>`;

function renderAnnouncementPage(announcement: any, newsId: string): string {
  const companyName = announcement.companyName || announcement.SLONGNAME || 'BSE Listed Company';
  const subject = announcement.subject || announcement.NEWSSUB || 'Corporate Announcement';
  const details = announcement.details || announcement.ATTACHMENTNAME || '';
  const category = announcement.category || 'CORPORATE_ACTION';
  const bseTime = announcement.bseTime || '';
  const pdfLink = announcement.pdfLink || '';
  const scripCode = announcement.scripCode || announcement.scrip_cd || announcement.SCRIP_CD || '';
  const symbol = announcement.symbol || announcement.scrip_id || '';
  const aiSummary = announcement.aiSummary || '';

  // 1-2 sentence description (~155 chars)
  let description = '';
  if (aiSummary && aiSummary.trim()) {
    description = aiSummary.trim().replace(/\s+/g, ' ');
  } else if (details && details.trim() && details.trim() !== subject.trim()) {
    description = `${subject.trim()} — ${details.trim().replace(/\s+/g, ' ')}`;
  } else {
    description = `${companyName} corporate disclosure to BSE: ${subject.trim()}`;
  }
  if (description.length > 155) {
    description = description.slice(0, 152).trim() + '...';
  }

  // Publication timestamps
  let pubTs = announcement.bseTimestamp || announcement.fetched_at;
  if (!pubTs && bseTime) {
    pubTs = parseBseDate(bseTime);
  }
  if (!pubTs || isNaN(pubTs) || pubTs <= 0) {
    pubTs = Date.now();
  }
  const publishedIso = new Date(pubTs).toISOString();

  let displayDate = bseTime || new Date(pubTs).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' IST';

  const canonicalUrl = `https://bsenexus.in/announcement/${encodeURIComponent(newsId)}`;
  const pageTitle = `${companyName} — ${subject} | BSE Nexus`;
  const isBatchTest = newsId.toLowerCase().includes('batch_test_');
  const robotsMeta = isBatchTest
    ? '<meta name="robots" content="noindex, nofollow">'
    : '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">';

  // JSON-LD NewsArticle Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": `${companyName}: ${subject}`.slice(0, 110),
    "datePublished": publishedIso,
    "dateModified": publishedIso,
    "description": description,
    "mainEntityOfPage": canonicalUrl,
    "url": canonicalUrl,
    "publisher": {
      "@type": "Organization",
      "name": "BSE Nexus",
      "url": "https://bsenexus.in",
      "logo": {
        "@type": "ImageObject",
        "url": "https://bsenexus.in/icon-192.png"
      }
    },
    "author": {
      "@type": "Organization",
      "name": "BSE Corporate Announcements"
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  ${robotsMeta}
${AI_STUDIO_REDIRECT_SCRIPT}
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <link rel="icon" type="image/svg+xml" href="/vite.svg">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">
  <meta property="og:site_name" content="BSE Nexus">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <!-- Structured Data / JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    :root {
      --brand-primary: #1C362A;
      --brand-accent: #059669;
      --brand-accent-hover: #047857;
      --bg-surface: #F8FAFC;
      --card-bg: #FFFFFF;
      --text-main: #0F172A;
      --text-muted: #64748B;
      --border-subtle: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg-surface);
      color: var(--text-main);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 60px;
    }
    .top-banner {
      background: var(--brand-primary);
      color: #FFFFFF;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    }
    .top-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 1.125rem;
      letter-spacing: -0.02em;
    }
    .top-brand span {
      color: #34D399;
    }
    .app-btn {
      background: #34D399;
      color: #064E3B;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s ease, transform 0.15s ease;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .app-btn:hover {
      background: #10B981;
      transform: translateY(-1px);
    }
    .container {
      max-width: 820px;
      margin: 32px auto 0 auto;
      padding: 0 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03), 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      background: #ECFDF5;
      color: #047857;
      border: 1px solid #A7F3D0;
    }
    .badge.scrip {
      background: #F1F5F9;
      color: #475569;
      border: 1px solid #E2E8F0;
    }
    .timestamp {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-left: auto;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 800;
      line-height: 1.25;
      color: #0F172A;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    h2.subject {
      font-size: 1.125rem;
      font-weight: 600;
      color: #334155;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .ai-box {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-left: 4px solid #16A34A;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .ai-title {
      font-size: 0.875rem;
      font-weight: 700;
      color: #15803D;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .ai-body {
      font-size: 0.9375rem;
      color: #166534;
      line-height: 1.6;
    }
    .section-label {
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .details-box {
      font-size: 0.9375rem;
      color: #334155;
      white-space: pre-line;
      line-height: 1.65;
      background: #F8FAFC;
      border: 1px solid #F1F5F9;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .action-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding-top: 12px;
    }
    .pdf-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #DC2626;
      color: #FFFFFF;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      transition: background 0.15s ease;
    }
    .pdf-btn:hover {
      background: #B91C1C;
    }
    .terminal-link {
      color: var(--brand-accent);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
    }
    .terminal-link:hover {
      text-decoration: underline;
    }
    footer {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 40px;
      padding: 0 20px;
    }
  </style>
</head>
<body>
  <header class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      BSE Nexus <span>Terminal</span>
    </a>
    <a href="https://bsenexus.in/?tab=announcements" class="app-btn">
      Open in BSE Nexus App &rarr;
    </a>
  </header>

  <main class="container">
    <article class="card">
      <div class="meta-bar">
        <span class="badge">${escapeHtmlText(category)}</span>
        ${scripCode ? `<span class="badge scrip">BSE: ${escapeHtmlText(String(scripCode))}</span>` : ''}
        ${symbol ? `<span class="badge scrip">${escapeHtmlText(String(symbol))}</span>` : ''}
        <time class="timestamp" datetime="${escapeHtmlAttr(publishedIso)}">${escapeHtmlText(displayDate)}</time>
      </div>

      <h1>${escapeHtmlText(companyName)}</h1>
      <h2 class="subject">${escapeHtmlText(subject)}</h2>

      ${aiSummary ? `
      <div class="ai-box">
        <div class="ai-title">⚡ AI Financial Summary &amp; Key Highlights</div>
        <div class="ai-body">${escapeHtmlText(aiSummary)}</div>
      </div>
      ` : ''}

      ${details && details !== subject ? `
      <div>
        <div class="section-label">Filing Details / Description</div>
        <div class="details-box">${escapeHtmlText(details)}</div>
      </div>
      ` : ''}

      <div class="action-row">
        ${pdfLink ? `
        <a href="${escapeHtmlAttr(pdfLink)}" target="_blank" rel="noopener noreferrer" class="pdf-btn">
          📄 View Official BSE Filing (PDF) &nearr;
        </a>
        ` : ''}
        <a href="https://bsenexus.in/?tab=announcements" class="terminal-link">
          Explore Live BSE Corporate Disclosures on BSE Nexus &rarr;
        </a>
      </div>
    </article>

    <footer>
      Independent financial terminal for Indian equities (BSE). Disclosures sourced directly from BSE India public regulatory feeds.
    </footer>
  </main>
</body>
</html>`;
}

function renderCompanyPage(data: any, symbol: string, scripCode: string): string {
  const companyName = data.companyName || symbol;
  const quote = data.quote;
  const upcomingEvent = data.upcomingEvent;
  const quarterlyResults: any[] = Array.isArray(data.quarterlyResults) ? data.quarterlyResults : [];
  const recentFilings: any[] = Array.isArray(data.recentFilings) ? data.recentFilings : [];
  const aiSnapshot = (data.aiSnapshot || '').trim();

  // Programmatic Stock Page Title formula: <Company Name> (<SYMBOL>) — BSE Announcements, Results & Corporate Actions | BSE Nexus
  const pageTitle = `${companyName} (${symbol}) — BSE Announcements, Results & Corporate Actions | BSE Nexus`;
  const canonicalUrl = `https://bsenexus.in/company/${encodeURIComponent(symbol)}`;

  const latestFiling = recentFilings[0];
  const latestAnnouncementText = latestFiling ? (latestFiling.headline || latestFiling.subject || latestFiling.NEWSSUB || latestFiling.MORE || '').trim() : '';

  let description = latestAnnouncementText
    ? `Track ${companyName} (${symbol} / BSE:${scripCode || ''}) announcements, results & corporate actions. Latest disclosure: ${latestAnnouncementText}`.trim()
    : `Track ${companyName} (${symbol} / BSE:${scripCode || ''}) announcements, quarterly results, board meetings, and corporate actions live on BSE Nexus.`.trim();
  if (description.length > 155) {
    description = description.slice(0, 152).trim() + '...';
  }

  // FAQ — query-matched, data-driven Q&A (AI-search playbook: answer the exact
  // questions ChatGPT/Google AI Overviews search for, using the company's live
  // filing data). One source renders both the visible HTML and the JSON-LD
  // FAQPage so schema and page content always stay in sync.
  const safeHeadline = latestAnnouncementText.replace(/`/g, "'").replace(/\$\{/g, '$ {');
  const latestFilingDate = latestFiling
    ? (latestFiling.bseTime || (latestFiling.timestamp ? new Date(latestFiling.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : ''))
    : '';
  const meetingWhen = upcomingEvent?.countdownDays === 0 ? 'today'
    : upcomingEvent?.countdownDays === 1 ? 'tomorrow'
    : (typeof upcomingEvent?.countdownDays === 'number' ? `in ${upcomingEvent.countdownDays} days` : '');
  const faqItems: Array<{ q: string; a: string }> = [
    {
      q: `What is the latest BSE announcement by ${companyName}?`,
      a: safeHeadline
        ? `The latest BSE disclosure by ${companyName} (${symbol})${latestFilingDate ? `, filed on ${latestFilingDate},` : ''} is: "${safeHeadline}". BSE Nexus tracks every official filing for ${companyName} with AI-powered summaries on its announcements feed.`
        : `${companyName} (${symbol}) disclosures are tracked on BSE Nexus, which structures every official BSE filing with AI-powered summaries.`
    },
    {
      q: `When is ${companyName}'s next board meeting?`,
      a: upcomingEvent
        ? `${companyName} has a board meeting scheduled for ${upcomingEvent.meetingDate || 'an announced date'}${meetingWhen ? ` (${meetingWhen})` : ''}${upcomingEvent.purpose ? ` to consider: ${upcomingEvent.purpose}` : ''}.`
        : `No upcoming board meeting is currently tracked for ${companyName}. Companies disclose meeting intimations under SEBI LODR, and scheduled dates appear on the BSE Nexus Results Calendar.`
    },
    {
      q: `When does ${companyName} declare quarterly results?`,
      a: `Under SEBI (LODR) Regulation 33, listed companies submit quarterly unaudited results within 45 days of the quarter ending, and annual audited figures within 60 days.${quarterlyResults.length > 0 ? ` ${companyName}'s recent results history is tabulated above.` : ''} Track scheduled board meetings on the BSE Nexus Results Calendar.`
    }
  ];

  // Schema.org multi-graph: Corporation, BreadcrumbList, FAQPage
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Corporation",
        "@id": `${canonicalUrl}#corporation`,
        "name": companyName,
        "tickerSymbol": `BSE:${scripCode || symbol}`,
        "url": canonicalUrl,
        "description": description,
        ...(quote?.sector || quote?.industry ? { "industry": quote.sector || quote.industry } : {}),
        "sameAs": [
          `https://www.bseindia.com/stock-share-price/${encodeURIComponent(symbol.toLowerCase())}/${encodeURIComponent(symbol.toLowerCase())}/${scripCode}/`
        ]
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://bsenexus.in/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Companies",
            "item": "https://bsenexus.in/companies"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": companyName,
            "item": canonicalUrl
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        "mainEntity": faqItems.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.a
          }
        }))
      }
    ]
  }, null, 2);

  // Quote summary helpers
  let marketCapStr = '—';
  if (typeof quote?.marketCap === 'number' && quote.marketCap > 0) {
    if (quote.marketCap >= 10000000) {
      marketCapStr = '₹' + (quote.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' Cr';
    } else {
      marketCapStr = '₹' + quote.marketCap.toLocaleString('en-IN');
    }
  }
  const isPositive = (quote?.change || 0) >= 0;
  const changeSign = isPositive ? '+' : '';
  const changeStr = typeof quote?.change === 'number'
    ? `${changeSign}₹${quote.change.toFixed(2)} (${changeSign}${Number(quote.changePercent || 0).toFixed(2)}%)`
    : '';

  // Retrieve relevant sector/market peers for contextual internal linking
  const allStockEntries = getAllStockEntries();
  const currentSector = quote?.sector || quote?.industry;
  let peerEntries = allStockEntries
    .filter(e => e.symbol !== symbol && e.scripCode !== scripCode)
    .filter(e => currentSector && e.sector && e.sector.toLowerCase() === currentSector.toLowerCase())
    .slice(0, 4);

  if (peerEntries.length < 4) {
    const popularSymbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC', 'LT', 'SBIN', 'BHARTIARTL'];
    const popularPeers = allStockEntries
      .filter(e => e.symbol !== symbol && e.scripCode !== scripCode && popularSymbols.includes(e.symbol) && !peerEntries.some(p => p.symbol === e.symbol))
      .slice(0, 4 - peerEntries.length);
    peerEntries = [...peerEntries, ...popularPeers];
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <meta name="robots" content="index, follow">
${AI_STUDIO_REDIRECT_SCRIPT}

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">
  <meta property="og:site_name" content="BSE Nexus">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --brand: #1C362A;
      --brand-hover: #14271E;
      --accent: #059669;
      --text: #0F172A;
      --muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .top-banner {
      background: var(--brand);
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
    }
    .top-brand span { color: #34D399; font-weight: 500; }
    .app-btn {
      background: #059669;
      color: #FFFFFF;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .app-btn:hover { background: #047857; }
    .container {
      max-width: 920px;
      margin: 32px auto;
      padding: 0 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: #ECFDF5;
      color: #065F46;
      letter-spacing: 0.02em;
    }
    .badge.scrip {
      background: #F1F5F9;
      color: #334155;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--brand);
      line-height: 1.25;
      margin-bottom: 20px;
      letter-spacing: -0.02em;
    }
    .quote-summary {
      background: #F8FAFC;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .price-block {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 16px;
    }
    .price-val {
      font-family: 'Outfit', sans-serif;
      font-size: 2.25rem;
      font-weight: 700;
      color: var(--brand);
      letter-spacing: -0.03em;
    }
    .change-pill {
      font-size: 0.875rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .change-pill.pos {
      background: #DCFCE7;
      color: #15803D;
    }
    .change-pill.neg {
      background: #FEE2E2;
      color: #B91C1C;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .stat-k {
      font-size: 0.75rem;
      color: var(--muted);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stat-v {
      font-size: 0.9375rem;
      color: var(--text);
      font-weight: 600;
    }
    .event-box {
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .event-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #92400E;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    .event-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.9375rem;
      color: #78350F;
    }
    .countdown-badge {
      display: inline-block;
      background: #D97706;
      color: #FFFFFF;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      margin-left: 6px;
    }
    .ai-box {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 28px;
    }
    .ai-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    .ai-body {
      color: #14532D;
      font-size: 0.9375rem;
      line-height: 1.6;
    }
    .section {
      margin-top: 32px;
    }
    .section-label {
      font-family: 'Outfit', sans-serif;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--brand);
      letter-spacing: -0.01em;
      margin-bottom: 14px;
    }
    .filings-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .filing-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: #F8FAFC;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
      text-decoration: none;
      color: var(--text);
      transition: all 0.15s ease;
    }
    .filing-item:hover {
      border-color: #059669;
      background: #FFFFFF;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
    }
    .filing-sub {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--brand);
      line-height: 1.4;
      flex: 1;
    }
    .filing-date {
      font-size: 0.8125rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      text-align: left;
    }
    .results-table th {
      background: #F1F5F9;
      color: #334155;
      font-weight: 600;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .results-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .results-table tr:last-child td {
      border-bottom: none;
    }
    .cell-period {
      font-weight: 600;
      color: var(--brand);
      white-space: nowrap;
    }
    .cell-date {
      color: var(--muted);
      white-space: nowrap;
    }
    .status-pill {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .status-declared {
      background: #DCFCE7;
      color: #15803D;
    }
    .status-upcoming {
      background: #FEF3C7;
      color: #B45309;
    }
    .pdf-link {
      display: inline-block;
      margin-top: 4px;
      color: #059669;
      font-weight: 600;
      font-size: 0.8125rem;
      text-decoration: none;
    }
    .pdf-link:hover { text-decoration: underline; }
    .peer-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .peer-pill {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: var(--text);
      transition: all 0.15s ease;
    }
    .peer-pill:hover {
      border-color: #059669;
      background: #F0FDF4;
      transform: translateY(-1px);
    }
    .peer-sym {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 0.875rem;
      color: #065F46;
    }
    .peer-name {
      font-size: 0.75rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .faq-sec {
      margin-top: 28px;
      border-top: 1px solid var(--border);
      padding-top: 24px;
    }
    .faq-item {
      margin-bottom: 16px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
    }
    .faq-q {
      font-family: 'Outfit', sans-serif;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 6px;
    }
    .faq-a {
      font-size: 0.875rem;
      color: #334155;
      line-height: 1.6;
    }
    .bottom-cta {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .terminal-link {
      font-size: 0.875rem;
      font-weight: 600;
      color: #059669;
      text-decoration: none;
    }
    .terminal-link:hover { text-decoration: underline; }
    footer {
      text-align: center;
      margin-top: 32px;
      padding: 20px;
      font-size: 0.8125rem;
      color: var(--muted);
    }
    @media (max-width: 640px) {
      .card { padding: 20px; }
      h1 { font-size: 1.5rem; }
      .price-val { font-size: 1.875rem; }
      .filing-item { flex-direction: column; align-items: flex-start; gap: 6px; }
    }
  </style>
</head>
<body>
  <header class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      BSE Nexus <span>Terminal</span>
    </a>
    <a href="https://bsenexus.in/?tab=watchlists" class="app-btn">
      Open in BSE Nexus App &rarr;
    </a>
  </header>

  <main class="container">
    <article class="card">
      <div class="meta-bar">
        ${scripCode ? `<span class="badge scrip">BSE: ${escapeHtmlText(String(scripCode))}</span>` : ''}
        <span class="badge scrip">${escapeHtmlText(symbol)}</span>
        ${quote?.exchange ? `<span class="badge scrip">${escapeHtmlText(quote.exchange)}</span>` : ''}
        ${quote?.sector ? `<span class="badge">${escapeHtmlText(quote.sector)}</span>` : ''}
      </div>

      <h1>${escapeHtmlText(companyName)} (${escapeHtmlText(scripCode || symbol)}) — Latest Corporate Announcements</h1>

      ${quote ? `
      <div class="quote-summary">
        <div class="price-block">
          <span class="price-val">₹${typeof quote.price === 'number' ? quote.price.toLocaleString('en-IN') : '—'}</span>
          ${changeStr ? `<span class="change-pill ${isPositive ? 'pos' : 'neg'}">${escapeHtmlText(changeStr)}</span>` : ''}
        </div>
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-k">Market Cap</span>
            <span class="stat-v">${escapeHtmlText(marketCapStr)}</span>
          </div>
          ${quote.peRatio ? `
          <div class="stat-item">
            <span class="stat-k">P/E Ratio</span>
            <span class="stat-v">${Number(quote.peRatio).toFixed(2)}</span>
          </div>
          ` : ''}
          ${quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow ? `
          <div class="stat-item">
            <span class="stat-k">52W Range</span>
            <span class="stat-v">₹${quote.fiftyTwoWeekLow} – ₹${quote.fiftyTwoWeekHigh}</span>
          </div>
          ` : ''}
          ${quote.sector || quote.industry ? `
          <div class="stat-item">
            <span class="stat-k">Sector / Industry</span>
            <span class="stat-v">${escapeHtmlText(quote.sector || quote.industry || '')}</span>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${upcomingEvent ? `
      <section class="section">
        <h2 class="section-label">Board Meeting Intimations</h2>
        <div class="event-box">
          <div class="event-title">📅 Scheduled Board Meeting &amp; Agenda</div>
          <div class="event-grid">
            <div><strong>Meeting Date:</strong> ${escapeHtmlText(upcomingEvent.meetingDate || 'Announced')}</div>
            ${upcomingEvent.purpose ? `<div><strong>Agenda / Purpose:</strong> ${escapeHtmlText(upcomingEvent.purpose)}</div>` : ''}
            ${upcomingEvent.countdownDays !== undefined ? `<div><strong>Timeline:</strong> <span class="countdown-badge">${upcomingEvent.countdownDays === 0 ? 'Today' : (upcomingEvent.countdownDays === 1 ? 'Tomorrow' : `In ${upcomingEvent.countdownDays} days`)}</span></div>` : ''}
          </div>
        </div>
      </section>
      ` : ''}

      ${aiSnapshot ? `
      <div class="ai-box">
        <div class="ai-title">⚡ AI Corporate Intelligence Snapshot</div>
        <div class="ai-body">${escapeHtmlText(aiSnapshot)}</div>
      </div>
      ` : ''}

      ${recentFilings.length > 0 ? `
      <section class="section">
        <h2 class="section-label">Corporate Actions &amp; Regulatory Filings</h2>
        <div class="filings-list">
          ${recentFilings.slice(0, 20).map((f: any) => {
            const fId = f.id || f.newsId || '';
            const fSub = f.subject || 'BSE Corporate Announcement';
            const fDate = f.bseTime || (f.timestamp ? new Date(f.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent');
            return `<a href="/announcement/${escapeHtmlAttr(encodeURIComponent(fId))}" class="filing-item">
              <span class="filing-sub">${escapeHtmlText(fSub)}</span>
              <time class="filing-date">📅 ${escapeHtmlText(fDate)}</time>
            </a>`;
          }).join('\n')}
        </div>
      </section>
      ` : ''}

      ${quarterlyResults.length > 0 ? `
      <section class="section">
        <h2 class="section-label">Financial Results (Quarterly &amp; Annual)</h2>
        <div class="table-wrap">
          <table class="results-table">
            <thead>
              <tr>
                <th>Quarter / Period</th>
                <th>Meeting / Outcome Date</th>
                <th>Status</th>
                <th>Filing Details</th>
              </tr>
            </thead>
            <tbody>
              ${quarterlyResults.slice(0, 12).map((q: any) => {
                const period = q.periodOrMeeting || q.quarterKey || 'Quarter Result';
                const date = q.declarationDate || q.meetingDate || '—';
                const status = q.status || (q.isOutcome ? 'Declared' : 'Scheduled');
                const sub = q.subject || q.details || 'Financial Results';
                const pdf = q.pdfLink;
                return `<tr>
                  <td class="cell-period">${escapeHtmlText(period)}</td>
                  <td class="cell-date">${escapeHtmlText(date)}</td>
                  <td><span class="status-pill ${String(status).toLowerCase().includes('declared') ? 'status-declared' : 'status-upcoming'}">${escapeHtmlText(status)}</span></td>
                  <td>
                    ${escapeHtmlText(sub)}
                    ${pdf ? `<br><a href="${escapeHtmlAttr(pdf)}" target="_blank" rel="noopener noreferrer" class="pdf-link">📄 View ${escapeHtmlText(period)} Results PDF &nearr;</a>` : ''}
                  </td>
                </tr>`;
              }).join('\n')}
            </tbody>
          </table>
        </div>
      </section>
      ` : ''}

      ${peerEntries.length > 0 ? `
      <section class="section">
        <h2 class="section-label">Track Related Peer Equities</h2>
        <div class="peer-grid">
          ${peerEntries.map((p: any) => `
            <a href="/company/${escapeHtmlAttr(encodeURIComponent(p.symbol))}" class="peer-pill">
              <span class="peer-sym">${escapeHtmlText(p.symbol)}</span>
              <span class="peer-name">Track ${escapeHtmlText(p.name)} Filings &rarr;</span>
            </a>
          `).join('\n')}
        </div>
      </section>
      ` : ''}

      <section class="section">
        <h2 class="section-label">Related Research Guides &amp; Regulatory Playbooks</h2>
        <div class="peer-grid">
          <a href="/guides/sebi-lodr-regulation-30" class="peer-pill">
            <span class="peer-sym">SEBI LODR Regulation 30</span>
            <span class="peer-name">Material Disclosures, Timelines &amp; Filing Rules &rarr;</span>
          </a>
          <a href="/guides/bse-quarterly-results-calendar-guide" class="peer-pill">
            <span class="peer-sym">Results Calendar Guide</span>
            <span class="peer-name">Earnings Dates, Board Notices &amp; LODR Reg 33 &rarr;</span>
          </a>
          <a href="/guides/bse-shareholding-pattern-explained" class="peer-pill">
            <span class="peer-sym">Shareholding Patterns</span>
            <span class="peer-name">Promoter Staking, Pledging &amp; FII/DII Reg 31 &rarr;</span>
          </a>
          <a href="/guides/insider-trading-pit-regulations" class="peer-pill">
            <span class="peer-sym">Insider Trading &amp; PIT</span>
            <span class="peer-name">Trading Window Closures &amp; Promoter Filings &rarr;</span>
          </a>
        </div>
      </section>

      <section class="section faq-sec">
        <h2 class="section-label">Frequently Asked Questions about ${escapeHtmlText(companyName)} BSE Disclosures</h2>
        ${faqItems.map(item => `
        <div class="faq-item">
          <h3 class="faq-q">${escapeHtmlText(item.q)}</h3>
          <p class="faq-a">${escapeHtmlText(item.a)}</p>
        </div>`).join('\n')}
      </section>

      <div class="bottom-cta">
        <a href="https://bsenexus.in/?tab=announcements" class="terminal-link">
          Track ${escapeHtmlText(companyName)} Announcements on BSE Nexus Live Terminal &rarr;
        </a>
      </div>
    </article>

    <footer>
      BSE Nexus Financial Intelligence &middot; Real-time regulatory filings, board meetings &amp; quarterly results direct from BSE India public feeds.
    </footer>
  </main>
</body>
</html>`;
}

function renderCompany404Page(symbol: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Company Not Found | BSE Nexus</title>
  <meta name="robots" content="noindex, follow">
${AI_STUDIO_REDIRECT_SCRIPT}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      background: #F8FAFC;
      color: #0F172A;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 40px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      color: #1C362A;
      margin: 0 0 12px 0;
    }
    p {
      color: #64748B;
      font-size: 0.9375rem;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background: #1C362A;
      color: #FFFFFF;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover { background: #14271E; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Company Not Found</h1>
    <p>We could not find listed company details for ${symbol ? `"${escapeHtmlText(symbol)}"` : 'the requested stock'}. Check the stock symbol or browse live market watchlists in the app.</p>
    <a href="https://bsenexus.in/?tab=watchlists" class="btn">Open in BSE Nexus App &rarr;</a>
  </div>
</body>
</html>`;
}

function renderAnnouncement404Page(isBatchTest: boolean = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Announcement Not Found | BSE Nexus</title>
  <meta name="robots" content="${isBatchTest ? 'noindex, nofollow' : 'noindex, follow'}">
${AI_STUDIO_REDIRECT_SCRIPT}
  <style>
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F8FAFC;
      color: #0F172A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    }
    h1 { font-size: 1.5rem; margin-bottom: 12px; color: #1C362A; }
    p { font-size: 0.9375rem; color: #64748B; margin-bottom: 24px; line-height: 1.5; }
    .btn {
      display: inline-block;
      background: #1C362A;
      color: #34D399;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover { background: #14271E; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Announcement Not Found</h1>
    <p>The requested BSE corporate announcement or disclosure could not be located or may have expired.</p>
    <a href="https://bsenexus.in/?tab=announcements" class="btn">Open in BSE Nexus App &rarr;</a>
  </div>
</body>
</html>`;
}

export function renderFaqPage(): string {
  const pageTitle = "BSE Corporate Announcements & Disclosures FAQ | BSE Nexus";
  const canonicalUrl = "https://bsenexus.in/faq";
  const description = "Answers to top questions about BSE corporate filings, board meeting intimations, quarterly financial results, SEBI LODR Regulation 30, and live alert feeds.";

  const faqs = [
    {
      q: "How to get BSE corporate announcements before market opens?",
      a: "BSE-listed companies frequently submit market-sensitive announcements, board meeting outcomes, and quarterly reports overnight or early in the morning between 6:00 AM and 8:45 AM IST. BSE Nexus continuously polls BSE public disclosure feeds every 15 seconds 24 hours a day. By enabling instant Telegram alerts on BSE Nexus, investors and traders receive push notifications with AI-extracted highlights directly on their phones before the 9:00 AM pre-open market session begins."
    },
    {
      q: "Where to find company board meeting outcome on BSE?",
      a: "Under Regulation 30 of the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015, listed entities are legally mandated to disclose board meeting outcomes (such as dividends, bonus issues, rights issues, capital expenditure, and quarterly financial statements) within 30 minutes of the closure of the board meeting. On BSE Nexus, you can view real-time board outcomes in the Live Announcements stream or click on any individual stock (e.g. /company/RELIANCE) to review scheduled intimations and historical meeting outcomes."
    },
    {
      q: "How to check quarterly results submission time for BSE stocks?",
      a: "As per Regulation 33 of SEBI LODR, companies must submit un-audited quarterly financial results (Q1, Q2, Q3) within 45 days of the quarter end, and audited annual results (Q4/FY) within 60 days of the financial year end. Companies file an advance intimation at least 5 working days prior to the meeting. The BSE Nexus Earnings Calendar compiles all scheduled board meeting dates and provides side-by-side YoY (Year-over-Year) and QoQ (Quarter-over-Quarter) revenue, operating profit, and net profit comparisons."
    },
    {
      q: "Difference between NSE and BSE corporate disclosures?",
      a: "While dual-listed equities (such as Nifty 50 constituents) file disclosures simultaneously to both exchanges, there are over 1,500+ small-cap, micro-cap, SME, and exclusive equities listed solely on BSE. BSE disclosure feeds typically publish raw XBRL data packages, financial PDFs, and investor presentations with microsecond latency. BSE Nexus processes native BSE announcements to ensure comprehensive market coverage."
    },
    {
      q: "How to track promoter pledge and insider trading alerts online?",
      a: "Promoter shareholding changes, pledges, and insider dealings are governed by the SEBI (Prohibition of Insider Trading) Regulations and SEBI (Substantial Acquisition of Shares and Takeovers) Regulations (SAST Reg 29 & 31). BSE Nexus automatically flags corporate governance intimations, promoter transactions, and acquisition disclosures with HIGH priority badges and instant Telegram dispatches so you never miss insider movements."
    },
    {
      q: "Best API or alert tracker for BSE corporate announcements?",
      a: "BSE Nexus provides an independent, low-latency financial intelligence terminal featuring real-time automated 15s BSE polling, neural Gemini AI metric extraction, custom watchlists, Telegram bot webhooks, and embeddable widgets. You can track all corporate announcements for free without requiring custom programming or expensive financial terminals."
    }
  ];

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": "https://bsenexus.in/faq#faq",
        "url": canonicalUrl,
        "name": pageTitle,
        "description": description,
        "mainEntity": faqs.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.a
          }
        }))
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "BSE Nexus", "item": "https://bsenexus.in/" },
          { "@type": "ListItem", "position": 2, "name": "FAQ", "item": canonicalUrl }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <meta name="robots" content="index, follow">
${AI_STUDIO_REDIRECT_SCRIPT}

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">
  <meta property="og:site_name" content="BSE Nexus">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --brand: #1C362A;
      --brand-hover: #14271E;
      --accent: #059669;
      --accent-light: #ECFDF5;
      --text: #0F172A;
      --muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }
    .top-banner {
      background: var(--brand);
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
    }
    .top-brand span { color: #34D399; font-weight: 500; }
    .app-btn {
      background: #059669;
      color: #FFFFFF;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .app-btn:hover { background: #047857; }
    .container {
      max-width: 860px;
      margin: 32px auto 60px auto;
      padding: 0 20px;
    }
    .hero {
      text-align: left;
      margin-bottom: 32px;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: #ECFDF5;
      color: #065F46;
      margin-bottom: 12px;
      letter-spacing: 0.02em;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.125rem;
      font-weight: 700;
      color: var(--brand);
      line-height: 1.25;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1.0625rem;
      color: var(--muted);
      line-height: 1.5;
    }
    .faq-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .faq-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px 28px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
    }
    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 12px;
      line-height: 1.35;
    }
    .faq-card p {
      font-size: 0.9375rem;
      color: #334155;
      line-height: 1.7;
    }
    .cta-card {
      margin-top: 36px;
      background: linear-gradient(135deg, #1C362A 0%, #14271E 100%);
      color: #FFFFFF;
      border-radius: 16px;
      padding: 32px;
      text-align: left;
    }
    .cta-card h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .cta-card p {
      font-size: 0.9375rem;
      color: #E2E8F0;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .cta-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .btn-white {
      background: #FFFFFF;
      color: #1C362A;
      font-weight: 700;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
    }
    .btn-outline {
      background: rgba(255, 255, 255, 0.1);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-weight: 600;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
    }
    footer {
      text-align: center;
      margin-top: 40px;
      font-size: 0.8125rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <header class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      BSE Nexus <span>Terminal</span>
    </a>
    <a href="https://bsenexus.in/?tab=announcements" class="app-btn">
      Launch Live App &rarr;
    </a>
  </header>

  <main class="container">
    <div class="hero">
      <span class="badge">KNOWLEDGE &amp; RESEARCH</span>
      <h1>BSE Corporate Announcements &amp; Stock Disclosures — Frequently Asked Questions</h1>
      <p class="subtitle">Complete technical guide to tracking Bombay Stock Exchange regulatory filings, board meeting outcomes, quarterly earnings, and SEBI compliance rules.</p>
    </div>

    <div class="faq-grid">
      ${faqs.map(item => `
        <article class="faq-card">
          <h2>${escapeHtmlText(item.q)}</h2>
          <p>${escapeHtmlText(item.a)}</p>
        </article>
      `).join('\n')}
    </div>

    <div class="cta-card">
      <h3>Ready to track BSE announcements in real time?</h3>
      <p>Launch the free BSE Nexus live terminal, set up custom watchlists, and get instant Telegram alerts for every corporate disclosure.</p>
      <div class="cta-btns">
        <a href="https://bsenexus.in/?tab=announcements" class="btn-white">Open Live Terminal &rarr;</a>
        <a href="https://bsenexus.in/?tab=results-calendar" class="btn-outline">Earnings Calendar</a>
        <a href="https://bsenexus.in/?tab=guides" class="btn-outline">Market Guides</a>
      </div>
    </div>

    <footer>
      <div>&copy; ${new Date().getFullYear()} BSE Nexus &middot; Real-time BSE corporate filings intelligence and algorithmic disclosure tracking.</div>
      <div style="margin-top: 10px;">
        <a href="https://bsenexus.in/">Home</a> &middot;
        <a href="https://bsenexus.in/about">About</a> &middot;
        <a href="https://bsenexus.in/contact">Contact</a> &middot;
        <a href="https://bsenexus.in/disclaimer">Disclaimer</a> &middot;
        <a href="https://bsenexus.in/privacy-policy">Privacy Policy</a> &middot;
        <a href="https://bsenexus.in/terms">Terms</a> &middot;
        <a href="https://bsenexus.in/companies">Companies</a> &middot;
        <a href="https://bsenexus.in/guides">Guides</a> &middot;
        <a href="https://bsenexus.in/sitemap.xml" target="_blank">Sitemap</a>
      </div>
    </footer>
  </main>
</body>
</html>`;
}

export function renderPricingPage(): string {
  const pageTitle = "Pricing & Plans — Pro at ₹199/mo | BSE Nexus";
  const canonicalUrl = "https://bsenexus.in/pricing";
  const description = "BSE Nexus Pro at ₹199/month: 1st week free, no card required. Then a one-time ₹199 payment for 30 days via Cashfree. Official BSE filing intelligence, AI summaries, Telegram alerts.";

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": "https://bsenexus.in/pricing#product",
        "name": "BSE Nexus Financial Intelligence Terminal",
        "description": description,
        "image": "https://bsenexus.in/og-image.png",
        "brand": {
          "@type": "Brand",
          "name": "BSE Nexus"
        },
        "offers": [
          {
            "@type": "Offer",
            "name": "Community Free",
            "price": "0",
            "priceCurrency": "INR",
            "priceValidUntil": "2027-12-31",
            "availability": "https://schema.org/InStock",
            "url": canonicalUrl,
            "description": "Forever free access to real-time BSE filings, standard Gemini AI summaries, and custom watchlists."
          },
          {
            "@type": "Offer",
            "name": "Pro Intelligence",
            "price": "199",
            "priceCurrency": "INR",
            "priceValidUntil": "2027-12-31",
            "availability": "https://schema.org/InStock",
            "url": canonicalUrl,
            "description": "1st week free (no card required), then ₹199 for 30 days via one-time Cashfree payment. Priority AI analysis, unlimited watchlists, and Telegram broadcasts."
          }
        ]
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "BSE Nexus", "item": "https://bsenexus.in/" },
          { "@type": "ListItem", "position": 2, "name": "Pricing", "item": canonicalUrl }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <meta name="robots" content="index, follow">
${AI_STUDIO_REDIRECT_SCRIPT}

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">
  <meta property="og:site_name" content="BSE Nexus">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --brand: #1C362A;
      --accent: #059669;
      --accent-light: #ECFDF5;
      --text: #0F172A;
      --muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }
    .top-banner {
      background: var(--brand);
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
    }
    .top-brand span { color: #34D399; font-weight: 500; }
    .nav-links { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: #E2E8F0; text-decoration: none; font-size: 0.8125rem; font-weight: 600; }
    .nav-link:hover, .nav-link.active { color: #34D399; }
    .app-btn {
      background: #059669;
      color: #FFFFFF;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .app-btn:hover { background: #047857; }
    .container {
      max-width: 960px;
      margin: 36px auto 60px auto;
      padding: 0 20px;
    }
    .hero {
      text-align: center;
      margin-bottom: 40px;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      margin-bottom: 14px;
      letter-spacing: 0.04em;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.25rem;
      font-weight: 800;
      color: var(--brand);
      line-height: 1.2;
      letter-spacing: -0.025em;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1.0625rem;
      color: var(--muted);
      line-height: 1.55;
      max-width: 680px;
      margin: 0 auto;
    }
    .plans-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 48px;
    }
    .plan-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      position: relative;
    }
    .plan-card.pro {
      border: 2px solid #059669;
      box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.15);
    }
    .card-banner {
      position: absolute;
      top: 0;
      right: 0;
      background: #059669;
      color: #FFFFFF;
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      padding: 4px 12px;
      border-bottom-left-radius: 12px;
      text-transform: uppercase;
    }
    .plan-header { margin-bottom: 20px; }
    h2.plan-name {
      font-family: 'Outfit', sans-serif;
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 4px;
    }
    .plan-desc { font-size: 0.8125rem; color: var(--muted); }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 16px 0 24px 0;
    }
    .price-strike {
      font-size: 1.25rem;
      text-decoration: line-through;
      color: #94A3B8;
      font-weight: 700;
    }
    .price-val {
      font-family: 'Outfit', monospace;
      font-size: 2.75rem;
      font-weight: 800;
      color: var(--brand);
      line-height: 1;
    }
    .price-val.highlight { color: #059669; }
    .price-period { font-size: 0.8125rem; color: var(--muted); font-weight: 600; }
    .feature-list {
      list-style: none;
      margin-bottom: 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.875rem;
      color: #334155;
    }
    .check-icon {
      color: #059669;
      font-weight: 800;
      flex-shrink: 0;
      line-height: 1.2;
    }
    .card-btn {
      display: block;
      text-align: center;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn-sec {
      background: #F1F5F9;
      color: var(--brand);
      border: 1px solid var(--border);
    }
    .btn-sec:hover { background: #E2E8F0; }
    .btn-pri {
      background: #059669;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }
    .btn-pri:hover { background: #047857; }
    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--brand);
      text-align: center;
      margin-bottom: 24px;
    }
    .guarantees-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 48px;
    }
    .guarantee-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
    }
    .guarantee-card h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 6px;
    }
    .guarantee-card p { font-size: 0.8125rem; color: var(--muted); line-height: 1.5; }
    .faq-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 48px;
    }
    .faq-item {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 24px;
    }
    .faq-item h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 8px;
    }
    .faq-item p { font-size: 0.875rem; color: #475569; line-height: 1.6; }
    footer {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 0.8125rem;
      color: var(--muted);
    }
    @media (max-width: 768px) {
      .plans-grid { grid-template-columns: 1fr; }
      .guarantees-grid { grid-template-columns: 1fr; }
      h1 { font-size: 1.75rem; }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>
  <header class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      BSE Nexus <span>Terminal</span>
    </a>
    <nav class="nav-links">
      <a href="https://bsenexus.in/pricing" class="nav-link active">Pricing</a>
      <a href="https://bsenexus.in/guides" class="nav-link">Market Guides</a>
      <a href="https://bsenexus.in/faq" class="nav-link">FAQ</a>
    </nav>
    <a href="https://bsenexus.in/?tab=announcements" class="app-btn">
      Launch Live Terminal &rarr;
    </a>
  </header>

  <main class="container">
    <div class="hero">
      <span class="badge">LAUNCH SPECIAL &middot; 100% FREE ACCESS</span>
      <h1>Transparent Pricing — 100% Free During Early Access Launch</h1>
      <p class="subtitle">Institutional speed, real-time BSE announcements, and neural Gemini AI financial breakdowns accessible to every Indian equity investor. No credit card required.</p>
    </div>

    <div class="plans-grid">
      <!-- Community Free Tier -->
      <div class="plan-card">
        <div>
          <div class="plan-header">
            <h2 class="plan-name">Community Free</h2>
            <p class="plan-desc">For retail traders &amp; individual investors</p>
          </div>

          <div class="price-row">
            <span class="price-val">₹0</span>
            <span class="price-period">/ month (Forever Free)</span>
          </div>

          <ul class="feature-list">
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Real-time BSE Announcements (15s polling cycle)</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Full coverage across all 5,000+ BSE Equities</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Standard Gemini AI Financial Summaries</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Custom Ticker Watchlists</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Personal Telegram Alert connection</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Board Meeting &amp; Earnings Calendar</span>
            </li>
          </ul>
        </div>

        <a href="https://bsenexus.in/?tab=announcements" class="card-btn btn-sec">
          Launch Terminal (Free)
        </a>
      </div>

      <!-- Pro Intelligence Tier -->
      <div class="plan-card pro">
        <div class="card-banner">Launch Offer &middot; 60% Off</div>
        <div>
          <div class="plan-header">
            <h2 class="plan-name">Pro Intelligence</h2>
            <p class="plan-desc">For serious traders, research desks &amp; Telegram channels</p>
          </div>

          <div class="price-row">
            <span class="price-strike">₹499</span>
            <span class="price-val highlight">₹199</span>
            <span class="price-period">/mo &middot; 1st week free, then ₹199/mo</span>
          </div>

          <ul class="feature-list">
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <strong>Everything in Free, plus:</strong>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Unlimited Watchlists &amp; Priority Ticker Groups</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Broadcast to Personal &amp; Channel Telegram</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Unlimited High-Priority Gemini AI Financial Extraction</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Filter &amp; Mute Routine Administrative Filings</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>Export Watchlists &amp; Financial Summaries (CSV / JSON)</span>
            </li>
            <li class="feature-item">
              <span class="check-icon">&#10003;</span>
              <span>1-Week (7-Day) Google Sign-in Free Pro Trial</span>
            </li>
          </ul>
        </div>

        <a href="https://bsenexus.in/?tab=announcements&action=upgrade" class="card-btn btn-pri">
          Start 1-Week Free Trial — Then ₹199/mo
        </a>
      </div>
    </div>

    <h2 class="section-title">Zero-Risk Guarantee &amp; Operational Trust</h2>
    <div class="guarantees-grid">
      <div class="guarantee-card">
        <h3>No Card Needed for Trial</h3>
        <p>Start your 1-week free Pro trial with Google sign-in — zero financial credentials on file until you choose to pay.</p>
      </div>
      <div class="guarantee-card">
        <h3>BSE &amp; SEBI Compliant</h3>
        <p>Exchange feeds parsed according strictly to SEBI LODR Regulation 30 &amp; 33 disclosure frameworks.</p>
      </div>
      <div class="guarantee-card">
        <h3>7-Day Money-Back Policy</h3>
        <p>Paid Pro packs are covered by our 7-day refund guarantee — if Pro is not for you, you get your ₹199 back.</p>
      </div>
    </div>

    <h2 class="section-title">Frequently Asked Questions About Pricing</h2>
    <div class="faq-list">
      <article class="faq-item">
        <h3>How does the free trial work?</h3>
        <p>You get 1 week of Pro free with Google sign-in — no card required. After the trial, Pro continues at ₹199 for 30 days via a one-time Cashfree payment.</p>
      </article>
      <article class="faq-item">
        <h3>Will I be automatically billed?</h3>
        <p>No. Every Pro payment is a one-time charge via Cashfree — there is no auto-debit. Automatic renewal is coming soon; until then you renew manually before expiry.</p>
      </article>
      <article class="faq-item">
        <h3>Can I connect Telegram alerts for my group or channel?</h3>
        <p>Yes. With Pro intelligence, you can link your Telegram bot token and broadcast real-time corporate filing highlights directly to personal chats or public research channels.</p>
      </article>
    </div>

    <footer>
      <div>&copy; ${new Date().getFullYear()} BSE Nexus &middot; Real-time BSE corporate announcements intelligence, algorithmic feeds, and transparent pricing.</div>
      <div style="margin-top: 10px;">
        <a href="https://bsenexus.in/">Home</a> &middot;
        <a href="https://bsenexus.in/about">About</a> &middot;
        <a href="https://bsenexus.in/contact">Contact</a> &middot;
        <a href="https://bsenexus.in/disclaimer">Disclaimer</a> &middot;
        <a href="https://bsenexus.in/privacy-policy">Privacy Policy</a> &middot;
        <a href="https://bsenexus.in/terms">Terms</a> &middot;
        <a href="https://bsenexus.in/companies">Companies</a> &middot;
        <a href="https://bsenexus.in/guides">Guides</a> &middot;
        <a href="https://bsenexus.in/sitemap.xml" target="_blank">Sitemap</a>
      </div>
    </footer>
  </main>
</body>
</html>`;
}

export function renderGuidesIndexPage(): string {
  const pageTitle = "Indian Equity Research Guides & Market Intelligence | BSE Nexus";
  const canonicalUrl = "https://bsenexus.in/guides";
  const description = "Practical guides and research insights for Indian stock market investors covering BSE filings, corporate actions, SEBI LODR disclosures, and equity analytics.";

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://bsenexus.in/guides#collection",
        "url": canonicalUrl,
        "name": pageTitle,
        "description": description,
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": MARKET_GUIDES.map((g, idx) => ({
            "@type": "ListItem",
            "position": idx + 1,
            "url": `https://bsenexus.in/guides/${g.slug || g.id}`,
            "name": g.title
          }))
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "BSE Nexus", "item": "https://bsenexus.in/" },
          { "@type": "ListItem", "position": 2, "name": "Market Guides", "item": canonicalUrl }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <meta name="robots" content="index, follow">
${AI_STUDIO_REDIRECT_SCRIPT}

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">
  <meta property="og:site_name" content="BSE Nexus">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --brand: #1C362A;
      --accent: #059669;
      --accent-light: #ECFDF5;
      --text: #0F172A;
      --muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }
    .top-banner {
      background: var(--brand);
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
    }
    .top-brand span { color: #34D399; font-weight: 500; }
    .nav-links { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: #E2E8F0; text-decoration: none; font-size: 0.8125rem; font-weight: 600; }
    .nav-link:hover, .nav-link.active { color: #34D399; }
    .app-btn {
      background: #059669;
      color: #FFFFFF;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .app-btn:hover { background: #047857; }
    .container {
      max-width: 1040px;
      margin: 36px auto 60px auto;
      padding: 0 20px;
    }
    .hero {
      text-align: center;
      margin-bottom: 40px;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      margin-bottom: 14px;
      letter-spacing: 0.04em;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.25rem;
      font-weight: 800;
      color: var(--brand);
      line-height: 1.2;
      letter-spacing: -0.025em;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 1.0625rem;
      color: var(--muted);
      line-height: 1.55;
      max-width: 720px;
      margin: 0 auto;
    }
    .guides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 24px;
      margin-bottom: 48px;
    }
    .guide-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .guide-card:hover {
      transform: translateY(-2px);
      border-color: #059669;
    }
    .card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .category-pill {
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .read-time { font-size: 0.75rem; color: var(--muted); font-family: monospace; }
    h2.guide-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.1875rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 10px;
      line-height: 1.35;
    }
    .guide-title a { color: inherit; text-decoration: none; }
    .guide-title a:hover { color: #059669; }
    .guide-excerpt {
      font-size: 0.84375rem;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
      padding-top: 14px;
      font-size: 0.75rem;
      color: var(--muted);
    }
    .author-info { font-weight: 600; color: #334155; }
    .read-link {
      font-weight: 700;
      color: #059669;
      text-decoration: none;
    }
    .read-link:hover { text-decoration: underline; }
    .cta-box {
      background: linear-gradient(135deg, #1C362A 0%, #14271E 100%);
      color: #FFFFFF;
      border-radius: 18px;
      padding: 36px;
      text-align: center;
      margin-bottom: 48px;
    }
    .cta-box h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.625rem;
      font-weight: 700;
      margin-bottom: 10px;
      color: #FFFFFF;
    }
    .cta-box p {
      font-size: 0.9375rem;
      color: #E2E8F0;
      max-width: 620px;
      margin: 0 auto 20px auto;
      line-height: 1.6;
    }
    .cta-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-white {
      background: #FFFFFF;
      color: #1C362A;
      font-weight: 700;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
    }
    .btn-outline {
      background: rgba(255, 255, 255, 0.1);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-weight: 600;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
    }
    footer {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 0.8125rem;
      color: var(--muted);
    }
    @media (max-width: 640px) {
      h1 { font-size: 1.75rem; }
      .nav-links { display: none; }
      .guides-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      BSE Nexus <span>Terminal</span>
    </a>
    <nav class="nav-links">
      <a href="https://bsenexus.in/pricing" class="nav-link">Pricing</a>
      <a href="https://bsenexus.in/guides" class="nav-link active">Market Guides</a>
      <a href="https://bsenexus.in/faq" class="nav-link">FAQ</a>
    </nav>
    <a href="https://bsenexus.in/?tab=announcements" class="app-btn">
      Launch Live Terminal &rarr;
    </a>
  </header>

  <main class="container">
    <div class="hero">
      <span class="badge">EQUITY RESEARCH &amp; REGULATORY FRAMEWORKS</span>
      <h1>Indian Equity Research Guides &amp; Market Intelligence</h1>
      <p class="subtitle">Practical frameworks, regulatory guides, and earnings analysis models for Dalal Street investors deciphering BSE filings, board meetings, and corporate actions.</p>
    </div>

    <div class="guides-grid">
      ${MARKET_GUIDES.map(guide => `
        <article class="guide-card">
          <div>
            <div class="card-meta">
              <span class="category-pill">${escapeHtmlText(guide.category || 'Research')}</span>
              <span class="read-time">${escapeHtmlText(guide.readTime || '5 min read')}</span>
            </div>
            <h2 class="guide-title">
              <a href="https://bsenexus.in/guides/${escapeHtmlAttr(guide.slug || guide.id)}">
                ${escapeHtmlText(guide.title)}
              </a>
            </h2>
            <p class="guide-excerpt">${escapeHtmlText(guide.summary || guide.excerpt || '')}</p>
          </div>
          <div class="card-footer">
            <span class="author-info">${escapeHtmlText(guide.author?.name || 'BSE Nexus Intelligence Desk')}</span>
            <a href="https://bsenexus.in/guides/${escapeHtmlAttr(guide.slug || guide.id)}" class="read-link">
              Read Guide &rarr;
            </a>
          </div>
        </article>
      `).join('\n')}
    </div>

    <div class="cta-box">
      <h2>Put Research Into Practice With Real-Time Data</h2>
      <p>BSE Nexus polls the exchange every 15 seconds to deliver instant announcement analysis and high-priority Telegram alerts directly to your phone.</p>
      <div class="cta-actions">
        <a href="https://bsenexus.in/?tab=announcements" class="btn-white">Open Live Terminal &rarr;</a>
        <a href="https://bsenexus.in/pricing" class="btn-outline">View Free Launch Access</a>
        <a href="https://bsenexus.in/faq" class="btn-outline">SEBI Disclosures FAQ</a>
      </div>
    </div>

    <footer>
      <div>&copy; ${new Date().getFullYear()} BSE Nexus &middot; Indian Equity Research Guides, SEBI LODR Regulation 30 intelligence, and corporate disclosure analytics.</div>
      <div style="margin-top: 10px;">
        <a href="https://bsenexus.in/">Home</a> &middot;
        <a href="https://bsenexus.in/about">About</a> &middot;
        <a href="https://bsenexus.in/contact">Contact</a> &middot;
        <a href="https://bsenexus.in/disclaimer">Disclaimer</a> &middot;
        <a href="https://bsenexus.in/privacy-policy">Privacy Policy</a> &middot;
        <a href="https://bsenexus.in/terms">Terms</a> &middot;
        <a href="https://bsenexus.in/companies">Companies</a> &middot;
        <a href="https://bsenexus.in/guides">Guides</a> &middot;
        <a href="https://bsenexus.in/sitemap.xml" target="_blank">Sitemap</a>
      </div>
    </footer>
  </main>
</body>
</html>`;
}

export function renderCompaniesDirectoryPage(): string {
  const pageTitle = "BSE Listed Companies — Company Profiles, Results & Filings | BSE Nexus";
  const canonicalUrl = "https://bsenexus.in/companies";
  const description = "Comprehensive directory of India's top 26 BSE listed companies. Access real-time corporate filings, quarterly financial results, SEBI LODR disclosures, and AI analysis.";

  const companiesList = [
    { symbol: "RELIANCE", scripCode: "500325", name: "Reliance Industries Ltd", sector: "Energy & Petrochemicals / Conglomerate", category: "Mega Cap Leader", desc: "India's largest conglomerate spanning energy, retail, telecommunications (Jio), and petrochemicals." },
    { symbol: "TCS", scripCode: "532540", name: "Tata Consultancy Services Ltd", sector: "IT Services & Software", category: "Tech Heavyweight", desc: "Global leader in IT services, digital transformation consulting, and enterprise cloud infrastructure." },
    { symbol: "HDFCBANK", scripCode: "500180", name: "HDFC Bank Ltd", sector: "Private Sector Banking & Finance", category: "Banking Giant", desc: "India's largest private sector bank providing retail, commercial, and digital transaction banking." },
    { symbol: "INFY", scripCode: "500209", name: "Infosys Ltd", sector: "IT Services & Consulting", category: "Tech Heavyweight", desc: "Pioneer in global information technology services, next-gen cloud migration, and enterprise AI." },
    { symbol: "ICICIBANK", scripCode: "532174", name: "ICICI Bank Ltd", sector: "Private Sector Banking & Finance", category: "Banking Giant", desc: "Premier Indian banking institution delivering retail loans, wealth management, and corporate credit." },
    { symbol: "SBIN", scripCode: "500112", name: "State Bank of India", sector: "Public Sector Banking", category: "PSU Banking Leader", desc: "India's flagship public sector commercial bank commanding over 22% domestic deposit market share." },
    { symbol: "BHARTIARTL", scripCode: "532454", name: "Bharti Airtel Ltd", sector: "Telecommunications & Digital", category: "Telecom Leader", desc: "Leading global telecommunications provider with 5G mobile, broadband, and enterprise cloud networks." },
    { symbol: "ITC", scripCode: "500875", name: "ITC Ltd", sector: "Diversified FMCG & Cigarettes", category: "FMCG Heavyweight", desc: "Diversified conglomerate with leadership across branded packaged foods, hotels, paperboards, and agri-business." },
    { symbol: "KOTAKBANK", scripCode: "500247", name: "Kotak Mahindra Bank Ltd", sector: "Private Sector Banking & Finance", category: "Banking & Wealth", desc: "Prominent Indian banking and financial conglomerate spanning commercial lending and asset management." },
    { symbol: "LT", scripCode: "500510", name: "Larsen & Toubro Ltd", sector: "Infrastructure & Heavy Engineering", category: "Capex & Infra Titan", desc: "India's premier multinational engaged in EPC projects, hi-tech manufacturing, defense, and power grids." },
    { symbol: "AXISBANK", scripCode: "532215", name: "Axis Bank Ltd", sector: "Private Sector Banking & Finance", category: "Banking Giant", desc: "Major private sector bank in India delivering corporate lending, retail credit, and digital payment solutions." },
    { symbol: "MARUTI", scripCode: "532500", name: "Maruti Suzuki India Ltd", sector: "Automobile Manufacturing", category: "Auto Champion", desc: "India's undisputed passenger vehicle manufacturer controlling over 40% domestic market share." },
    { symbol: "TITAN", scripCode: "500114", name: "Titan Company Ltd", sector: "Consumer Goods & Jewellery", category: "Consumer Discretionary", desc: "Tata Group luxury retail powerhouse dominating organized jewellery (Tanishq), watches, and precision eyewear." },
    { symbol: "ASIANPAINT", scripCode: "500820", name: "Asian Paints Ltd", sector: "Paints & Home Improvement", category: "Consumer & Home Decor", desc: "India's largest decorative and industrial paint manufacturer with extensive international presence." },
    { symbol: "HCLTECH", scripCode: "532281", name: "HCL Technologies Ltd", sector: "IT Services & Software Products", category: "Tech Heavyweight", desc: "Global technology enterprise delivering digital engineering, hybrid cloud platforms, and software products." },
    { symbol: "SUNPHARMA", scripCode: "524715", name: "Sun Pharmaceutical Industries Ltd", sector: "Pharmaceuticals & Healthcare", category: "Pharma Champion", desc: "India's largest pharmaceutical corporation and top global specialty generic drug manufacturer." },
    { symbol: "TATAMOTORS", scripCode: "500570", name: "Tata Motors Ltd", sector: "Automotive & Commercial Vehicles", category: "Mobility & EV Pioneer", desc: "Multinational automotive corporation leading Indian electric mobility (EVs), commercial freight, and Jaguar Land Rover." },
    { symbol: "TATASTEEL", scripCode: "500470", name: "Tata Steel Ltd", sector: "Metals & Mining", category: "Metals Leader", desc: "Top global integrated steel manufacturing corporation with crude steel capacity exceeding 35 MTPA." },
    { symbol: "WIPRO", scripCode: "507685", name: "Wipro Ltd", sector: "IT Services & Consulting", category: "IT Major", desc: "Global information technology and enterprise cloud consulting company driving digital workflows." },
    { symbol: "ULTRACEMCO", scripCode: "532538", name: "UltraTech Cement Ltd", sector: "Cement & Building Materials", category: "Materials Champion", desc: "Flagship cement company of Aditya Birla Group and India's largest manufacturer of grey cement." },
    { symbol: "NTPC", scripCode: "532555", name: "NTPC Ltd", sector: "Power Generation & Utilities", category: "Energy & Utilities", desc: "India's largest integrated energy utility generating over 24% of national electricity with rapid green expansion." },
    { symbol: "POWERGRID", scripCode: "532898", name: "Power Grid Corporation of India Ltd", sector: "Power Transmission", category: "Infrastructure Monopoly", desc: "Central Transmission Utility of India wheeling 85% of domestic inter-regional electricity." },
    { symbol: "ONGC", scripCode: "500312", name: "Oil & Natural Gas Corporation Ltd", sector: "Oil & Gas Exploration", category: "Energy & Resources", desc: "India's premier public sector enterprise contributing 71% to domestic crude oil and 84% of natural gas output." },
    { symbol: "COALINDIA", scripCode: "533278", name: "Coal India Ltd", sector: "Mining & Energy Resources", category: "Energy Security Titan", desc: "The world's largest coal-producing corporation supplying key fuel feedstock to Indian thermal power generation." },
    { symbol: "BAJFINANCE", scripCode: "500034", name: "Bajaj Finance Ltd", sector: "Non-Banking Financials (NBFC)", category: "Consumer Finance Star", desc: "India's largest diversified NBFC specializing in consumer financing, MSME loans, and digital credit cards." },
    { symbol: "TRENT", scripCode: "500251", name: "Trent Ltd", sector: "Retail & Fashion Apparel", category: "Fast Fashion Powerhouse", desc: "Fast-growing Tata Group retail powerhouse operating leading lifestyle and value chains Westside and Zudio." }
  ];

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://bsenexus.in/companies#directory",
        "url": canonicalUrl,
        "name": pageTitle,
        "description": description,
        "mainEntity": {
          "@type": "ItemList",
          "name": "BSE 26 Listed Heavyweights & Bluechips",
          "numberOfItems": companiesList.length,
          "itemListElement": companiesList.map((c, idx) => ({
            "@type": "ListItem",
            "position": idx + 1,
            "url": `https://bsenexus.in/company/${c.symbol}`,
            "name": `${c.name} (${c.symbol})`
          }))
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "BSE Nexus", "item": "https://bsenexus.in/" },
          { "@type": "ListItem", "position": 2, "name": "Companies Directory", "item": canonicalUrl }
        ]
      }
    ]
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <meta name="robots" content="index, follow">
${AI_STUDIO_REDIRECT_SCRIPT}

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">
  <meta property="og:site_name" content="BSE Nexus">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #0B0F17;
      --card-bg: #111625;
      --brand: #1C362A;
      --accent: #059669;
      --accent-light: #ECFDF5;
      --text: #F8FAFC;
      --muted: #94A3B8;
      --border: #1E293B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .top-banner {
      background: #0F172A;
      color: #FFFFFF;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(8px);
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .top-brand span { color: #10B981; }
    .brand-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: #059669;
      color: white;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
    }
    .nav-links { display: flex; align-items: center; gap: 20px; }
    .nav-link { color: #94A3B8; text-decoration: none; font-size: 0.8125rem; font-weight: 600; transition: color 0.15s; }
    .nav-link:hover, .nav-link.active { color: #10B981; }
    .app-btn {
      background: #059669;
      color: #FFFFFF;
      font-size: 0.8125rem;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .app-btn:hover { background: #047857; }
    .container {
      max-width: 1140px;
      margin: 32px auto 60px auto;
      padding: 0 20px;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      color: var(--muted);
      margin-bottom: 20px;
    }
    .breadcrumbs a { color: var(--muted); text-decoration: none; }
    .breadcrumbs a:hover { color: #10B981; }
    .hero {
      margin-bottom: 36px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.12);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 12px;
      letter-spacing: 0.04em;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.25rem;
      font-weight: 800;
      color: #FFFFFF;
      line-height: 1.2;
      letter-spacing: -0.025em;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 0.95rem;
      color: var(--muted);
      line-height: 1.6;
      max-width: 820px;
    }
    .companies-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .company-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 22px;
      text-decoration: none;
      color: inherit;
      display: grid;
      grid-template-columns: 280px 200px 1fr 90px;
      align-items: center;
      gap: 20px;
      transition: all 0.15s ease;
    }
    .company-card:hover {
      border-color: #059669;
      background: #141C30;
      transform: translateX(4px);
    }
    .comp-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .comp-avatar {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #1E293B;
      border: 1px solid #334155;
      color: #34D399;
      font-family: monospace;
      font-weight: 800;
      font-size: 0.8125rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .comp-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: #FFFFFF;
      line-height: 1.3;
    }
    .comp-sub {
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 2px;
      display: flex;
      gap: 8px;
    }
    .comp-ticker {
      color: #34D399;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.1);
      padding: 1px 5px;
      border-radius: 4px;
    }
    .comp-sector {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #CBD5E1;
    }
    .comp-category {
      font-size: 0.6875rem;
      color: #10B981;
      font-weight: 600;
      margin-top: 2px;
    }
    .comp-desc {
      font-size: 0.8125rem;
      color: var(--muted);
      line-height: 1.5;
    }
    .comp-action {
      text-align: right;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #10B981;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
    }
    .cta-box {
      margin-top: 48px;
      background: linear-gradient(135deg, #064E3B 0%, #0F172A 100%);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 18px;
      padding: 32px 28px;
      text-align: center;
    }
    .cta-box h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 8px;
      color: #FFFFFF;
    }
    .cta-box p {
      font-size: 0.875rem;
      color: #CBD5E1;
      max-width: 640px;
      margin: 0 auto 20px auto;
      line-height: 1.6;
    }
    .cta-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-emerald {
      background: #10B981;
      color: #064E3B;
      font-weight: 800;
      font-size: 0.875rem;
      padding: 10px 22px;
      border-radius: 8px;
      text-decoration: none;
    }
    .btn-emerald:hover { background: #34D399; }
    .btn-outline {
      background: rgba(255, 255, 255, 0.08);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-weight: 600;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
    }
    footer {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 0.8125rem;
      color: var(--muted);
      margin-top: 48px;
    }
    footer a { color: var(--muted); text-decoration: none; margin: 0 8px; }
    footer a:hover { color: #10B981; }
    @media (max-width: 860px) {
      .company-card {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .comp-action { justify-content: flex-start; }
      h1 { font-size: 1.75rem; }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>
  <header class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      <div class="brand-icon">N</div>
      BSE Nexus <span>Companies</span>
    </a>
    <nav class="nav-links">
      <a href="https://bsenexus.in/announcements" class="nav-link">Announcements</a>
      <a href="https://bsenexus.in/results-calendar" class="nav-link">Earnings Calendar</a>
      <a href="https://bsenexus.in/companies" class="nav-link active">Companies</a>
      <a href="https://bsenexus.in/guides" class="nav-link">Guides</a>
      <a href="https://bsenexus.in/pricing" class="nav-link">Pricing</a>
      <a href="https://bsenexus.in/faq" class="nav-link">FAQ</a>
    </nav>
    <a href="https://bsenexus.in/?tab=announcements" class="app-btn">
      Launch Live Terminal &rarr;
    </a>
  </header>

  <main class="container">
    <div class="breadcrumbs">
      <a href="https://bsenexus.in/">Home</a>
      <span>&gt;</span>
      <span>Companies Directory</span>
    </div>

    <div class="hero">
      <span class="badge">🏛️ 26 PREMIER BSE BLUECHIPS &amp; HEAVYWEIGHTS</span>
      <h1>BSE Listed Companies — Profiles, Earnings &amp; Filings</h1>
      <p class="subtitle">Complete company intelligence dossiers for India's 26 leading listed equities. Track real-time Bombay Stock Exchange regulatory disclosures, quarterly financial results, and SEBI LODR corporate actions.</p>
    </div>

    <div class="companies-list">
      ${companiesList.map(c => `
        <a href="https://bsenexus.in/company/${escapeHtmlAttr(c.symbol)}" class="company-card">
          <div class="comp-left">
            <div class="comp-avatar">${escapeHtmlText(c.symbol.substring(0, 3))}</div>
            <div>
              <div class="comp-title">${escapeHtmlText(c.name)}</div>
              <div class="comp-sub">
                <span class="comp-ticker">${escapeHtmlText(c.symbol)}</span>
                <span>BSE: ${escapeHtmlText(c.scripCode)}</span>
              </div>
            </div>
          </div>
          <div>
            <div class="comp-sector">${escapeHtmlText(c.sector)}</div>
            <div class="comp-category">${escapeHtmlText(c.category)}</div>
          </div>
          <div class="comp-desc">${escapeHtmlText(c.desc)}</div>
          <div class="comp-action">
            <span>View &rarr;</span>
          </div>
        </a>
      `).join('\n')}
    </div>

    <div class="cta-box">
      <h2>Continuous Sub-Minute BSE Ingestion for All 26 Heavyweights</h2>
      <p>BSE Nexus monitors BSE announcements every 15 seconds to deliver instant AI metric extraction and instant Telegram alerts directly to your trading desk.</p>
      <div class="cta-actions">
        <a href="https://bsenexus.in/?tab=announcements" class="btn-emerald">Open Live Terminal &rarr;</a>
        <a href="https://bsenexus.in/results-calendar" class="btn-outline">View Earnings Calendar</a>
        <a href="https://bsenexus.in/guides" class="btn-outline">Market Guides</a>
      </div>
    </div>

    <footer>
      <div>&copy; ${new Date().getFullYear()} BSE Nexus &middot; Real-time Indian Equity Intelligence</div>
      <div style="margin-top: 10px;">
        <a href="https://bsenexus.in/">Home</a>
        <a href="https://bsenexus.in/about">About</a>
        <a href="https://bsenexus.in/contact">Contact</a>
        <a href="https://bsenexus.in/disclaimer">Disclaimer</a>
        <a href="https://bsenexus.in/privacy-policy">Privacy Policy</a>
        <a href="https://bsenexus.in/terms">Terms</a>
        <a href="https://bsenexus.in/companies">Companies</a>
        <a href="https://bsenexus.in/guides">Guides</a>
        <a href="https://bsenexus.in/pricing">Pricing</a>
        <a href="https://bsenexus.in/sitemap.xml" target="_blank">Sitemap</a>
      </div>
    </footer>
  </main>
</body>
</html>`;
}

export function renderGeneral404Page(requestedPath: string = ""): string {
  const pageTitle = "404 — Page Not Found | BSE Nexus";
  const canonicalUrl = "https://bsenexus.in/404";
  const description = "The requested page could not be found on BSE Nexus. Return to live corporate announcements, market research guides, or FAQ.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <meta name="robots" content="noindex, follow">
${AI_STUDIO_REDIRECT_SCRIPT}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --brand: #1C362A;
      --accent: #059669;
      --text: #0F172A;
      --muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }
    .top-banner {
      background: var(--brand);
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
    }
    .top-brand span { color: #34D399; font-weight: 500; }
    .center-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      max-width: 480px;
      width: 100%;
      padding: 40px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .err-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: monospace;
      padding: 4px 10px;
      border-radius: 6px;
      background: #FEF2F2;
      color: #991B1B;
      border: 1px solid #FECACA;
      margin-bottom: 16px;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.75rem;
      color: var(--brand);
      margin-bottom: 12px;
      line-height: 1.25;
    }
    p {
      color: var(--muted);
      font-size: 0.9375rem;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    code {
      background: #F1F5F9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #0F172A;
    }
    .btn-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn {
      display: block;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn-pri {
      background: #059669;
      color: #FFFFFF;
    }
    .btn-pri:hover { background: #047857; }
    .btn-sec {
      background: #F1F5F9;
      color: var(--brand);
      border: 1px solid var(--border);
    }
    .btn-sec:hover { background: #E2E8F0; }
    footer {
      text-align: center;
      padding: 20px;
      font-size: 0.8125rem;
      color: var(--muted);
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <header class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      BSE Nexus <span>Terminal</span>
    </a>
    <a href="https://bsenexus.in/?tab=announcements" style="color: #34D399; font-size: 0.8125rem; font-weight: 600; text-decoration: none;">
      Launch Terminal &rarr;
    </a>
  </header>

  <div class="center-container">
    <div class="card">
      <span class="err-badge">ERROR 404</span>
      <h1>Page Not Found</h1>
      <p>The requested page <code>${escapeHtmlText(requestedPath)}</code> could not be found or has been moved.</p>
      
      <div class="btn-stack">
        <a href="https://bsenexus.in/" class="btn btn-pri">Back to Live Terminal</a>
        <a href="https://bsenexus.in/pricing" class="btn btn-sec">View Pricing &amp; Plans</a>
        <a href="https://bsenexus.in/guides" class="btn btn-sec">Explore Market Guides</a>
        <a href="https://bsenexus.in/faq" class="btn btn-sec">SEBI Disclosures FAQ</a>
      </div>
    </div>
  </div>

  <footer>
    <div>&copy; ${new Date().getFullYear()} BSE Nexus &middot; Real-time BSE corporate disclosures &amp; algorithmic market intelligence.</div>
    <div style="margin-top: 10px;">
      <a href="https://bsenexus.in/" style="color: var(--muted); text-decoration: none; margin: 0 6px;">Home</a> &middot;
      <a href="https://bsenexus.in/about" style="color: var(--muted); text-decoration: none; margin: 0 6px;">About</a> &middot;
      <a href="https://bsenexus.in/contact" style="color: var(--muted); text-decoration: none; margin: 0 6px;">Contact</a> &middot;
      <a href="https://bsenexus.in/disclaimer" style="color: var(--muted); text-decoration: none; margin: 0 6px;">Disclaimer</a> &middot;
      <a href="https://bsenexus.in/privacy-policy" style="color: var(--muted); text-decoration: none; margin: 0 6px;">Privacy Policy</a> &middot;
      <a href="https://bsenexus.in/terms" style="color: var(--muted); text-decoration: none; margin: 0 6px;">Terms</a> &middot;
      <a href="https://bsenexus.in/sitemap.xml" target="_blank" style="color: var(--muted); text-decoration: none; margin: 0 6px;">Sitemap</a>
    </div>
  </footer>
</body>
</html>`;
}

function renderTrustPageLayout(options: {
  title: string;
  description: string;
  canonicalUrl: string;
  badge: string;
  heading: string;
  subheading: string;
  breadcrumbs: string;
  contentHtml: string;
  schemaJson?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(options.title)}</title>
  <meta name="description" content="${escapeHtmlAttr(options.description)}">
  <link rel="canonical" href="${escapeHtmlAttr(options.canonicalUrl)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
${AI_STUDIO_REDIRECT_SCRIPT}

  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BSE Nexus">
  <meta property="og:title" content="${escapeHtmlAttr(options.title)}">
  <meta property="og:description" content="${escapeHtmlAttr(options.description)}">
  <meta property="og:url" content="${escapeHtmlAttr(options.canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@bsenexus">
  <meta name="twitter:creator" content="@bsenexus">
  <meta name="twitter:title" content="${escapeHtmlAttr(options.title)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(options.description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #0B0F19;
      --card-bg: #121624;
      --card-inner: #0E1320;
      --brand: #FFFFFF;
      --accent: #10B981;
      --accent-hover: #059669;
      --accent-light: rgba(16, 185, 129, 0.12);
      --text: #F1F5F9;
      --text-muted: #94A3B8;
      --border: #1E293B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
    }
    .top-banner {
      background: rgba(11, 15, 25, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .top-brand span { color: var(--accent); }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-link {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }
    .nav-link:hover { color: #FFFFFF; }
    .app-btn {
      background: var(--accent);
      color: #064E3B;
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .app-btn:hover { background: #34D399; }
    .main-container {
      max-width: 880px;
      margin: 36px auto 60px auto;
      padding: 0 20px;
      flex: 1;
      width: 100%;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 24px;
    }
    .breadcrumbs a { color: var(--text-muted); text-decoration: none; }
    .breadcrumbs a:hover { color: var(--accent); }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      background: var(--accent-light);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 12px;
      letter-spacing: 0.03em;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.25rem;
      font-weight: 800;
      color: #FFFFFF;
      line-height: 1.2;
      letter-spacing: -0.025em;
      margin-bottom: 8px;
    }
    .subheading {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-bottom: 32px;
    }
    .callout-box {
      background: var(--card-bg);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 32px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }
    .callout-box.amber {
      border-color: rgba(245, 158, 11, 0.35);
      background: #14121A;
    }
    .callout-title {
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .callout-title.amber { color: #FBBF24; }
    .callout-text {
      font-size: 1.05rem;
      color: #FFFFFF;
      font-weight: 600;
      line-height: 1.6;
    }
    .callout-text a {
      color: var(--accent);
      text-decoration: underline;
    }
    .content-sec {
      margin-bottom: 28px;
    }
    .content-sec h2, .content-sec h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 12px;
    }
    .content-sec p {
      color: #CBD5E1;
      font-size: 0.9375rem;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .content-sec ul {
      padding-left: 20px;
      color: #CBD5E1;
      font-size: 0.9375rem;
      line-height: 1.7;
      margin-bottom: 16px;
    }
    .content-sec li { margin-bottom: 8px; }
    .grid-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .feature-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .feature-card h4 {
      color: #FFFFFF;
      font-size: 0.9375rem;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .feature-card p {
      color: var(--text-muted);
      font-size: 0.8125rem;
      line-height: 1.5;
      margin: 0;
    }
    .social-links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 12px;
    }
    .social-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--card-inner);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s;
    }
    .social-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .trust-nav {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .trust-nav-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .trust-nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .trust-nav-pill {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.8125rem;
      text-decoration: none;
      transition: all 0.15s;
    }
    .trust-nav-pill:hover, .trust-nav-pill.active {
      border-color: var(--accent);
      color: var(--accent);
    }
    footer {
      background: #0B0F19;
      border-top: 1px solid var(--border);
      padding: 36px 20px 24px 20px;
      margin-top: auto;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
    .footer-content {
      max-width: 880px;
      margin: 0 auto;
      text-align: center;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .footer-links a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }
    .footer-links a:hover { color: var(--accent); }
    .footer-copy {
      margin-bottom: 6px;
    }
    .footer-disc {
      font-size: 0.75rem;
      color: #64748B;
    }
    @media (max-width: 640px) {
      .top-banner { padding: 12px 16px; }
      .nav-links a:not(.app-btn) { display: none; }
      h1 { font-size: 1.75rem; }
      .main-container { margin: 20px auto 40px auto; }
      .callout-box { padding: 18px 20px; }
    }
  </style>

  ${options.schemaJson ? `<script type="application/ld+json">\n${options.schemaJson}\n</script>` : ''}
</head>
<body>
  <nav class="top-banner">
    <a href="https://bsenexus.in/" class="top-brand">
      BSE<span>NEXUS</span>
    </a>
    <div class="nav-links">
      <a href="https://bsenexus.in/" class="nav-link">Home</a>
      <a href="https://bsenexus.in/companies" class="nav-link">Companies</a>
      <a href="https://bsenexus.in/guides" class="nav-link">Guides</a>
      <a href="https://bsenexus.in/?tab=announcements" class="app-btn">Launch Terminal &rarr;</a>
    </div>
  </nav>

  <main class="main-container">
    <div class="breadcrumbs">
      <a href="https://bsenexus.in/">Home</a>
      <span>&rsaquo;</span>
      <span>${escapeHtmlText(options.breadcrumbs)}</span>
    </div>

    <div class="badge">${escapeHtmlText(options.badge)}</div>
    <h1>${escapeHtmlText(options.heading)}</h1>
    <div class="subheading">${escapeHtmlText(options.subheading)}</div>

    ${options.contentHtml}

    <div class="trust-nav">
      <div class="trust-nav-title">Trust &amp; Legal Pages</div>
      <div class="trust-nav-links">
        <a href="https://bsenexus.in/about" class="trust-nav-pill ${options.canonicalUrl.endsWith('/about') ? 'active' : ''}">About Us</a>
        <a href="https://bsenexus.in/contact" class="trust-nav-pill ${options.canonicalUrl.endsWith('/contact') ? 'active' : ''}">Contact</a>
        <a href="https://bsenexus.in/disclaimer" class="trust-nav-pill ${options.canonicalUrl.endsWith('/disclaimer') ? 'active' : ''}">Disclaimer</a>
        <a href="https://bsenexus.in/privacy-policy" class="trust-nav-pill ${options.canonicalUrl.endsWith('/privacy-policy') ? 'active' : ''}">Privacy Policy</a>
        <a href="https://bsenexus.in/terms" class="trust-nav-pill ${options.canonicalUrl.endsWith('/terms') ? 'active' : ''}">Terms of Service</a>
      </div>
    </div>
  </main>

  <footer>
    <div class="footer-content">
      <div class="footer-links">
        <a href="https://bsenexus.in/about">About</a>
        <a href="https://bsenexus.in/contact">Contact</a>
        <a href="https://bsenexus.in/disclaimer">Disclaimer</a>
        <a href="https://bsenexus.in/privacy-policy">Privacy Policy</a>
        <a href="https://bsenexus.in/terms">Terms</a>
        <a href="https://bsenexus.in/companies">Companies</a>
        <a href="https://bsenexus.in/guides">Guides</a>
        <a href="https://bsenexus.in/sitemap.xml" target="_blank" rel="noopener">Sitemap</a>
      </div>
      <p class="footer-copy">&copy; ${new Date().getFullYear()} BSE Nexus. Independent BSE Disclosures Aggregator. Operator: Rahul Dahiya (<a href="mailto:admin@bsenexus.in" style="color: var(--accent); text-decoration: none;">admin@bsenexus.in</a>).</p>
      <p class="footer-disc">BSE Nexus is not affiliated with BSE India Ltd, SEBI, or any exchange; informational use only; not investment advice; verify filings on bseindia.com.</p>
    </div>
  </footer>
</body>
</html>`;
}

function renderAboutPage(): string {
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": "https://bsenexus.in/about#webpage",
    "url": "https://bsenexus.in/about",
    "name": "About BSE Nexus — Independent BSE Corporate Disclosures Aggregator",
    "description": "BSE Nexus is an independent BSE corporate announcement aggregator run by Rahul Dahiya, contact admin@bsenexus.in. One honest paragraph, no hype.",
    "publisher": {
      "@type": "Organization",
      "@id": "https://bsenexus.in/#organization",
      "name": "BSE Nexus",
      "url": "https://bsenexus.in/",
      "founder": {
        "@type": "Person",
        "name": "Rahul Dahiya"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "admin@bsenexus.in",
        "contactType": "customer support"
      }
    }
  }, null, 2);

  const contentHtml = `
    <div class="callout-box">
      <div class="callout-title">✦ Who We Are &amp; What We Do</div>
      <p class="callout-text">
        BSE Nexus is an independent BSE corporate announcement aggregator run by Rahul Dahiya, contact <a href="mailto:admin@bsenexus.in">admin@bsenexus.in</a>.
      </p>
    </div>

    <div class="content-sec">
      <h2>Our Mission &amp; Purpose</h2>
      <p>
        Every trading day, thousands of public listed companies file regulatory disclosures with the Bombay Stock Exchange (BSE India)—including quarterly financial results, SEBI LODR Regulation 30 corporate actions, board meeting intimations, dividend announcements, and auditor disclosures.
      </p>
      <p>
        BSE Nexus was engineered to make these critical exchange filings instantly discoverable, structured, and searchable for independent investors, equity researchers, analysts, and market participants across India.
      </p>
    </div>

    <div class="content-sec">
      <h2>Core Terminal Capabilities</h2>
      <div class="grid-cards">
        <div class="feature-card">
          <h4>⚡ Sub-Minute Filing Ingestion</h4>
          <p>Automated high-frequency background engines indexing BSE regulatory disclosures within seconds of release on the exchange.</p>
        </div>
        <div class="feature-card">
          <h4>🤖 AI Financial YoY/QoQ Summaries</h4>
          <p>Automated revenue and PAT metric extraction from multi-page quarterly earnings filings powered by Gemini AI.</p>
        </div>
        <div class="feature-card">
          <h4>🔔 Custom Watchlists &amp; Telegram Alerts</h4>
          <p>Personalized stock feeds and instant automated Telegram alert dispatches without delay.</p>
        </div>
        <div class="feature-card">
          <h4>📄 1-Click Source PDF Filings</h4>
          <p>Direct verification links to official XBRL and PDF attachments hosted by BSE India.</p>
        </div>
      </div>
    </div>

    <div class="content-sec" style="margin-top: 32px;">
      <h2>Operator &amp; Governance</h2>
      <p>
        BSE Nexus is independently designed, maintained, and operated by <strong>Rahul Dahiya</strong>. For partnerships, developer inquiries, or data feedback, email <a href="mailto:admin@bsenexus.in" style="color: var(--accent);">admin@bsenexus.in</a>.
      </p>
    </div>
  `;

  return renderTrustPageLayout({
    title: "About BSE Nexus — Independent BSE Corporate Disclosures Aggregator",
    description: "BSE Nexus is an independent BSE corporate announcement aggregator run by Rahul Dahiya, contact admin@bsenexus.in. One honest paragraph, no hype.",
    canonicalUrl: "https://bsenexus.in/about",
    badge: "About Us",
    heading: "About BSE Nexus",
    subheading: "Independent real-time corporate announcements indexer for Indian capital markets.",
    breadcrumbs: "About",
    contentHtml,
    schemaJson: schema
  });
}

function renderContactPage(): string {
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": "https://bsenexus.in/contact#webpage",
    "url": "https://bsenexus.in/contact",
    "name": "Contact Us | BSE Nexus",
    "description": "Contact Rahul Dahiya and the BSE Nexus team for support, API inquiries, feedback, and disclosures intelligence at admin@bsenexus.in.",
    "mainEntity": {
      "@type": "Organization",
      "@id": "https://bsenexus.in/#organization",
      "name": "BSE Nexus",
      "founder": {
        "@type": "Person",
        "name": "Rahul Dahiya"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "admin@bsenexus.in",
        "contactType": "customer support"
      },
      "sameAs": [
        "https://x.com/bsenexus",
        "https://instagram.com/bsenexus",
        "https://threads.net/@bsenexus"
      ]
    }
  }, null, 2);

  const contentHtml = `
    <div class="callout-box">
      <div class="callout-title">✉ Direct Support &amp; Administration</div>
      <p class="callout-text">
        Reach operator Rahul Dahiya directly at <a href="mailto:admin@bsenexus.in">admin@bsenexus.in</a>.
      </p>
    </div>

    <div class="content-sec">
      <h2>Get In Touch</h2>
      <p>We are open to user feedback, bug reports, feature suggestions, and equity research collaborations.</p>
      
      <div class="grid-cards">
        <div class="feature-card">
          <h4>Official Email</h4>
          <p style="margin-bottom: 8px;">Direct contact for general inquiries and technical questions.</p>
          <a href="mailto:admin@bsenexus.in" style="color: var(--accent); font-weight: 700; font-family: monospace; font-size: 0.95rem;">admin@bsenexus.in</a>
        </div>
        <div class="feature-card">
          <h4>Platform Operator</h4>
          <p style="margin-bottom: 8px;">Operated and maintained by</p>
          <strong style="color: #FFFFFF; font-size: 0.95rem;">Rahul Dahiya</strong>
        </div>
      </div>
    </div>

    <div class="content-sec" style="margin-top: 32px;">
      <h2>Official Social Channels</h2>
      <p>Follow our verified social handles for platform updates, feature releases, and market commentary:</p>
      <div class="social-links">
        <a href="https://x.com/bsenexus" target="_blank" rel="noopener noreferrer" class="social-btn">
          <span>𝕏</span> <span>X / Twitter (@bsenexus)</span>
        </a>
        <a href="https://instagram.com/bsenexus" target="_blank" rel="noopener noreferrer" class="social-btn">
          <span>📸</span> <span>Instagram (@bsenexus)</span>
        </a>
        <a href="https://threads.net/@bsenexus" target="_blank" rel="noopener noreferrer" class="social-btn">
          <span>🧵</span> <span>Threads (@bsenexus)</span>
        </a>
      </div>
    </div>
  `;

  return renderTrustPageLayout({
    title: "Contact Us | BSE Nexus",
    description: "Contact Rahul Dahiya and the BSE Nexus team for support, API inquiries, feedback, and disclosures intelligence at admin@bsenexus.in.",
    canonicalUrl: "https://bsenexus.in/contact",
    badge: "Contact Information",
    heading: "Contact Rahul Dahiya / BSE Nexus",
    subheading: "We welcome inquiries, feedback, and data suggestions from users and market participants.",
    breadcrumbs: "Contact",
    contentHtml,
    schemaJson: schema
  });
}

function renderDisclaimerPage(): string {
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://bsenexus.in/disclaimer#webpage",
    "url": "https://bsenexus.in/disclaimer",
    "name": "Disclaimer & Entity Clarity | BSE Nexus",
    "description": "BSE Nexus is not affiliated with BSE India Ltd, SEBI, or any exchange; informational use only; not investment advice; verify filings on bseindia.com."
  }, null, 2);

  const contentHtml = `
    <div class="callout-box amber">
      <div class="callout-title amber">⚠ Official Independence &amp; Non-Affiliation Statement</div>
      <p class="callout-text">
        BSE Nexus is not affiliated with BSE India Ltd, SEBI, or any exchange; informational use only; not investment advice; verify filings on <a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer">bseindia.com</a>.
      </p>
    </div>

    <div class="content-sec">
      <h2>1. Informational &amp; Research Purpose Only</h2>
      <p>
        All data, corporate announcements, financial metric summaries, earnings dates, and AI analysis presented on BSE Nexus are provided strictly for informational and educational purposes. Nothing on this website constitutes a recommendation, endorsement, solicitation, or offer to buy or sell securities, derivatives, or financial instruments.
      </p>
    </div>

    <div class="content-sec">
      <h2>2. Not SEBI-Registered Investment Advice</h2>
      <p>
        BSE Nexus and its operator Rahul Dahiya are not registered as investment advisors, research analysts, or portfolio managers under SEBI (Investment Advisers) Regulations, 2013 or SEBI (Research Analysts) Regulations, 2014. Users must consult a qualified SEBI-registered financial advisor before making any investment or trading decisions.
      </p>
    </div>

    <div class="content-sec">
      <h2>3. Mandatory Source Verification</h2>
      <p>
        While our automated systems strive for high precision and ultra-low latency, transmission anomalies, OCR misreadings, or upstream exchange delays may occur. Always cross-verify critical announcements, financial tables, and board resolutions directly on the official exchange website at <a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer" style="color: var(--accent);">bseindia.com</a>.
      </p>
    </div>

    <div class="content-sec">
      <h2>4. Distinct Entity Notice</h2>
      <p>
        BSE Nexus is an independent technology project and has no corporate, commercial, or operational connection with <strong>Nexus Select Trust</strong> (BSE Scrip Code: 543913), BSE Limited (Bombay Stock Exchange), or National Stock Exchange of India (NSE).
      </p>
    </div>
  `;

  return renderTrustPageLayout({
    title: "Disclaimer & Entity Clarity | BSE Nexus",
    description: "BSE Nexus is not affiliated with BSE India Ltd, SEBI, or any exchange; informational use only; not investment advice; verify filings on bseindia.com.",
    canonicalUrl: "https://bsenexus.in/disclaimer",
    badge: "Legal & Regulatory",
    heading: "Disclaimer & Entity Clarity",
    subheading: "Important disclosures on independence, exchange affiliation, and financial advice.",
    breadcrumbs: "Disclaimer",
    contentHtml,
    schemaJson: schema
  });
}

function renderPrivacyPolicyPage(): string {
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://bsenexus.in/privacy-policy#webpage",
    "url": "https://bsenexus.in/privacy-policy",
    "name": "Privacy Policy | BSE Nexus",
    "description": "Read the BSE Nexus privacy policy. Learn how we safeguard your data, preferences, watchlists, and communications."
  }, null, 2);

  const contentHtml = `
    <div class="callout-box">
      <div class="callout-title">🔒 Our Core Privacy Commitment</div>
      <p class="callout-text">
        BSE Nexus does not sell, rent, monetize, or trade your personal data. We collect only what is strictly necessary to provide real-time equity market tools and Telegram alert dispatches.
      </p>
    </div>

    <div class="content-sec">
      <h2>1. Information We Collect</h2>
      <ul>
        <li><strong>Account Details:</strong> When you sign in or create an account, we store your email address and display name for session authentication.</li>
        <li><strong>User Preferences &amp; Watchlists:</strong> Your customized stock tickers, alert priority preferences, and theme choices are stored locally and synced securely with your account.</li>
        <li><strong>Telegram Webhook Credentials:</strong> If you configure private Telegram notifications, your bot token and chat ID are stored strictly for routing alerts to your designated endpoint.</li>
        <li><strong>Technical Telemetry:</strong> Standard non-identifying server logs (IP address, user-agent, response codes) retained temporarily for security auditing, rate limiting, and DDoS defense.</li>
      </ul>
    </div>

    <div class="content-sec">
      <h2>2. How Information Is Used</h2>
      <p>
        We use the information collected exclusively to operate, maintain, and enhance the BSE Nexus terminal, dispatch user-requested alerts, monitor system performance, and prevent fraudulent abuse.
      </p>
    </div>

    <div class="content-sec">
      <h2>3. Cookies &amp; Local Storage</h2>
      <p>
        BSE Nexus uses functional cookies and browser LocalStorage to remember your active tabs, sound alert toggles, filter preferences, and session tokens. We do not use third-party behavioral advertising cookies.
      </p>
    </div>

    <div class="content-sec">
      <h2>4. Data Rights &amp; Deletion</h2>
      <p>
        You may request complete deletion of your account, watchlists, and associated data at any time by emailing <a href="mailto:admin@bsenexus.in" style="color: var(--accent);">admin@bsenexus.in</a> with the subject line "Data Deletion Request".
      </p>
    </div>
  `;

  return renderTrustPageLayout({
    title: "Privacy Policy | BSE Nexus",
    description: "Read the BSE Nexus privacy policy. Learn how we safeguard your data, preferences, watchlists, and communications.",
    canonicalUrl: "https://bsenexus.in/privacy-policy",
    badge: "Privacy & Data Protection",
    heading: "Privacy Policy",
    subheading: "Last updated: September 2026 • Clear, transparent data protection standards.",
    breadcrumbs: "Privacy Policy",
    contentHtml,
    schemaJson: schema
  });
}

function renderTermsPage(): string {
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://bsenexus.in/terms#webpage",
    "url": "https://bsenexus.in/terms",
    "name": "Terms of Service | BSE Nexus",
    "description": "Review the terms and conditions for accessing BSE Nexus live corporate announcements, AI summaries, and alert integrations."
  }, null, 2);

  const contentHtml = `
    <div class="content-sec">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using BSE Nexus (bsenexus.in), you agree to be bound by these Terms of Service. If you do not agree with these terms, please discontinue use of the platform.
      </p>
    </div>

    <div class="content-sec">
      <h2>2. Nature of the Service</h2>
      <p>
        BSE Nexus is an automated information indexing terminal designed to aggregate public disclosures made by listed companies on the Bombay Stock Exchange (BSE India). BSE Nexus is not an exchange, broker, dealer, or financial advisory firm.
      </p>
    </div>

    <div class="content-sec">
      <h2>3. Acceptable Use Policy</h2>
      <p>
        You agree to use BSE Nexus solely for lawful purposes. You shall not attempt to reverse engineer, scrape at abusive frequencies, disrupt server infrastructure, or circumvent rate limits.
      </p>
    </div>

    <div class="content-sec">
      <h2>4. Limitation of Liability</h2>
      <p>
        BSE Nexus, its operator Rahul Dahiya, and affiliates shall not be held liable for any direct, indirect, incidental, or consequential damages resulting from reliance on data, delays in exchange feeds, AI extraction discrepancies, or downtime.
      </p>
    </div>

    <div class="content-sec">
      <h2>5. Contact &amp; Inquiries</h2>
      <p>
        For questions regarding these Terms, contact <a href="mailto:admin@bsenexus.in" style="color: var(--accent);">admin@bsenexus.in</a>.
      </p>
    </div>
  `;

  return renderTrustPageLayout({
    title: "Terms of Service | BSE Nexus",
    description: "Review the terms and conditions for accessing BSE Nexus live corporate announcements, AI summaries, and alert integrations.",
    canonicalUrl: "https://bsenexus.in/terms",
    badge: "Terms of Service",
    heading: "Terms of Service",
    subheading: "Last updated: September 2026 • Terms and conditions for using BSE Nexus.",
    breadcrumbs: "Terms of Service",
    contentHtml,
    schemaJson: schema
  });
}

function renderEmbedWidget(data: {
  symbol?: string;
  scripCode?: string;
  companyName?: string;
  filings: any[];
  theme?: string;
}): string {
  const isDark = data.theme === 'dark';
  const symbol = data.symbol ? data.symbol.toUpperCase() : 'BSE LIVE';
  const scripCode = data.scripCode || '';
  const targetUrl = data.symbol ? `https://bsenexus.in/company/${encodeURIComponent(symbol)}` : 'https://bsenexus.in/';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(symbol)} — BSE Live Announcements Widget</title>
  <style>
    :root {
      --bg: ${isDark ? '#0B0F19' : '#FFFFFF'};
      --card: ${isDark ? '#111827' : '#F8FAFC'};
      --text: ${isDark ? '#F9FAFB' : '#0F172A'};
      --muted: ${isDark ? '#9CA3AF' : '#64748B'};
      --border: ${isDark ? '#1F2937' : '#E2E8F0'};
      --brand: ${isDark ? '#34D399' : '#059669'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      padding: 12px;
    }
    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 8px;
    }
    .widget-title {
      font-weight: 700;
      font-size: 13px;
      color: var(--brand);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10B981;
      display: inline-block;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .widget-scrip {
      font-size: 11px;
      color: var(--muted);
      font-weight: 500;
    }
    .filing-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 230px;
      overflow-y: auto;
    }
    .filing-item {
      display: flex;
      flex-direction: column;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s;
    }
    .filing-item:hover {
      border-color: var(--brand);
    }
    .filing-sub {
      font-weight: 600;
      font-size: 11.5px;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .filing-meta {
      font-size: 10px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }
    .widget-footer {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--border);
      text-align: right;
    }
    .backlink {
      font-size: 10px;
      font-weight: 600;
      color: var(--brand);
      text-decoration: none;
    }
    .backlink:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="widget-header">
    <div class="widget-title">
      <span class="live-dot"></span>
      <span>${escapeHtmlText(symbol)} Disclosures</span>
    </div>
    ${scripCode ? `<span class="widget-scrip">BSE: ${escapeHtmlText(scripCode)}</span>` : ''}
  </div>

  <div class="filing-list">
    ${data.filings.length > 0 ? data.filings.map((f: any) => {
      const sub = f.subject || f.NEWSSUB || 'Corporate Announcement';
      const time = f.bseTime || 'Recent';
      const fId = f.id || f.newsId || '';
      return `<a href="https://bsenexus.in/announcement/${encodeURIComponent(fId)}" target="_blank" rel="noopener" class="filing-item">
        <div class="filing-sub">${escapeHtmlText(sub)}</div>
        <div class="filing-meta">
          <span>📅 ${escapeHtmlText(time)}</span>
          <span>BSE Nexus &nearr;</span>
        </div>
      </a>`;
    }).join('\n') : `<div style="padding: 12px; text-align: center; color: var(--muted);">No recent announcements found.</div>`}
  </div>

  <div class="widget-footer">
    <a href="${escapeHtmlAttr(targetUrl)}" target="_blank" rel="noopener" class="backlink">
      ⚡ Powered by BSE Nexus — Real-Time BSE Filings
    </a>
  </div>
</body>
</html>`;
}

function getRelatedCompaniesForGuide(slug: string): Array<{ symbol: string; name: string; scripCode: string }> {
  const guideCompanyMap: Record<string, Array<{ symbol: string; name: string; scripCode: string }>> = {
    'sebi-lodr-regulation-30': [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', scripCode: '532540' },
      { symbol: 'INFY', name: 'Infosys Ltd', scripCode: '500209' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', scripCode: '500180' },
      { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', scripCode: '500570' },
      { symbol: 'ITC', name: 'ITC Ltd', scripCode: '500875' }
    ],
    'board-meeting-results-guide': [
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', scripCode: '532540' },
      { symbol: 'INFY', name: 'Infosys Ltd', scripCode: '500209' },
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', scripCode: '500180' },
      { symbol: 'SBIN', name: 'State Bank of India', scripCode: '500112' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', scripCode: '532174' }
    ],
    'auditor-resignations-red-flags': [
      { symbol: 'PAYTM', name: 'One97 Communications (Paytm)', scripCode: '543396' },
      { symbol: 'ZOMATO', name: 'Zomato Ltd', scripCode: '543320' },
      { symbol: 'YESBANK', name: 'Yes Bank Ltd', scripCode: '532648' },
      { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', scripCode: '512599' },
      { symbol: 'IDEA', name: 'Vodafone Idea Ltd', scripCode: '532822' },
      { symbol: 'SUZLON', name: 'Suzlon Energy Ltd', scripCode: '532667' }
    ],
    'insider-trading-pit-regulations': [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', scripCode: '532540' },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', scripCode: '532454' },
      { symbol: 'INFY', name: 'Infosys Ltd', scripCode: '500209' },
      { symbol: 'LT', name: 'Larsen & Toubro Ltd', scripCode: '500510' },
      { symbol: 'WIPRO', name: 'Wipro Ltd', scripCode: '507685' }
    ],
    'cash-flow-forensics-india': [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325' },
      { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', scripCode: '512599' },
      { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', scripCode: '500470' },
      { symbol: 'VEDL', name: 'Vedanta Ltd', scripCode: '500295' },
      { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', scripCode: '500228' },
      { symbol: 'COALINDIA', name: 'Coal India Ltd', scripCode: '533278' }
    ],
    'bse-quarterly-results-calendar-guide': [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', scripCode: '532540' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', scripCode: '500180' },
      { symbol: 'INFY', name: 'Infosys Ltd', scripCode: '500209' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', scripCode: '532174' },
      { symbol: 'SBIN', name: 'State Bank of India', scripCode: '500112' }
    ],
    'bse-shareholding-pattern-explained': [
      { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', scripCode: '512599' },
      { symbol: 'PAYTM', name: 'One97 Communications (Paytm)', scripCode: '543396' },
      { symbol: 'YESBANK', name: 'Yes Bank Ltd', scripCode: '532648' },
      { symbol: 'ITC', name: 'ITC Ltd', scripCode: '500875' },
      { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', scripCode: '500570' },
      { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', scripCode: '500034' }
    ]
  };

  return guideCompanyMap[slug] || [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', scripCode: '500325' },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', scripCode: '532540' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', scripCode: '500180' },
    { symbol: 'INFY', name: 'Infosys Ltd', scripCode: '500209' },
    { symbol: 'ITC', name: 'ITC Ltd', scripCode: '500875' },
    { symbol: 'SBIN', name: 'State Bank of India', scripCode: '500112' }
  ];
}

function renderGuidePage(guide: MarketGuide): string {
  const slug = guide.slug || guide.id;
  const pageTitle = `${guide.title} | BSE Nexus`;

  let description = (guide.summary || guide.excerpt || '').trim().replace(/\s+/g, ' ');
  if (description.length > 155) {
    description = description.slice(0, 152).trim() + '...';
  }

  const canonicalUrl = `https://bsenexus.in/guides/${encodeURIComponent(slug)}`;

  // Publication date ISO
  let pubDateStr = guide.publishedAt || guide.date || '2024-09-01';
  let publishedIso = pubDateStr;
  try {
    const parsed = Date.parse(pubDateStr);
    if (!isNaN(parsed)) {
      publishedIso = new Date(parsed).toISOString();
    }
  } catch {}

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": guide.title,
    "description": description,
    "datePublished": publishedIso,
    "author": {
      "@type": "Person",
      "name": guide.author?.name || "BSE Nexus Research",
      ...(guide.author?.role ? { "jobTitle": guide.author.role } : {})
    },
    "publisher": {
      "@type": "Organization",
      "name": "BSE Nexus",
      "url": "https://bsenexus.in",
      "logo": {
        "@type": "ImageObject",
        "url": "https://bsenexus.in/icon-192.png"
      }
    },
    "mainEntityOfPage": canonicalUrl,
    "url": canonicalUrl
  }, null, 2);

  // Sections HTML
  const sectionsHtml = (guide.content?.sections || []).map((sec, idx) => {
    const heading = sec.heading || sec.title || '';
    const bodyParagraphs = sec.body || (sec.content ? [sec.content] : []);
    const points: string[] = (sec as any).keyPoints || (sec as any).takeaways || [];
    const callout = sec.callout;

    let pointsHtml = '';
    if (points.length > 0) {
      pointsHtml = `
      <div class="takeaways-box">
        <div class="takeaways-label">✨ Key Takeaways</div>
        <ul class="takeaways-list">
          ${points.map(p => `<li>${escapeHtmlText(p)}</li>`).join('\n')}
        </ul>
      </div>`;
    }

    let calloutHtml = '';
    if (callout && callout.text) {
      const type = callout.type || 'info';
      const label = type === 'warning' ? '⚠️ Critical Warning' : type === 'tip' ? '💡 Pro Analyst Tip' : 'ℹ️ Important Note';
      calloutHtml = `
      <div class="callout callout-${escapeHtmlAttr(type)}">
        <div class="callout-label">${escapeHtmlText(label)}</div>
        <div class="callout-text">${escapeHtmlText(callout.text)}</div>
      </div>`;
    }

    return `
    <div class="article-sec" id="section-${idx + 1}">
      ${heading ? `<h2 class="sec-heading">${escapeHtmlText(heading)}</h2>` : ''}
      <div class="sec-content">
        ${bodyParagraphs.map(p => `<p>${escapeHtmlText(p)}</p>`).join('\n')}
      </div>
      ${pointsHtml}
      ${calloutHtml}
    </div>`;
  }).join('\n');

  // Checklist HTML
  let checklistHtml = '';
  if (Array.isArray(guide.content?.checklist) && guide.content.checklist.length > 0) {
    checklistHtml = `
    <div class="checklist-card">
      <div class="checklist-title">✓ Forensic Investor Checklist Before Trading</div>
      <div class="checklist-grid">
        ${guide.content.checklist.map((item, i) => `
          <div class="checklist-item">
            <span class="checklist-num">0${i + 1}.</span>
            <span class="checklist-text">${escapeHtmlText(item)}</span>
          </div>
        `).join('\n')}
      </div>
    </div>`;
  }

  // Conclusion HTML
  let conclusionHtml = '';
  if (guide.content?.conclusion) {
    conclusionHtml = `
    <div class="conclusion-card">
      <h3 class="conclusion-title">Conclusion</h3>
      <p class="conclusion-text">${escapeHtmlText(guide.content.conclusion)}</p>
    </div>`;
  }

  const relatedCompanies = getRelatedCompaniesForGuide(slug);
  const relatedCompaniesHtml = `
    <section class="related-companies-sec">
      <h2 class="sec-heading">Related Companies &amp; Live Filings</h2>
      <p style="font-size: 0.875rem; color: #64748B; margin-bottom: 14px;">Explore live corporate announcements, quarterly results, and regulatory filings for key market leaders:</p>
      <div class="related-companies-grid">
        ${relatedCompanies.map(c => `
          <a href="/company/${escapeHtmlAttr(c.symbol)}" class="related-company-pill">
            <span class="rel-sym">${escapeHtmlText(c.symbol)}</span>
            <span class="rel-name">${escapeHtmlText(c.name)}</span>
            <span class="rel-link">BSE: ${escapeHtmlText(c.scripCode)} &rarr;</span>
          </a>
        `).join('\n')}
      </div>
    </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(pageTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">
  <meta name="robots" content="index, follow">
${AI_STUDIO_REDIRECT_SCRIPT}

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="https://bsenexus.in/og-image.png">
  <meta property="og:site_name" content="BSE Nexus">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
  <meta name="twitter:image" content="https://bsenexus.in/og-image.png">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --brand: #1C362A;
      --brand-hover: #14271E;
      --accent: #059669;
      --accent-light: #ECFDF5;
      --text: #0F172A;
      --muted: #64748B;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }
    .top-banner {
      background: var(--brand);
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .top-brand {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-decoration: none;
    }
    .top-brand span { color: #34D399; font-weight: 500; }
    .app-btn {
      background: #059669;
      color: #FFFFFF;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .app-btn:hover { background: #047857; }
    .container {
      max-width: 860px;
      margin: 32px auto 60px auto;
      padding: 0 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
    }
    @media (max-width: 640px) {
      .card { padding: 24px 18px; }
      .container { margin: 16px auto; }
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      background: var(--accent-light);
      color: var(--accent);
      border: 1px solid #A7F3D0;
    }
    .badge.time {
      background: #F1F5F9;
      color: var(--muted);
      border-color: #E2E8F0;
      text-transform: none;
      font-weight: 600;
    }
    .meta-date {
      font-size: 0.75rem;
      color: var(--muted);
      margin-left: auto;
      font-weight: 500;
    }
    h1.guide-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.02em;
      line-height: 1.25;
      margin-bottom: 20px;
    }
    @media (min-width: 768px) {
      h1.guide-title { font-size: 2.25rem; }
    }
    .author-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .author-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid #10B981;
    }
    .author-name {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text);
    }
    .author-role {
      font-size: 0.75rem;
      color: var(--muted);
    }
    .intro-box {
      background: #F8FAFC;
      border: 1px solid #F1F5F9;
      border-radius: 12px;
      padding: 20px;
      font-size: 1rem;
      color: #334155;
      line-height: 1.65;
      font-weight: 500;
      margin-bottom: 32px;
    }
    .article-sec {
      margin-bottom: 32px;
    }
    .sec-heading {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 12px;
      padding-left: 10px;
      border-left: 3px solid var(--accent);
      line-height: 1.35;
    }
    .sec-content p {
      font-size: 0.9375rem;
      color: #334155;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .sec-content p:last-child {
      margin-bottom: 0;
    }
    .takeaways-box {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 16px 0;
    }
    .takeaways-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #15803D;
      margin-bottom: 10px;
    }
    .takeaways-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .takeaways-list li {
      font-size: 0.875rem;
      color: #166534;
      padding: 4px 0 4px 22px;
      position: relative;
      line-height: 1.5;
    }
    .takeaways-list li::before {
      content: "✓";
      position: absolute;
      left: 0;
      top: 4px;
      color: #10B981;
      font-weight: bold;
    }
    .callout {
      border-radius: 12px;
      padding: 16px 20px;
      margin: 16px 0;
      border: 1px solid;
    }
    .callout-warning {
      background: #FFFBEB;
      border-color: #FDE68A;
      color: #92400E;
    }
    .callout-tip {
      background: #FAF5FF;
      border-color: #E9D5FF;
      color: #6B21A8;
    }
    .callout-info {
      background: #EFF6FF;
      border-color: #BFDBFE;
      color: #1E40AF;
    }
    .callout-label {
      font-size: 0.6875rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .callout-text {
      font-size: 0.875rem;
      line-height: 1.55;
    }
    .checklist-card {
      background: #0F172A;
      color: #FFFFFF;
      border-radius: 14px;
      padding: 24px;
      margin: 32px 0;
    }
    .checklist-title {
      font-size: 0.8125rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #34D399;
      margin-bottom: 16px;
    }
    .checklist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .checklist-item {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.8125rem;
      line-height: 1.45;
      color: #E2E8F0;
    }
    .checklist-num {
      font-family: monospace;
      font-weight: 700;
      color: #34D399;
      flex-shrink: 0;
    }
    .conclusion-card {
      border-top: 1px solid var(--border);
      padding-top: 24px;
      margin-top: 32px;
    }
    .conclusion-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 8px;
    }
    .conclusion-text {
      font-size: 0.9375rem;
      color: #334155;
      line-height: 1.65;
    }
    .related-companies-sec {
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .related-companies-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .related-company-pill {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px;
      background: #F8FAFC;
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: var(--text);
      transition: all 0.15s ease;
    }
    .related-company-pill:hover {
      border-color: #059669;
      background: #FFFFFF;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      transform: translateY(-1px);
    }
    .rel-sym {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 0.9375rem;
      color: #065F46;
    }
    .rel-name {
      font-size: 0.75rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rel-link {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #059669;
    }
    .cta-row {
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .app-btn-large {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--brand);
      color: #FFFFFF;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      transition: background 0.15s ease;
    }
    .app-btn-large:hover {
      background: var(--brand-hover);
    }
    .terminal-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
    }
    .terminal-link:hover { text-decoration: underline; }
    footer {
      text-align: center;
      margin-top: 40px;
      font-size: 0.8125rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <nav class="top-banner">
    <a href="https://bsenexus.in" class="top-brand">
      BSE <span>Nexus</span>
    </a>
    <a href="https://bsenexus.in/?tab=guides" class="app-btn">
      Open in BSE Nexus App &rarr;
    </a>
  </nav>

  <main class="container">
    <article class="card">
      <div class="meta-bar">
        <span class="badge">${escapeHtmlText(guide.category)}</span>
        <span class="badge time">⏱ ${escapeHtmlText(guide.readTime)}</span>
        ${guide.date || guide.publishedAt ? `<time class="meta-date">📅 ${escapeHtmlText(guide.date || guide.publishedAt || '')}</time>` : ''}
      </div>

      <h1 class="guide-title">${escapeHtmlText(guide.title)}</h1>

      ${guide.author ? `
      <div class="author-bar">
        ${guide.author.avatar ? `
        <img src="${escapeHtmlAttr(guide.author.avatar)}" alt="${escapeHtmlAttr(guide.author.name)}" class="author-avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        ` : ''}
        <div>
          <div class="author-name">${escapeHtmlText(guide.author.name)}</div>
          ${guide.author.role ? `<div class="author-role">${escapeHtmlText(guide.author.role)}</div>` : ''}
        </div>
      </div>
      ` : ''}

      ${guide.content?.introduction ? `
      <div class="intro-box">
        <p>${escapeHtmlText(guide.content.introduction)}</p>
      </div>
      ` : ''}

      ${sectionsHtml}

      ${checklistHtml}

      ${conclusionHtml}

      ${relatedCompaniesHtml}

      <div class="cta-row">
        <a href="https://bsenexus.in/?tab=guides" class="app-btn-large">
          Open in BSE Nexus App &rarr;
        </a>
        <a href="https://bsenexus.in/?tab=announcements" class="terminal-link">
          Explore Live BSE Corporate Disclosures on BSE Nexus &rarr;
        </a>
      </div>
    </article>

    <footer>
      Independent financial research and educational terminal for Indian equities (BSE).
    </footer>
  </main>
</body>
</html>`;
}

function renderGuide404Page(slug: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guide Not Found | BSE Nexus</title>
  <meta name="robots" content="noindex, follow">
${AI_STUDIO_REDIRECT_SCRIPT}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      background: #F8FAFC;
      color: #0F172A;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 40px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      color: #1C362A;
      margin: 0 0 12px 0;
    }
    p {
      color: #64748B;
      font-size: 0.9375rem;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background: #1C362A;
      color: #FFFFFF;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover { background: #14271E; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Guide Not Found</h1>
    <p>We could not find the educational guide for ${slug ? `"${escapeHtmlText(slug)}"` : 'the requested topic'}. Browse all regulatory guides and market playbooks in the app.</p>
    <a href="https://bsenexus.in/?tab=guides" class="btn">Browse Market Guides &rarr;</a>
  </div>
</body>
</html>`;
}

// Explicit SEO & AI Crawler Handlers (GEO / AEO Standards)
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'robots.txt'));
});

// Canonical XML Sitemap with stable routes and 26 curated company pages
app.get(['/sitemap.xml', '/sitemap', '/sitemap_index.xml', '/sitemap.txt'], (_req, res) => {
  res.type('application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600');
  res.sendFile(path.join(process.cwd(), 'public', 'sitemap.xml'));
});

// Auto-generated RSS 2.0 Feed listing the latest 50 BSE corporate announcements
app.get(['/rss.xml', '/rss', '/feed.xml', '/feed'], async (_req, res) => {
  try {
    const recent = await getRecentAnnouncements(50);
    const announcements = Array.isArray(recent) ? recent.slice(0, 50) : [];

    const xmlItems = announcements.map(item => {
      const company = item.companyName || item.company || 'BSE Listed Company';
      const headline = item.headline || item.subject || item.NEWSSUB || item.MORE || 'Corporate Announcement';
      const rawTitle = `${company}: ${headline}`;
      const title = escapeHtmlText(rawTitle);
      const id = item.id || item.newsId || '';
      const link = id ? `https://bsenexus.in/announcement/${encodeURIComponent(id)}` : 'https://bsenexus.in/announcements';
      
      // Parse pubDate to RFC 822 format (e.g. "Mon, 21 Sep 2026 12:00:00 GMT")
      let pubDate = new Date().toUTCString();
      const rawDate = item.dt_tm || item.fetched_at || item.disseminationTime;
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            pubDate = d.toUTCString();
          }
        } catch {}
      }

      const summary = item.aiSummary || item.summary || item.headline || item.subject || '';
      const category = item.category || 'Corporate Announcement';
      const scripCode = item.scrip_cd || item.scripCode || '';

      return `    <item>
      <title>${title}</title>
      <link>${escapeHtmlAttr(link)}</link>
      <guid isPermaLink="true">${escapeHtmlAttr(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeHtmlText(category)}</category>
      <description><![CDATA[${summary ? summary.slice(0, 1000) : headline}${scripCode ? ` (BSE: ${scripCode})` : ''}]]></description>
    </item>`;
    }).join('\n');

    const lastBuildDate = announcements[0]?.fetched_at 
      ? new Date(announcements[0].fetched_at).toUTCString() 
      : new Date().toUTCString();

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BSE Nexus Announcements Feed</title>
    <link>https://bsenexus.in/</link>
    <description>Latest BSE India corporate announcements, financial results, board meetings, and regulatory disclosures in real-time.</description>
    <language>en-in</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="https://bsenexus.in/rss.xml" rel="self" type="application/rss+xml"/>
${xmlItems}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600');
    res.send(rssXml);
  } catch (err: any) {
    console.error('[RSS] Error generating RSS feed:', err?.message || err);
    res.status(500).type('text/plain').send('Unable to generate RSS feed');
  }
});

// Redirect accidental full-URL sitemap submissions (common mistake in Google Search Console input box)
app.get([/^\/https?:\/?\/?(?:www\.)?bsenexus\.in\/sitemap(?:\.xml)?$/i], (_req, res) => {
  res.redirect(301, '/sitemap.xml');
});

// IndexNow Key verification endpoint for search engines (Bing, Yandex, Seznam, Naver)
app.get([`/${INDEXNOW_KEY}.txt`, '/indexnow-key.txt'], (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(INDEXNOW_KEY);
});

// OpenSearch description document for browser search bar integration (Firefox, Edge, Chrome, Safari)
app.get('/opensearch.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/opensearchdescription+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(process.cwd(), 'public', 'opensearch.xml'));
});

// Permanent 301 Redirects for Legacy / Unindexed URLs (Fix 2)
const PERMANENT_301_REDIRECTS: Record<string, string> = {
  '/guides/what-is-sebi-lodr-regulation-30': '/guides/sebi-lodr-regulation-30',
  '/guides/bse-corporate-actions-explained': '/guides',
  '/guides/how-to-track-bse-corporate-announcements': '/guides',
  '/guides/how-to-read-bse-financial-results': '/guides',
  '/guides/bse-scrip-code-vs-isin-explained': '/guides',
  '/announcement/nse_ADANIGREEN_1753641000000_FY26-Q1': '/announcements',
  '/announcement/nse_ADANIGREEN_1761589800000_FY26-Q2': '/announcements',
};

for (const [sourcePath, targetPath] of Object.entries(PERMANENT_301_REDIRECTS)) {
  app.get([sourcePath, sourcePath + '/'], (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.redirect(301, targetPath);
  });
}

// Crawlable, server-rendered individual announcement pages for search engines & direct visitors
app.get('/announcement/:newsId', async (req, res) => {
  const newsId = req.params.newsId;
  if (!newsId || typeof newsId !== 'string') {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderAnnouncement404Page());
  }

  const cleanId = newsId.trim();

  // Explicit check for legacy 301 redirects
  if (cleanId === 'nse_ADANIGREEN_1753641000000_FY26-Q1' || cleanId === 'nse_ADANIGREEN_1761589800000_FY26-Q2') {
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.redirect(301, '/announcements');
  }

  const cacheKey = `ann:${cleanId}`;
  const clientEtag = req.headers['if-none-match'];

  // Check in-memory rendered page cache
  const cached = pageRenderCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('ETag', cached.etag);
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    if (clientEtag && clientEtag === cached.etag) {
      return res.status(304).end();
    }
    return res.send(cached.body);
  }

  try {
    const isBatchTest = cleanId.toLowerCase().includes('batch_test_');
    const announcement = await getAnnouncementById(cleanId);
    if (!announcement) {
      return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderAnnouncement404Page(isBatchTest));
    }

    const html = renderAnnouncementPage(announcement, cleanId);
    const entry = pageRenderCache.set(cacheKey, html, 'text/html; charset=utf-8', { ttlMs: 60 * 60 * 1000 });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('ETag', entry.etag);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    if (clientEtag && clientEtag === entry.etag) {
      return res.status(304).end();
    }
    return res.send(html);
  } catch (err: any) {
    console.error("Error serving announcement page:", err?.message || err);
    return res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderAnnouncement404Page());
  }
});

// Crawlable, server-rendered individual company/stock pages for search engines & direct visitors
app.get(['/company/:symbol', '/stock/:symbol'], async (req, res) => {
  const rawInput = req.params.symbol;
  if (!rawInput || typeof rawInput !== 'string') {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderCompany404Page(''));
  }

  const cleanInput = rawInput.trim().toUpperCase();
  let symbol = cleanInput;
  let scripCode = getScripCode(cleanInput);

  // If user navigated via numeric BSE Scrip Code (e.g., 500325)
  if (/^\d{5,7}$/.test(cleanInput)) {
    scripCode = cleanInput;
    const allEntries = getAllStockEntries();
    const match = allEntries.find(e => e.scripCode === cleanInput);
    if (match && match.symbol) {
      symbol = match.symbol;
    }
  } else if (!scripCode) {
    const allEntries = getAllStockEntries();
    const match = allEntries.find(e => e.symbol.toUpperCase() === cleanInput);
    if (match && match.scripCode) {
      scripCode = match.scripCode;
    }
  }

  if (!scripCode) {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderCompany404Page(symbol));
  }

  const cacheKey = `comp:${symbol}`;
  const clientEtag = req.headers['if-none-match'];

  // Check in-memory rendered company page cache
  const cached = pageRenderCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('ETag', cached.etag);
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    if (clientEtag && clientEtag === cached.etag) {
      return res.status(304).end();
    }
    return res.send(cached.body);
  }

  try {
    const intel = await getCompanyIntelligence(scripCode, symbol);
    if (!intel) {
      return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderCompany404Page(symbol));
    }

    const html = renderCompanyPage(intel, symbol, scripCode);
    const entry = pageRenderCache.set(cacheKey, html, 'text/html; charset=utf-8', { ttlMs: 15 * 60 * 1000 });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('ETag', entry.etag);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    if (clientEtag && clientEtag === entry.etag) {
      return res.status(304).end();
    }
    return res.send(html);
  } catch (err: any) {
    console.error(`Error serving company page for ${symbol}:`, err?.message || err);
    return res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderCompany404Page(symbol));
  }
});

// Crawlable, server-rendered educational Market Guide articles for search engines & direct visitors
app.get('/guides/:slug', (req, res) => {
  const rawSlug = req.params.slug;
  if (!rawSlug || typeof rawSlug !== 'string') {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderGuide404Page(''));
  }

  const slug = rawSlug.trim().toLowerCase();
  const guide = MARKET_GUIDES.find(g => (g.slug && g.slug.toLowerCase() === slug) || (g.id && g.id.toLowerCase() === slug));
  if (!guide) {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderGuide404Page(rawSlug));
  }

  const cacheKey = `guide:${slug}`;
  const clientEtag = req.headers['if-none-match'];

  // Check in-memory rendered guide cache
  const cached = staticGuideCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('ETag', cached.etag);
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    if (clientEtag && clientEtag === cached.etag) {
      return res.status(304).end();
    }
    return res.send(cached.body);
  }

  try {
    const html = renderGuidePage(guide);
    const entry = staticGuideCache.set(cacheKey, html, 'text/html; charset=utf-8', { ttlMs: 24 * 60 * 60 * 1000 });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('ETag', entry.etag);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    if (clientEtag && clientEtag === entry.etag) {
      return res.status(304).end();
    }
    return res.send(html);
  } catch (err: any) {
    console.error(`Error serving guide page for ${slug}:`, err?.message || err);
    return res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderGuide404Page(rawSlug));
  }
});

// Crawlable, server-rendered Frequently Asked Questions (FAQ) page with schema.org FAQPage JSON-LD
app.get(['/faq', '/faqs'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.send(renderFaqPage());
});

// Crawlable, server-rendered Pricing & Plans page
app.get(['/pricing', '/pricing/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.send(renderPricingPage());
});

// Intentional alias redirect: /plans -> /pricing
app.get(['/plans', '/plans/'], (_req, res) => {
  res.redirect(301, '/pricing');
});

// Crawlable, server-rendered Market Guides hub
app.get(['/guides', '/guides/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.send(renderGuidesIndexPage());
});

// Intentional alias redirect: /market-guides -> /guides
app.get(['/market-guides', '/market-guides/'], (_req, res) => {
  res.redirect(301, '/guides');
});

// Crawlable, server-rendered 26 BSE Listed Companies directory page
app.get(['/companies', '/companies/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.send(renderCompaniesDirectoryPage());
});

// Intentional alias redirect: /company-directory -> /companies
app.get(['/company-directory', '/company-directory/'], (_req, res) => {
  res.redirect(301, '/companies');
});

// Crawlable, server-rendered About Us page
app.get(['/about', '/about/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.send(renderAboutPage());
});

// Crawlable, server-rendered Contact page
app.get(['/contact', '/contact/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.send(renderContactPage());
});

// Crawlable, server-rendered Disclaimer & Entity Clarity page
app.get(['/disclaimer', '/disclaimer/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.send(renderDisclaimerPage());
});

// Crawlable, server-rendered Privacy Policy page
app.get(['/privacy-policy', '/privacy-policy/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.send(renderPrivacyPolicyPage());
});

// Intentional alias redirect: /privacy -> /privacy-policy
app.get(['/privacy', '/privacy/'], (_req, res) => {
  res.redirect(301, '/privacy-policy');
});

// Crawlable, server-rendered Terms of Service page
app.get(['/terms', '/terms/'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  res.send(renderTermsPage());
});

// Intentional alias redirect: /terms-of-service -> /terms
app.get(['/terms-of-service', '/terms-of-service/'], (_req, res) => {
  res.redirect(301, '/terms');
});

// Free Embeddable BSE Announcements & Disclosures Widget (for finance bloggers, subreddits, and publishers)
app.get('/embed/widget', async (req, res) => {
  try {
    const rawSymbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';
    const theme = typeof req.query.theme === 'string' && req.query.theme.toLowerCase() === 'dark' ? 'dark' : 'light';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '5'), 10) || 5, 1), 10);

    let symbol = rawSymbol;
    let scripCode = rawSymbol ? getScripCode(rawSymbol) : '';
    let companyName = '';
    let filings: any[] = [];

    if (rawSymbol) {
      if (/^\d{5,7}$/.test(rawSymbol)) {
        scripCode = rawSymbol;
        const allEntries = getAllStockEntries();
        const match = allEntries.find(e => e.scripCode === rawSymbol);
        if (match && match.symbol) {
          symbol = match.symbol;
          companyName = match.name;
        }
      }

      if (scripCode) {
        const intel = await getCompanyIntelligence(scripCode, symbol);
        if (intel) {
          companyName = intel.companyName || companyName;
          filings = (intel.recentFilings || []).slice(0, limit);
        }
      }
    }

    if (filings.length === 0) {
      const recent = await getRecentAnnouncements(limit);
      filings = recent.slice(0, limit);
    }

    const html = renderEmbedWidget({
      symbol: symbol || 'BSE INDIA',
      scripCode,
      companyName,
      filings,
      theme
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
    res.send(html);
  } catch (err: any) {
    console.error("Error serving embed widget:", err?.message || err);
    res.status(500).send("Widget temporarily unavailable");
  }
});

// Segmented XML Sitemap for Programmatic Stock/Company Pages
app.get('/sitemap-companies.xml', (_req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const stockEntries = getAllStockEntries();
  const seenSymbols = new Set<string>();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const entry of stockEntries) {
    const sym = entry.symbol?.trim().toUpperCase();
    if (!sym || seenSymbols.has(sym) || !/^[A-Z0-9-]{2,15}$/.test(sym)) continue;
    seenSymbols.add(sym);
    xml += `  <url>\n    <loc>https://bsenexus.in/company/${escapeHtmlAttr(sym)}</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  }
  xml += `</urlset>`;

  res.type('application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600');
  res.send(xml);
});

// Segmented XML Sitemap for Educational Market Guides
app.get('/sitemap-guides.xml', (_req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `  <url>\n    <loc>https://bsenexus.in/pricing</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  xml += `  <url>\n    <loc>https://bsenexus.in/guides</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  xml += `  <url>\n    <loc>https://bsenexus.in/faq</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  for (const guide of MARKET_GUIDES) {
    const slug = guide.slug || guide.id;
    if (!slug) continue;
    xml += `  <url>\n    <loc>https://bsenexus.in/guides/${escapeHtmlAttr(slug)}</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  }
  xml += `</urlset>`;

  res.type('application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600');
  res.send(xml);
});

app.get('/llms.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'llms.txt'));
});

app.get('/llms-full.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'llms-full.txt'));
});

// Dynamic handler for Google Search Console HTML file verification (e.g. /google1234567890abcdef.html)
app.get(/^\/google([a-zA-Z0-9_-]+)\.html$/, (req, res) => {
  const hash = req.params[0];
  res.type('text/html; charset=utf-8');
  res.send(`google-site-verification: google${hash}.html`);
});

// Serve static assets from public directory (favicons, apple-touch-icons, manifest, etc.)
app.use(express.static(path.join(process.cwd(), 'public'), {
  maxAge: '1d',
  immutable: false
}));

// Authentication Routes (Login/Logout/Status)
app.use('/auth', authRouter);

// Google reCAPTCHA Enterprise Verification Endpoint (Strict Fail-Closed)
app.post('/api/security/verify-recaptcha', authRateLimiter, async (req, res) => {
  try {
    const { token, action } = req.body || {};
    const context = {
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'] as string,
      host: req.headers.host as string
    };
    const assessment = await verifyRecaptchaToken(token, action || 'LOGIN', context);
    if (!assessment.valid) {
      console.warn('[reCAPTCHA Verification Failed]', {
        errorCode: assessment.errorCode,
        error: assessment.error,
        userMessage: assessment.userMessage,
        host: context.host
      });
      return res.status(400).json({
        success: false,
        error: assessment.userMessage || 'Security verification failed. Please try again.',
        userMessage: assessment.userMessage || 'Security verification failed. Please try again.',
        code: assessment.errorCode,
        detail: assessment.error
      });
    }
    return res.json({
      success: true,
      verified: true,
      score: assessment.score,
      action: assessment.action
    });
  } catch (err: any) {
    console.error('[reCAPTCHA Enterprise Endpoint] Internal error caught:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'Security verification could not be completed at this time. Please try again.',
      code: 'VERIFICATION_ERROR'
    });
  }
});

// Protected API Routes with Rate Limiting
app.use('/api', apiRateLimiter, apiRouter);


// Ensure any /api or /auth endpoint that errors or doesn't match returns JSON 404/500, NOT HTML
app.use(['/api/*', '/auth/*'], (_req, res) => {
  res.status(404).json({ success: false, error: "API route not found" });
});


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    console.error("API Error handler caught:", err?.message || err);
    const isProd = process.env.NODE_ENV === 'production';
    const safeError = isProd ? "An internal error occurred. Please try again later." : (err?.message || "Internal Server Error");
    return res.status(500).json({ success: false, error: safeError });
  }
  next(err);
});

// Background Poller (30s market-hours / 5m off-hours with effective interval logging)
let pollerCycleCount = 0;
let lastPollerStartMs = 0;

async function scheduleAnnouncementPoller() {
  pollerCycleCount++;
  const startMs = Date.now();
  const effectiveIntervalSec = lastPollerStartMs > 0 ? ((startMs - lastPollerStartMs) / 1000).toFixed(1) : 'initial';
  lastPollerStartMs = startMs;

  try {
    await processAnnouncements();
  } catch (error: any) {
    await addLog('ERROR', 'SYSTEM', `Unhandled poller error: ${error.message}`);
  } finally {
    const elapsedMs = Date.now() - startMs;
    const failures = getConsecutiveFailures();
    const targetIntervalMs = getPollingIntervalMs(failures);
    const nextInterval = Math.max(0, targetIntervalMs - elapsedMs);
    const { isMarketHours, statusLabel, hours, minutes } = getISTMarketStatus();
    const backupMetrics = getBackupStalenessMetrics();
    const backupStr = backupMetrics.stalenessSec !== null ? ` | Backup Staleness: ${backupMetrics.stalenessSec}s (${backupMetrics.status})` : '';

    // Log effective poll interval on each cycle for outside verification
    const cycleLogMsg = `[POLLER] Cycle #${pollerCycleCount} | Duration: ${elapsedMs}ms | Mode: ${statusLabel} (IST: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}, Market: ${isMarketHours ? 'YES' : 'NO'}) | Interval: ${effectiveIntervalSec}s (Target: ${targetIntervalMs / 1000}s, Next in: ${(nextInterval / 1000).toFixed(1)}s)${backupStr}`;
    
    // Add to activity logs
    addLog('INFO', 'POLLER', cycleLogMsg).catch(() => {});
    console.log(cycleLogMsg);

    setTimeout(scheduleAnnouncementPoller, nextInterval);
  }
}
scheduleAnnouncementPoller();

// Independent Storage Capacity & Pruning (Every 15 minutes, completely decoupled from critical poller path)
setTimeout(() => {
  pruneAndCheckStorageCapacity().catch(e => console.error("Initial storage check err:", e.message));
}, 10000);
setInterval(() => {
  pruneAndCheckStorageCapacity().catch(e => console.error("Periodic storage check err:", e.message));
}, 15 * 60 * 1000);

// Results Calendar Sync, Watchlists Init & Historical Sync
setTimeout(() => {
  initWatchlists().catch(e => console.info("[WatchlistDao] Initial watchlist check:", e?.message || e));
  updateTelegramHealth().catch(e => console.error("Initial telegram health check err:", e.message));
  fetchAndSyncResultsCalendar().catch(e => console.error("Initial results calendar sync err:", e.message));
  syncWatchlistHistoricalData().catch(e => console.error("Initial watchlist historical sync err:", e.message));
  backfillRecentAnnouncements().catch(e => console.error("Initial backfill announcements err:", e.message));
}, 3000);
setInterval(() => {
  fetchAndSyncResultsCalendar(true).catch(e => console.error("Periodic results calendar sync err:", e.message));
  syncWatchlistHistoricalData().catch(e => console.error("Periodic watchlist historical sync err:", e.message));
}, 24 * 60 * 60 * 1000);

// 24/7 Background Multi-Source RSS News Worker (Runs every 3 minutes to auto-dispatch watchlist stock news to Telegram)
setTimeout(() => {
  processAutomatedNewsAlerts().catch(e => console.warn("[StockNewsWorker] Initial pass notice:", e.message));
}, 8000);
setInterval(() => {
  processAutomatedNewsAlerts().catch(e => console.warn("[StockNewsWorker] Interval pass error:", e.message));
}, 3 * 60 * 1000);

// Auto-Recovery Check: Every 10 minutes, verify if Pacific Midnight passed / quota flag cleared / permission lock expired, and resume Firestore network
setInterval(async () => {
  try {
    const mode = getManualStorageMode();
    if (mode !== 'FORCE_LOCAL') {
      resetAdminPermissionDenied();
      const isExceeded = isFirestoreQuotaExceeded();
      if (!isExceeded) {
        await resumeFirestoreNetwork();
      }
    }
  } catch (err: any) {
    console.warn("Storage auto-recovery interval error:", err?.message || err);
  }
}, 10 * 60 * 1000);

// Tab-specific SEO metadata mapping matching sitemap.xml and search engine requirements
interface TabSeoMeta {
  title: string;
  description: string;
  canonical: string;
}

const TAB_SEO_CONFIG: Record<string, TabSeoMeta> = {
  default: {
    title: "BSE Nexus — BSE Corporate Announcements & Disclosures",
    description: "Track latest BSE corporate announcements, board meeting outcomes, financial results, and regulatory filings on BSE Nexus.",
    canonical: "https://bsenexus.in/",
  },
  announcements: {
    title: "Live BSE Announcements & Corporate Filings | BSE Nexus",
    description: "Track BSE corporate announcements, board meetings, financial disclosures, and regulatory filings with AI-powered financial summaries on BSE Nexus.",
    canonical: "https://bsenexus.in/announcements",
  },
  "results-calendar": {
    title: "BSE Results Calendar — Upcoming Quarterly Results & Earnings Dates | BSE Nexus",
    description: "Track upcoming BSE quarterly results, board meeting dates, earnings releases, and financial result disclosures for Indian listed companies live on BSE Nexus.",
    canonical: "https://bsenexus.in/results-calendar",
  },
  watchlists: {
    title: "Custom Stock Watchlists & Telegram Alerts | BSE Nexus",
    description: "Create custom BSE equity watchlists, monitor priority disclosures, and receive Telegram alerts for company announcements on BSE Nexus.",
    canonical: "https://bsenexus.in/watchlist",
  },
  guides: {
    title: "Indian Equity Research Guides & Market Intelligence | BSE Nexus",
    description: "Practical guides and research insights for Indian stock market investors covering BSE filings, corporate actions, SEBI LODR disclosures, and equity analytics on BSE Nexus.",
    canonical: "https://bsenexus.in/guides",
  },
  pricing: {
    title: "Pricing & Plans — 100% Free Launch Access | BSE Nexus",
    description: "Explore BSE Nexus transparent pricing. 100% Free access to Community and Pro intelligence features during launch: latest BSE filings, Gemini AI summaries, and Telegram alerts on BSE Nexus.",
    canonical: "https://bsenexus.in/pricing",
  },
  companies: {
    title: "BSE Listed Companies — Company Profiles, Results & Filings | BSE Nexus",
    description: "Explore all 26 premier BSE listed companies on BSE Nexus. Access live corporate announcements, quarterly earnings results, SEBI LODR disclosures, and AI intelligence.",
    canonical: "https://bsenexus.in/companies",
  },
  about: {
    title: "About BSE Nexus — Independent BSE Corporate Disclosures Aggregator",
    description: "BSE Nexus is an independent BSE corporate announcement aggregator run by Rahul Dahiya, contact admin@bsenexus.in. One honest paragraph, no hype.",
    canonical: "https://bsenexus.in/about",
  },
  contact: {
    title: "Contact Us | BSE Nexus",
    description: "Contact Rahul Dahiya and the BSE Nexus team for support, API inquiries, feedback, and disclosures intelligence at admin@bsenexus.in.",
    canonical: "https://bsenexus.in/contact",
  },
  disclaimer: {
    title: "Disclaimer & Entity Clarity | BSE Nexus",
    description: "BSE Nexus is not affiliated with BSE India Ltd, SEBI, or any exchange; informational use only; not investment advice; verify filings on bseindia.com.",
    canonical: "https://bsenexus.in/disclaimer",
  },
  privacy: {
    title: "Privacy Policy | BSE Nexus",
    description: "Read the BSE Nexus privacy policy. Learn how we safeguard your data, preferences, watchlists, and communications.",
    canonical: "https://bsenexus.in/privacy-policy",
  },
  terms: {
    title: "Terms of Service | BSE Nexus",
    description: "Review the terms and conditions for accessing BSE Nexus live corporate announcements, AI summaries, and alert integrations.",
    canonical: "https://bsenexus.in/terms",
  },
  holidays: {
    title: "BSE & NSE Trading Holidays 2026 Calendar | BSE Nexus",
    description: "Complete schedule of BSE and NSE stock market trading holidays, clearing dates, and special trading sessions for the calendar year 2026 on BSE Nexus.",
    canonical: "https://bsenexus.in/",
  },
};

const TAB_ALIASES: Record<string, string> = {
  dashboard: "announcements",
  results: "results-calendar",
  watchlist: "watchlists",
  news: "announcements",
  pricing: "pricing",
  plans: "pricing",
  guides: "guides",
  "market-guides": "guides",
  companies: "companies",
  "company-directory": "companies",
  about: "about",
  contact: "contact",
  disclaimer: "disclaimer",
  privacy: "privacy",
  "privacy-policy": "privacy",
  terms: "terms",
  "terms-of-service": "terms",
};

function injectTabSeoMetadata(html: string, tabQuery?: string): string {
  const cleanTab = typeof tabQuery === "string" ? tabQuery.trim().toLowerCase() : "";
  const normalizedKey = TAB_ALIASES[cleanTab] || cleanTab;
  const meta = TAB_SEO_CONFIG[normalizedKey] || TAB_SEO_CONFIG.default;

  let transformed = html;

  // 1. Update <title>...</title>
  transformed = transformed.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlText(meta.title)}</title>`
  );

  // 2. Update <link rel="canonical" href="..." />
  transformed = transformed.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtmlAttr(meta.canonical)}" />`
  );

  // 3. Update <meta name="description" content="..." />
  transformed = transformed.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtmlAttr(meta.description)}" />`
  );

  // 4. Update Open Graph tags
  transformed = transformed.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />`
  );
  transformed = transformed.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />`
  );
  transformed = transformed.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtmlAttr(meta.canonical)}" />`
  );

  // 5. Update Twitter Card tags
  transformed = transformed.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" />`
  );
  transformed = transformed.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" />`
  );
  transformed = transformed.replace(
    /<meta\s+name="twitter:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:url" content="${escapeHtmlAttr(meta.canonical)}" />`
  );

  // 6. Inject FAQPage JSON-LD structured data for results-calendar
  if (normalizedKey === "results-calendar") {
    const faqSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": "https://bsenexus.in/results-calendar#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How can I check upcoming BSE quarterly results and earnings dates?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "You can track scheduled board meeting notices and quarterly earnings announcements directly on the BSE Nexus Results Calendar with live dates, BSE scrip codes, and company updates."
          }
        },
        {
          "@type": "Question",
          "name": "When are Indian listed companies required to declare quarterly results?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Under SEBI (Listing Obligations and Disclosure Requirements) Regulation 33, listed companies on the BSE must announce their quarterly financial results within 45 days of the end of each quarter, and within 60 days for annual audited figures."
          }
        },
        {
          "@type": "Question",
          "name": "How many days in advance do companies notify BSE about board meetings for financial results?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Under SEBI LODR Regulation 29, listed companies must give at least 2 working days advance notice (excluding the date of the meeting and the date of the intimation) to the stock exchange prior to holding a board meeting to consider quarterly or annual financial results."
          }
        },
        {
          "@type": "Question",
          "name": "Where can I view official financial result PDF disclosures filed with BSE?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "BSE Nexus provides direct 1-click links to the official BSE India XBRL and PDF filings containing standalone and consolidated balance sheets, profit and loss statements, and investor presentations."
          }
        }
      ]
    }, null, 2);

    transformed = transformed.replace(
      '</head>',
      `  <script type="application/ld+json">\n${faqSchema}\n  </script>\n</head>`
    );
  } else if (normalizedKey === "announcements") {
    const announcementsSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": "https://bsenexus.in/announcements#feed",
      "name": "Live BSE Corporate Announcements & Disclosures Feed",
      "url": "https://bsenexus.in/announcements",
      "description": "Live real-time stream of Bombay Stock Exchange (BSE India) corporate announcements, SEBI LODR Regulation 30/33 disclosures, board meeting intimations, quarterly financial results, and AI-powered earnings metric summaries.",
      "mainEntity": {
        "@type": "ItemList",
        "name": "Latest BSE Corporate Filings",
        "numberOfItems": 4,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "RELIANCE INDUSTRIES LTD. - Financial Results (SEBI LODR 33)",
            "url": "https://bsenexus.in/company/RELIANCE"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "TATA CONSULTANCY SERVICES LTD. - Audited Results & Dividend Declaration",
            "url": "https://bsenexus.in/company/TCS"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "LARSEN & TOUBRO LTD. - Order Win Disclosure under Regulation 30",
            "url": "https://bsenexus.in/company/LT"
          },
          {
            "@type": "ListItem",
            "position": 4,
            "name": "INFOSYS LTD. - Schedule of Earnings Conference Call",
            "url": "https://bsenexus.in/company/INFY"
          }
        ]
      }
    }, null, 2);

    transformed = transformed.replace(
      '</head>',
      `  <script type="application/ld+json">\n${announcementsSchema}\n  </script>\n</head>`
    );
  }

  return transformed;
}

// Helper to compute Cloudflare edge and browser Cache-Control headers for SPA routes
function getSpaRouteCacheControl(reqPath: string): string {
  const p = reqPath.toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/') {
    // 1. / (homepage)
    return 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
  }
  if (p === '/results-calendar') {
    // 4. /results-calendar
    return 'public, max-age=300, s-maxage=1800, stale-while-revalidate=1800';
  }
  if (p.startsWith('/company/') || p.startsWith('/stock/')) {
    // 2. /company/:symbol
    return 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
  }
  if (p === '/guides' || p.startsWith('/guides/')) {
    // 3. /guides and /guides/:slug
    return 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
  }
  // Other SPA shell pages (e.g. /announcements, /watchlist)
  return 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // In development mode, allow verifying tab-specific SEO metadata in responses with proper headers
    app.get(["/", "/announcements", "/live", "/results-calendar", "/watchlist", "/watchlists", "/companies", "/about", "/contact", "/disclaimer", "/privacy-policy", "/terms"], async (req, res, next) => {
      let tab = req.query.tab as string | undefined;
      if (!tab) {
        if (req.path === '/announcements') tab = 'announcements';
        else if (req.path === '/live') tab = 'announcements';
        else if (req.path === '/results-calendar') tab = 'results-calendar';
        else if (req.path === '/watchlist' || req.path === '/watchlists') tab = 'watchlists';
        else if (req.path === '/companies') tab = 'companies';
        else if (req.path === '/about') tab = 'about';
        else if (req.path === '/contact') tab = 'contact';
        else if (req.path === '/disclaimer') tab = 'disclaimer';
        else if (req.path === '/privacy-policy') tab = 'privacy';
        else if (req.path === '/terms') tab = 'terms';
      }
      try {
        const rawIndexHtml = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
        const transformedHtml = await vite.transformIndexHtml(req.originalUrl, rawIndexHtml);
        const finalHtml = injectTabSeoMetadata(transformedHtml, tab);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", getSpaRouteCacheControl(req.path));
        return res.send(finalHtml);
      } catch (e) {
        next(e);
      }
    });

    // Intercept invalid HTML navigation requests so they return real 404 instead of silent homepage fallback
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const p = req.path;
      if (
        p === '/' ||
        p === '/announcements' ||
        p === '/results-calendar' ||
        p === '/watchlist' ||
        p === '/watchlists' ||
        p === '/companies' ||
        p === '/about' ||
        p === '/contact' ||
        p === '/disclaimer' ||
        p === '/privacy-policy' ||
        p === '/terms' ||
        p.startsWith('/@') ||
        p.startsWith('/src') ||
        p.startsWith('/node_modules') ||
        p.startsWith('/api') ||
        p.startsWith('/auth') ||
        p.startsWith('/company/') ||
        p.startsWith('/stock/') ||
        p.startsWith('/guides/') ||
        p.startsWith('/announcement/') ||
        p.startsWith('/embed/') ||
        p.includes('.')
      ) {
        return next();
      }
      return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderGeneral404Page(p));
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    let cachedIndexHtml = "";
    const getIndexHtml = () => {
      if (!cachedIndexHtml) {
        cachedIndexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
      }
      return cachedIndexHtml;
    };

    // Serve static assets without auto-serving index.html so navigation requests are processed by SEO middleware
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
        }
      }
    }));

    // Server-side HTML renderer with tab-specific SEO metadata & ETag cache
    const VALID_SPA_ROUTES = new Set([
      '/',
      '/announcements',
      '/live',
      '/results-calendar',
      '/watchlist',
      '/watchlists',
      '/companies',
      '/about',
      '/contact',
      '/disclaimer',
      '/privacy-policy',
      '/terms'
    ]);
    const tabHtmlCache = new Map<string, { html: string; etag: string }>();
    app.get("*", (req, res) => {
      // If the path is not a valid SPA route, return a true 404 instead of silent homepage fallback!
      if (!VALID_SPA_ROUTES.has(req.path)) {
        return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(renderGeneral404Page(req.path));
      }

      let tabParam = typeof req.query.tab === "string" ? req.query.tab.trim().toLowerCase() : "";
      if (!tabParam) {
        if (req.path === '/announcements') tabParam = 'announcements';
        else if (req.path === '/live') tabParam = 'announcements';
        else if (req.path === '/results-calendar') tabParam = 'results-calendar';
        else if (req.path === '/watchlist' || req.path === '/watchlists') tabParam = 'watchlists';
        else if (req.path === '/companies') tabParam = 'companies';
        else if (req.path === '/about') tabParam = 'about';
        else if (req.path === '/contact') tabParam = 'contact';
        else if (req.path === '/disclaimer') tabParam = 'disclaimer';
        else if (req.path === '/privacy-policy') tabParam = 'privacy';
        else if (req.path === '/terms') tabParam = 'terms';
        else tabParam = 'default';
      }
      const clientEtag = req.headers['if-none-match'];

      let cached = tabHtmlCache.get(tabParam);
      if (!cached) {
        try {
          const rawHtml = getIndexHtml();
          const tab = tabParam !== 'default' ? tabParam : undefined;
          const html = injectTabSeoMetadata(rawHtml, tab);
          const etag = pageRenderCache.generateEtag(html);
          cached = { html, etag };
          tabHtmlCache.set(tabParam, cached);
        } catch {
          return res.sendFile(path.join(distPath, "index.html"));
        }
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('ETag', cached.etag);
      res.setHeader('Cache-Control', getSpaRouteCacheControl(req.path));
      if (clientEtag && clientEtag === cached.etag) {
        return res.status(304).end();
      }
      res.send(cached.html);
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT}`);
    try { await addLog('INFO', 'SYSTEM', 'BSE Nexus Server Started'); } catch(e) { console.error('DB connect err:', e); }
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.TEST_RUNNER && !process.argv.some(a => a.includes('test'))) {
  startServer();
}
