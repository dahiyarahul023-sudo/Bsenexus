import { createHash } from 'crypto';
import { getActiveWatchlistSymbols, getAllWatchlists, extractSymbol } from '../database/watchlistDao.js';
import { sendToTelegram } from './telegram.js';
import { addLog } from '../database/logDao.js';
import { getSettings } from '../database/settingsDao.js';
import { getAllUserProfiles, getUserProfile } from '../database/usersDao.js';
import { readLocalJson, writeLocalJson, isFirestoreQuotaExceeded, isAdminPermissionDenied } from '../database/localStore.js';
import { adminDb } from '../database/firebase.js';

export interface StockNewsItem {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  timeAgo: string;
  source: 'Economic Times' | 'LiveMint' | 'Moneycontrol' | 'Business Standard' | 'Financial Express' | string;
  sourceSlug: 'et' | 'mint' | 'moneycontrol' | 'bs' | 'fe' | string;
  snippet: string;
  symbol?: string;
  companyName?: string;
  category: 'market' | 'watchlist' | 'earnings' | 'regulatory' | 'corporate';
  sentiment?: 'positive' | 'negative' | 'neutral';
  isWatchlist?: boolean;
}

export interface NewsSourceConfig {
  name: 'Economic Times' | 'LiveMint' | 'Moneycontrol' | 'Business Standard';
  slug: 'et' | 'mint' | 'moneycontrol' | 'bs';
  url: string;
  category: StockNewsItem['category'];
}

// Comprehensive Multi-Source Financial RSS Feeds
export const NEWS_FEEDS: NewsSourceConfig[] = [
  // 1. The Economic Times
  { name: 'Economic Times', slug: 'et', url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms', category: 'corporate' },
  { name: 'Economic Times', slug: 'et', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', category: 'market' },
  { name: 'Economic Times', slug: 'et', url: 'https://economictimes.indiatimes.com/news/company/corporate-trends/rssfeeds/2143429.cms', category: 'corporate' },
  { name: 'Economic Times', slug: 'et', url: 'https://economictimes.indiatimes.com/markets/stocks/earnings/rssfeeds/2146843.cms', category: 'earnings' },
  { name: 'Economic Times', slug: 'et', url: 'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms', category: 'market' },

  // 2. LiveMint
  { name: 'LiveMint', slug: 'mint', url: 'https://www.livemint.com/rss/companies', category: 'corporate' },
  { name: 'LiveMint', slug: 'mint', url: 'https://www.livemint.com/rss/markets', category: 'market' },
  { name: 'LiveMint', slug: 'mint', url: 'https://www.livemint.com/rss/industry', category: 'market' },
  { name: 'LiveMint', slug: 'mint', url: 'https://www.livemint.com/rss/money', category: 'corporate' },

  // 3. Moneycontrol
  { name: 'Moneycontrol', slug: 'moneycontrol', url: 'https://www.moneycontrol.com/rss/business.xml', category: 'corporate' },
  { name: 'Moneycontrol', slug: 'moneycontrol', url: 'https://www.moneycontrol.com/rss/MCtopnews.xml', category: 'market' },
  { name: 'Moneycontrol', slug: 'moneycontrol', url: 'https://www.moneycontrol.com/rss/results.xml', category: 'earnings' },
  { name: 'Moneycontrol', slug: 'moneycontrol', url: 'https://www.moneycontrol.com/rss/latestnews.xml', category: 'corporate' },

  // 4. Business Standard
  { name: 'Business Standard', slug: 'bs', url: 'https://www.business-standard.com/rss/companies-101.rss', category: 'corporate' },
  { name: 'Business Standard', slug: 'bs', url: 'https://www.business-standard.com/rss/markets-106.rss', category: 'market' },
  { name: 'Business Standard', slug: 'bs', url: 'https://www.business-standard.com/rss/finance-103.rss', category: 'market' }
];

// In-memory cache for speed and resilience
interface MultiSourceNewsCache {
  allNews: StockNewsItem[];
  lastFetchTime: number;
  sourceCounts: Record<string, number>;
}

const newsCache: MultiSourceNewsCache = {
  allNews: [],
  lastFetchTime: 0,
  sourceCounts: {}
};

// Tracking sent news alerts per user (persisted in localStore + Firestore)
const SENT_NEWS_ALERTS_FILE = 'sent_news_alerts.json';
let sentNewsAlertsMemory = new Map<string, number>(); // key: `${targetChatId}_${newsId}`, value: timestamp

// Initialize sent alerts cache
(function initSentNewsCache() {
  const diskData = readLocalJson<Record<string, number>>(SENT_NEWS_ALERTS_FILE, {});
  const now = Date.now();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days retention

  for (const [key, ts] of Object.entries(diskData)) {
    if (now - ts < maxAgeMs) {
      sentNewsAlertsMemory.set(key, ts);
    }
  }
})();

function saveSentNewsMemoryToDisk() {
  const obj: Record<string, number> = {};
  const now = Date.now();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

  for (const [key, ts] of sentNewsAlertsMemory.entries()) {
    if (now - ts < maxAgeMs) {
      obj[key] = ts;
    }
  }
  writeLocalJson(SENT_NEWS_ALERTS_FILE, obj);
}

export function isNewsAlertSentToTarget(targetId: string, newsId: string): boolean {
  const key = `${targetId}_${newsId}`;
  return sentNewsAlertsMemory.has(key);
}

export async function markNewsAlertSentToTarget(targetId: string, newsId: string): Promise<void> {
  const key = `${targetId}_${newsId}`;
  const now = Date.now();
  sentNewsAlertsMemory.set(key, now);
  saveSentNewsMemoryToDisk();

  // Async log to Firestore if available
  if (!isFirestoreQuotaExceeded() && !isAdminPermissionDenied()) {
    try {
      await adminDb.collection('sent_news_alerts').doc(key.replace(/[^a-zA-Z0-9_\-]/g, '_')).set({
        targetId,
        newsId,
        sentAt: now
      });
    } catch (e) {
      // Non-blocking
    }
  }
}

// Clean HTML tags, CDATA artifacts, image tags, and decode HTML entities
function cleanHtml(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/gi, '')
    .replace(/\]\]&gt;/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Strip img tags and all HTML tags
  text = text.replace(/<img[^>]*>/gi, ' ');
  text = text.replace(/<[^>]*>/g, ' ');

  // Secondary cleanup in case residual CDATA markers remained
  text = text.replace(/\]\]>/g, '').replace(/<!\[CDATA\[/g, '');

  return text.replace(/\s+/g, ' ').trim();
}

function cleanSnippet(raw: string, title: string): string {
  if (!raw) return '';
  const decoded = cleanHtml(raw);
  // Remove trailing URLs, source tags, tracking parameters
  const withoutUrls = decoded
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/(economictimes|livemint|moneycontrol|business-standard)\.com\S*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !withoutUrls ||
    withoutUrls.length < 15 ||
    withoutUrls.toLowerCase() === title.toLowerCase() ||
    withoutUrls.includes('href=') ||
    withoutUrls.includes('target=') ||
    withoutUrls.startsWith('<a')
  ) {
    return '';
  }
  return withoutUrls;
}

function calculateTimeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 0) return 'Just now';
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
}

function detectSentiment(title: string, snippet: string): 'positive' | 'negative' | 'neutral' {
  const text = (title + ' ' + snippet).toLowerCase();
  const posWords = [
    'surge', 'jumps', 'rallies', 'profit up', 'growth', 'soars', 'bullish', 'gains', 'beats',
    'order win', 'dividend', 'expands', 'upgrade', 'buy', 'target', 'record high', 'multibagger',
    'rises', 'skyrockets', 'bonus', 'acquisition', 'q1 profit', 'q2 profit', 'q3 profit', 'q4 profit',
    'net profit climbs', 'doubles', 'wins contract', 'strong results'
  ];
  const negWords = [
    'falls', 'slumps', 'drops', 'loss', 'decline', 'plunges', 'bearish', 'penalty', 'fraud',
    'investigation', 'downgrade', 'drags', 'cuts', 'sebi ban', 'raids', 'probe', 'weak', 'slips',
    'net loss', 'defaults', 'dispute', 'scam'
  ];
  
  let score = 0;
  for (const w of posWords) if (text.includes(w)) score++;
  for (const w of negWords) if (text.includes(w)) score--;

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function normalizeTitleForDeduplication(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50);
}

// Universal Multi-Source RSS XML Parser
function parseRssFeedXml(
  xml: string, 
  sourceConfig: NewsSourceConfig
): StockNewsItem[] {
  const items: StockNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemBlock = match[1];

    const titleMatch = itemBlock.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemBlock.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || itemBlock.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i);
    const pubDateMatch = itemBlock.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i);
    const descMatch = itemBlock.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

    let rawTitle = titleMatch ? titleMatch[1] : '';
    let link = linkMatch ? linkMatch[1].trim() : '';
    let pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();

    const title = cleanHtml(rawTitle);
    if (!title || title.length < 6) continue;

    const snippet = cleanSnippet(descMatch ? descMatch[1] : '', title);

    // Determine category
    let category: StockNewsItem['category'] = sourceConfig.category || 'market';
    const lower = (title + ' ' + snippet).toLowerCase();
    if (lower.includes('results') || lower.includes('quarter') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3') || lower.includes('q4') || lower.includes('earnings') || lower.includes('net profit') || lower.includes('net loss')) {
      category = 'earnings';
    } else if (lower.includes('sebi') || lower.includes('rbi') || lower.includes('regulatory') || lower.includes('penalty') || lower.includes('tax notice') || lower.includes('it department') || lower.includes('nclt')) {
      category = 'regulatory';
    } else if (lower.includes('shares') || lower.includes('stocks') || lower.includes('order win') || lower.includes('dividend') || lower.includes('board meeting') || lower.includes('demerger') || lower.includes('bonus issue') || lower.includes('acquisition') || lower.includes('stake')) {
      category = 'corporate';
    }

    const hashInput = `${sourceConfig.slug}|${link || title}|${pubDate}`;
    const id = `news_${sourceConfig.slug}_${createHash('md5').update(hashInput).digest('hex').slice(0, 16)}`;

    items.push({
      id,
      title,
      link: link || 'https://www.google.com/search?q=' + encodeURIComponent(title),
      publishedAt: pubDate,
      timeAgo: calculateTimeAgo(pubDate),
      source: sourceConfig.name,
      sourceSlug: sourceConfig.slug,
      snippet: snippet.length > 220 ? snippet.slice(0, 220) + '...' : snippet,
      category,
      sentiment: detectSentiment(title, snippet),
      isWatchlist: false
    });
  }

  return items;
}

// Fetch all multi-source financial RSS feeds with parallel requests & caching
export async function fetchAllMultiSourceNewsFeeds(forceRefresh = false): Promise<StockNewsItem[]> {
  const now = Date.now();
  // 3-minute in-memory cache for high velocity and low network latency
  if (!forceRefresh && newsCache.allNews.length > 0 && (now - newsCache.lastFetchTime < 3 * 60 * 1000)) {
    return newsCache.allNews;
  }

  const resultsMap = new Map<string, StockNewsItem>();
  const normalizedTitleMap = new Map<string, string>(); // Cross-publisher deduplication
  const sourceCountMap: Record<string, number> = {
    'Economic Times': 0,
    'LiveMint': 0,
    'Moneycontrol': 0,
    'Business Standard': 0
  };

  const feedPromises = NEWS_FEEDS.map(async (feed) => {
    try {
      const res = await fetch(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
        },
        signal: AbortSignal.timeout(6500)
      });

      if (res.ok) {
        const xml = await res.text();
        const parsed = parseRssFeedXml(xml, feed);

        parsed.forEach(item => {
          const normTitle = normalizeTitleForDeduplication(item.title);
          // If we haven't seen this exact link OR this normalized title across publishers
          if (!resultsMap.has(item.id) && !normalizedTitleMap.has(normTitle)) {
            resultsMap.set(item.id, item);
            normalizedTitleMap.set(normTitle, item.id);
            sourceCountMap[item.source] = (sourceCountMap[item.source] || 0) + 1;
          }
        });
      }
    } catch (e: any) {
      console.warn(`[StockNews] Error fetching ${feed.name} (${feed.url}):`, e.message);
    }
  });

  await Promise.allSettled(feedPromises);

  const sorted = Array.from(resultsMap.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  newsCache.allNews = sorted;
  newsCache.lastFetchTime = now;
  newsCache.sourceCounts = sourceCountMap;

  return sorted;
}

// Fetch General Market & Corporate News with optional source filter
export async function fetchGeneralMarketNews(
  forceRefresh = false,
  sourceSlug?: string
): Promise<StockNewsItem[]> {
  const all = await fetchAllMultiSourceNewsFeeds(forceRefresh);
  if (sourceSlug && sourceSlug !== 'all') {
    return all.filter(item => item.sourceSlug.toLowerCase() === sourceSlug.toLowerCase());
  }
  return all;
}

// Match news items with watchlist symbols & company names
export function matchStockInText(
  text: string,
  symbol: string,
  companyName?: string
): boolean {
  const lowerText = text.toLowerCase();
  const lowerSym = symbol.toLowerCase();

  // Word boundary regex for exact ticker symbol (e.g. \bTCS\b, \bINFY\b, \bRELIANCE\b)
  const symRegex = new RegExp(`\\b${lowerSym}\\b`, 'i');
  if (symRegex.test(text)) {
    return true;
  }

  if (companyName && companyName.trim().length > 3) {
    const cleanComp = companyName
      .toLowerCase()
      .replace(/\b(ltd|limited|industries|india|corp|corporation|bank|enterprise|enterprises|technologies)\b/gi, '')
      .trim();

    if (cleanComp.length >= 3 && lowerText.includes(cleanComp)) {
      return true;
    }
  }

  return false;
}

// Get combined Watchlist News from all sources for all tracked active stocks
export async function getWatchlistNews(
  userId?: string,
  sourceSlug?: string
): Promise<{ items: StockNewsItem[]; symbols: string[] }> {
  const watchlists = await getAllWatchlists(userId);
  const activeSymbols: { symbol: string; companyName?: string }[] = [];
  const symbolSet = new Set<string>();

  for (const wl of watchlists) {
    if (wl.is_active !== 0) {
      for (const item of (wl.items || [])) {
        const sym = extractSymbol(item).toUpperCase().trim();
        if (sym && !symbolSet.has(sym)) {
          symbolSet.add(sym);
          const customName = typeof item === 'object' && item.companyName ? item.companyName : undefined;
          activeSymbols.push({
            symbol: sym,
            companyName: customName || sym
          });
        }
      }
    }
  }

  if (activeSymbols.length === 0) {
    return { items: [], symbols: [] };
  }

  // Fetch all latest stories across all 4 news publishers
  let allStories = await fetchAllMultiSourceNewsFeeds(false);
  if (sourceSlug && sourceSlug !== 'all') {
    allStories = allStories.filter(item => item.sourceSlug.toLowerCase() === sourceSlug.toLowerCase());
  }

  const matchedItems: StockNewsItem[] = [];
  const seenIds = new Set<string>();

  // Check each news item against all watchlist symbols
  for (const story of allStories) {
    const searchTarget = `${story.title} ${story.snippet}`;

    for (const stock of activeSymbols) {
      if (matchStockInText(searchTarget, stock.symbol, stock.companyName)) {
        if (!seenIds.has(story.id)) {
          seenIds.add(story.id);
          matchedItems.push({
            ...story,
            symbol: stock.symbol,
            companyName: stock.companyName,
            category: story.category || 'corporate',
            isWatchlist: true
          });
        }
        break;
      }
    }
  }

  // Sort newest first
  matchedItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return {
    items: matchedItems,
    symbols: Array.from(symbolSet)
  };
}

// Fetch dedicated stock news for specific symbol from all sources
export async function fetchStockSpecificNews(
  symbol: string, 
  companyName?: string
): Promise<StockNewsItem[]> {
  const cleanSym = symbol.toUpperCase().trim();
  const all = await fetchAllMultiSourceNewsFeeds(false);

  const matches = all.filter(story => {
    const searchTarget = `${story.title} ${story.snippet}`;
    return matchStockInText(searchTarget, cleanSym, companyName);
  }).map(item => ({
    ...item,
    symbol: cleanSym,
    companyName: companyName || cleanSym,
    category: 'watchlist' as const,
    isWatchlist: true
  }));

  return matches;
}

// Forward specific News item to user's Telegram
export async function sendNewsToTelegram(
  newsItem: StockNewsItem,
  customChatId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const sentimentEmoji = newsItem.sentiment === 'positive' ? '🟢 Bullish' : newsItem.sentiment === 'negative' ? '🔴 Bearish' : '⚪ Neutral';
  const tag = newsItem.symbol ? `#${newsItem.symbol}` : '#MarketNews';
  const sourceSlug = newsItem.source.replace(/\s+/g, '');

  const message = [
    `📰 <b>${newsItem.source} News Alert: ${newsItem.symbol || 'Market Update'}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<b>${newsItem.title}</b>`,
    ``,
    newsItem.snippet ? `📝 <i>${newsItem.snippet}</i>\n` : '',
    `🏢 <b>Entity:</b> ${newsItem.companyName || newsItem.symbol || 'Indian Markets'}`,
    `📊 <b>Sentiment:</b> ${sentimentEmoji}`,
    `📰 <b>Publisher:</b> ${newsItem.source} (${newsItem.timeAgo})`,
    `🔗 <a href="${newsItem.link}">Read Full Article on ${newsItem.source}</a>`,
    ``,
    `🏷️ ${tag} #${sourceSlug} #BSENexus`
  ].filter(Boolean).join('\n');

  try {
    const res = await sendToTelegram(message, customChatId);
    if (res.success) {
      await addLog('INFO', 'TELEGRAM', `Sent ${newsItem.source} news "${newsItem.title.slice(0, 30)}..." to Telegram`);
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to dispatch news' };
  }
}

// Forward batch Watchlist Daily News Digest to Telegram
export async function sendWatchlistNewsDigestToTelegram(
  userId?: string,
  customChatId?: string | null
): Promise<{ success: boolean; count: number; error?: string }> {
  const { items, symbols } = await getWatchlistNews(userId);

  if (items.length === 0) {
    return { success: false, count: 0, error: 'No news found for your active watchlist stocks right now across financial sources' };
  }

  const topItems = items.slice(0, 6);
  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  const lines = [
    `📬 <b>Watchlist News Digest • Multi-Source (${topItems.length} Stories)</b>`,
    `🕒 <i>${nowStr} IST</i>`,
    `🎯 <b>Tracked:</b> ${symbols.slice(0, 8).join(', ')}${symbols.length > 8 ? ` +${symbols.length - 8} more` : ''}`,
    `━━━━━━━━━━━━━━━━━━━━`
  ];

  topItems.forEach((item, idx) => {
    const badge = item.sentiment === 'positive' ? '🟢' : item.sentiment === 'negative' ? '🔴' : '🔹';
    lines.push(
      `\n<b>${idx + 1}. ${badge} [${item.symbol || 'Stock'}] ${item.title}</b>`,
      `📰 <i>${item.source} (${item.timeAgo})</i>`,
      `🔗 <a href="${item.link}">Read on ${item.source}</a>`
    );
  });

  lines.push(`\n━━━━━━━━━━━━━━━━━━━━`, `⚡ Powered by BSE Nexus • ET, LiveMint, Moneycontrol & BS`);

  const fullText = lines.join('\n');
  const res = await sendToTelegram(fullText, customChatId);
  return { success: res.success, count: topItems.length, error: res.error };
}

// ─────────────────────────────────────────────────────────────────────────────
// 24/7 BACKGROUND CLOUD WORKER: Automated Watchlist News Dispatch to Telegram
// ─────────────────────────────────────────────────────────────────────────────
let isNewsWorkerRunning = false;

export async function processAutomatedNewsAlerts(): Promise<{ checked: number; dispatched: number }> {
  if (isNewsWorkerRunning) return { checked: 0, dispatched: 0 };
  isNewsWorkerRunning = true;

  try {
    const [settings, allUsers] = await Promise.all([
      getSettings(),
      getAllUserProfiles()
    ]);

    // Check if global bot token is available
    if (!settings.botToken) {
      return { checked: 0, dispatched: 0 };
    }

    // 1. Fetch latest multi-source news (cached for 3m)
    const latestNews = await fetchAllMultiSourceNewsFeeds(false);
    if (latestNews.length === 0) return { checked: 0, dispatched: 0 };

    // Filter to relatively recent news (published within last 4 hours)
    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    const recentNews = latestNews.filter(n => {
      const pubTime = new Date(n.publishedAt).getTime();
      return isNaN(pubTime) || pubTime >= fourHoursAgo;
    });

    let totalDispatched = 0;

    // Collect all recipient configurations:
    // (a) Registered users with Telegram Chat IDs and news alert enabled
    // (b) Global admin chat ID if autoTelegramNews is enabled in settings
    const recipients: {
      targetId: string;
      chatId: string;
      userId?: string;
      allowedSources?: string[];
      allowedCategories?: string[];
    }[] = [];

    // Global recipient
    if (settings.chatId && settings.autoTelegramNews !== false) {
      recipients.push({
        targetId: `global_${settings.chatId}`,
        chatId: settings.chatId,
        userId: undefined,
        allowedSources: settings.telegramNewsSources,
        allowedCategories: settings.telegramNewsCategories
      });
    }

    // User-specific recipients
    for (const u of allUsers) {
      if (u.telegramChatId && u.notificationPreferences?.telegramNewsAlerts !== false) {
        // Avoid duplicate if same as global
        if (u.telegramChatId !== settings.chatId) {
          recipients.push({
            targetId: `user_${u.uid}_${u.telegramChatId}`,
            chatId: u.telegramChatId,
            userId: u.uid,
            allowedSources: u.notificationPreferences?.telegramNewsSources,
            allowedCategories: u.notificationPreferences?.telegramNewsCategories
          });
        }
      }
    }

    if (recipients.length === 0) {
      return { checked: 0, dispatched: 0 };
    }

    // For each recipient, check their active watchlist
    for (const rec of recipients) {
      const { items: matchedNews } = await getWatchlistNews(rec.userId);

      for (const news of matchedNews) {
        // Filter by user's selected sources if configured
        if (rec.allowedSources && rec.allowedSources.length > 0 && !rec.allowedSources.includes(news.source)) {
          continue;
        }

        // Filter by user's selected categories if configured (e.g. ['all'] or ['earnings', 'corporate'])
        if (rec.allowedCategories && rec.allowedCategories.length > 0) {
          const isAll = rec.allowedCategories.some(c => c.toLowerCase() === 'all');
          if (!isAll && news.category && !rec.allowedCategories.includes(news.category)) {
            continue;
          }
        }

        // Check if this news item was already sent to this recipient
        if (!isNewsAlertSentToTarget(rec.targetId, news.id)) {
          // Send Telegram notification
          const sendRes = await sendNewsToTelegram(news, rec.chatId);
          if (sendRes.success) {
            await markNewsAlertSentToTarget(rec.targetId, news.id);
            totalDispatched++;
            await addLog('INFO', 'TELEGRAM', `Auto-dispatched 24/7 news for ${news.symbol || news.companyName} (${news.source} - ${news.category}) to Chat ${rec.chatId}`);
          }
        }
      }
    }

    return { checked: recentNews.length, dispatched: totalDispatched };
  } catch (err: any) {
    console.error('[StockNews Worker] Error processing 24/7 automated alerts:', err.message);
    return { checked: 0, dispatched: 0 };
  } finally {
    isNewsWorkerRunning = false;
  }
}
