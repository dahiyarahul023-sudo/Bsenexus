import { addLog } from '../database/logDao.js';
import { isAnnouncementProcessed, saveAnnouncement, saveAnnouncementsBatch, flushLocalDiskSave, getTotalAnnouncementsCount } from '../database/announcementDao.js';
import { getScripCodeForSymbolOrName, determinePriority, isSymbolMatch } from '../utils/helpers.js';
import { resolveStockDetails } from '../utils/stockResolver.js';
import { getActiveWatchlistSymbols } from '../database/watchlistDao.js';
import { invalidateEnrichedCalendarCache } from './resultsCalendarService.js';
import { bseCircuitBreaker } from '../utils/circuitBreaker.js';

let bseHealth = { status: 'unknown', latency: 0 };
let lastBseErrorDetails = "No recent errors";
let lastBackupStalenessSec: number | null = null;
let lastBackupCheckTime = 0;

export function getBseHealth() {
  return bseHealth;
}

export function getLastBseError(): string {
  return lastBseErrorDetails;
}

export function getBackupStalenessMetrics() {
  return {
    stalenessSec: lastBackupStalenessSec,
    lastChecked: lastBackupCheckTime,
    status: lastBackupStalenessSec === null ? 'UNKNOWN' : (lastBackupStalenessSec <= 20 ? 'OPTIMAL' : 'LAGGING')
  };
}

interface BrowserProfile {
  ua: string;
  platform: string;
  brands: string;
}

const ROTATING_BROWSER_PROFILES: BrowserProfile[] = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    platform: '"Windows"',
    brands: '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"'
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    platform: '"macOS"',
    brands: '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"'
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    platform: '"Windows"',
    brands: '"Chromium";v="130", "Microsoft Edge";v="130", "Not?A_Brand";v="99"'
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    platform: '"Linux"',
    brands: '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"'
  }
];

let userAgentIndex = 0;
function getNextBrowserHeaders() {
  const profile = ROTATING_BROWSER_PROFILES[userAgentIndex % ROTATING_BROWSER_PROFILES.length];
  userAgentIndex++;
  return {
    "User-Agent": profile.ua,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.bseindia.com",
    "Referer": "https://www.bseindia.com/corporates/ann.html",
    "sec-ch-ua": profile.brands,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": profile.platform,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };
}

// Fast adaptive backoffs (500ms, 1500ms, 3000ms) to ensure rapid recovery
const RETRY_BACKOFF_DELAYS = [500, 1500, 3000];

export function getBseISTDate(offsetDays: number = 0): string {
  // IST is UTC + 5:30
  const now = new Date(Date.now() + (5.5 * 60 * 60 * 1000) - (offsetDays * 24 * 60 * 60 * 1000));
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function fetchWithHardenedRetries(url: string, timeoutMs: number = 3000, maxRetries: number = 2): Promise<any[] | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const headers = getNextBrowserHeaders();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        if (res.status === 403) {
          lastBseErrorDetails = "HTTP 403 Forbidden (BSE Akamai Edge WAF rate limit or cloud IP block)";
        } else if (res.status >= 500) {
          lastBseErrorDetails = `HTTP ${res.status} (BSE Server Maintenance / Outage)`;
        } else {
          lastBseErrorDetails = `HTTP ${res.status} response from BSE`;
        }

        if (attempt < maxRetries) {
          const delay = RETRY_BACKOFF_DELAYS[attempt] || 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return null;
      }

      const txt = await res.text();
      if (!txt || txt.includes("No Record") || txt.trim() === "{}" || txt.trim() === "[]") return [];
      const data = JSON.parse(txt);
      if (data && data.Table && Array.isArray(data.Table)) {
        return data.Table;
      }
      if (Array.isArray(data)) return data;
      return [];
    } catch (err: any) {
      lastBseErrorDetails = err?.name === 'AbortError' ? 'Connection Timeout' : (err?.message || 'Network Error');
      if (attempt < maxRetries) {
        const delay = RETRY_BACKOFF_DELAYS[attempt] || 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return null;
}

async function fetchSingleBsePage(
  page: number, 
  scripCode: string = '', 
  apiType: string = 'AnnSubCategoryGetData', 
  timeoutMs: number = 3000,
  targetDate?: string,
  maxRetries: number = 1
) {
  // Validate and whitelist parameters against injection
  const safeApiType = (apiType === 'AnnGetData') ? 'AnnGetData' : 'AnnSubCategoryGetData';
  const cleanScrip = (scripCode && /^\d{1,8}$/.test(scripCode.trim())) ? scripCode.trim() : '';
  const safePage = Math.max(1, Math.min(100, Math.floor(page) || 1));

  let prevDate: string;
  let toDate: string;
  let searchType: string;

  if (cleanScrip) {
    // When searching for a specific stock/scripCode (e.g. watchlist sync or historical results),
    // BSE accepts a date range with strSearch=P
    prevDate = getBseISTDate(180);
    toDate = getBseISTDate(0);
    searchType = 'P';
  } else {
    // For general market announcements feed, BSE requires matching from/to date (YYYYMMDD)
    const dateStr = targetDate || getBseISTDate(0);
    prevDate = dateStr;
    toDate = dateStr;
    searchType = 'D';
  }

  // Add cache-busting timestamp (_cb) to prevent stale edge cache responses from Akamai CDN
  const url = `https://api.bseindia.com/BseIndiaAPI/api/${safeApiType}/w?pageno=${safePage}&strCat=-1&strPrevDate=${prevDate}&strScrip=${cleanScrip}&strSearch=${searchType}&strToDate=${toDate}&strType=C&_cb=${Date.now()}`;
  
  return await bseCircuitBreaker.execute(
    async () => {
      return await fetchWithHardenedRetries(url, timeoutMs, maxRetries);
    },
    (_err) => {
      // Graceful fallback when circuit breaker is OPEN or request failed
      return null;
    },
    timeoutMs * (maxRetries + 1)
  );
}

function parseItemTimestamp(item: any): number {
  if (!item) return 0;
  const raw = item.News_submission_dt || item.DT_TM || item.NEWS_DT || "";
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  if (!isNaN(parsed)) return parsed;
  return 0;
}

export async function testBSEConnection() {
  const start = Date.now();
  const todayDate = getBseISTDate(0);

  // Check circuit breaker state first
  const breakerState = bseCircuitBreaker.getState();
  if (breakerState === 'OPEN') {
    bseHealth = { status: 'down', latency: -1 };
    return { 
      success: false, 
      error: "BSE API circuit breaker is currently OPEN (cooling down to protect server resources). Will retry automatically." 
    };
  }

  // Try primary endpoint first, then fallback endpoints ONLY if null (network/HTTP failure)
  let table = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 10000, todayDate);
  if (table === null) {
    table = await fetchSingleBsePage(1, '', 'AnnGetData', 10000, todayDate);
  }
  if (table === null) {
    table = await fetchSingleBsePage(1, '500325', 'AnnSubCategoryGetData', 10000); // Reliance scrip code
  }

  const latency = Date.now() - start;
  if (table && table.length > 0) {
    bseHealth = { status: 'stable', latency };
    const firstItem = table[0];
    const company = firstItem.SLONGNAME || firstItem.NEWSSUB || firstItem.scrip_cd || "BSE Stock";
    return { success: true, company, count: table.length };
  } else if (Array.isArray(table)) {
    bseHealth = { status: 'stable', latency };
    return { success: true, company: "BSE Connected", count: 0 };
  } else {
    bseHealth = { status: 'down', latency: -1 };
    return { success: false, error: "BSE API temporarily unreachable. Will retry automatically on next interval." };
  }
}

export async function fetchParallelBackupSource(): Promise<{ items: any[]; source: string; latestTs: number }> {
  const todayDate = getBseISTDate(0);
  const backupItems = await fetchSingleBsePage(1, '', 'AnnGetData', 3000, todayDate) || [];
  let latestTs = 0;
  for (const it of backupItems) {
    const ts = parseItemTimestamp(it);
    if (ts > latestTs) latestTs = ts;
  }
  return { items: backupItems, source: 'PARALLEL_BACKUP', latestTs };
}

export async function fetchBSEAnnouncements() {
  const start = Date.now();
  const todayDate = getBseISTDate(0);
  let source = 'BSE_PRIMARY';
  
  // Primary live endpoint: AnnSubCategoryGetData page 1 returns ~50 latest filings instantly
  let table = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 2500, todayDate);
  
  // If primary failed (null), IMMEDIATELY attempt Parallel Backup without long waiting
  if (table === null) {
    source = 'PARALLEL_BACKUP';
    table = await fetchSingleBsePage(1, '', 'AnnGetData', 3000, todayDate);
    if (table) {
      await addLog('INFO', 'POLLER', `Primary BSE endpoint degraded; successfully switched to PARALLEL_BACKUP in ${Date.now() - start}ms`);
    }
  } else {
    // Primary succeeded: Periodically or asynchronously sample backup to measure staleness vs BSE Primary
    const now = Date.now();
    if (now - lastBackupCheckTime > 60000) { // Check every 60 seconds to conserve requests
      lastBackupCheckTime = now;
      fetchParallelBackupSource().then(backupRes => {
        if (backupRes.items.length > 0 && table && table.length > 0) {
          const primaryLatestTs = Math.max(...table.map((i: any) => parseItemTimestamp(i)));
          const backupLatestTs = backupRes.latestTs;
          if (primaryLatestTs > 0 && backupLatestTs > 0) {
            const stalenessSec = Math.max(0, Math.round((primaryLatestTs - backupLatestTs) / 1000));
            lastBackupStalenessSec = stalenessSec;
            if (stalenessSec > 20) {
              addLog('WARNING', 'BACKUP_METRICS', `PARALLEL_BACKUP staleness is ${stalenessSec}s (> 20s threshold). Primary latest: ${new Date(primaryLatestTs).toISOString()}, Backup latest: ${new Date(backupLatestTs).toISOString()}`);
            }
          }
        }
      }).catch(() => {});
    }
  }

  // If today is early morning / late night in India with fewer than 30 filings,
  // also fetch yesterday's filings so that the latest feed is rich and continuous!
  if (table && Array.isArray(table) && table.length < 30) {
    const yesterdayDate = getBseISTDate(1);
    const yestItems = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 2500, yesterdayDate) || [];
    table = [...table, ...yestItems];
  } else if (table && Array.isArray(table) && table.length >= 45) {
    // If today's page 1 is near-full (>= 45 items), volume is high; fetch page 2
    const page2 = await fetchSingleBsePage(2, '', 'AnnSubCategoryGetData', 2500, todayDate) || [];
    if (page2.length > 0) {
      table = [...table, ...page2];
    }
  }

  const totalLatency = Date.now() - start;

  if (table && Array.isArray(table) && table.length > 0) {
    bseHealth = { status: totalLatency > 3000 ? 'degraded' : 'stable', latency: Math.round(totalLatency) };
    
    // Deduplicate by NEWSID and attach diagnostic metadata
    const uniqueMap = new Map();
    for (const item of table) {
      if (item.NEWSID && !uniqueMap.has(item.NEWSID)) {
        item._source = source;
        item._fetchLatency = totalLatency;
        uniqueMap.set(item.NEWSID, item);
      }
    }
    return Array.from(uniqueMap.values());
  }
  
  if (table !== null) {
    bseHealth = { status: 'stable', latency: Math.round(totalLatency) };
    return [];
  }
  bseHealth = { status: 'down', latency: -1 };
  return null;
}

export async function syncWatchlistHistoricalData() {
  try {
    const activeSymbols = await getActiveWatchlistSymbols();
    if (!activeSymbols || activeSymbols.length === 0) {
      return { success: true, count: 0, symbolsCount: 0 };
    }

    let totalSaved = 0;
    
    // 1. Fetch latest live page 1 to ensure fresh general filings are captured
    const liveItems = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 3000);
    const announcementsToSave: any[] = [];
    if (liveItems && Array.isArray(liveItems)) {
      for (const item of liveItems) {
        const newsId = item.NEWSID;
        if (!newsId) continue;

        const companyName = item.SLONGNAME || item.scrip_cd || "BSE Stock";
        const subject = item.NEWSSUB || "No Subject";
        const details = item.HEADLINE || "";
        const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || '');

        let isWatchlistMatch = false;
        for (const sym of activeSymbols) {
          if (isSymbolMatch(companyName, subject, sym, scrip_cd)) {
            isWatchlistMatch = true;
            break;
          }
        }

        if (isWatchlistMatch) {
          const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
          const priority = determinePriority(subject, details);
          
          announcementsToSave.push({
            newsId,
            companyName,
            subject,
            details,
            pdfLink,
            scrip_cd,
            bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
            priority: priority.level,
            category: priority.category,
            isWatchlist: true
          });
        }
      }
    }

    if (announcementsToSave.length > 0) {
      const res = await saveAnnouncementsBatch(announcementsToSave);
      totalSaved += (res.inserted + res.updated);
    }

    // 2. Fetch historical announcements per scrip code for each symbol in active Watchlists
    const processedScripCodes = new Set<string>();
    
    // Batch process 10 symbols concurrently for speed
    const batchSize = 10;
    for (let i = 0; i < activeSymbols.length; i += batchSize) {
      const batch = activeSymbols.slice(i, i + batchSize);
      await Promise.all(batch.map(async (sym) => {
        let scripCode = getScripCodeForSymbolOrName(sym);
        if (!scripCode) {
          const resolved = await resolveStockDetails(sym);
          if (resolved) scripCode = resolved.scripCode;
        }

        if (!scripCode || processedScripCodes.has(scripCode)) return;
        processedScripCodes.add(scripCode);

        // Fetch latest filings for this scripCode (page 1 is sufficient; older data is already cached)
        const page1 = await fetchSingleBsePage(1, scripCode, 'AnnSubCategoryGetData', 4000) || [];
        let scripItems = page1;

        if (scripItems.length === 0) {
          const fb1 = await fetchSingleBsePage(1, scripCode, 'AnnGetData', 4000) || [];
          scripItems = fb1;
        }

        if (scripItems && Array.isArray(scripItems)) {
          const scripAnnouncements: any[] = [];
          for (const item of scripItems) {
            const newsId = item.NEWSID;
            if (!newsId) continue;

            const companyName = item.SLONGNAME || item.scrip_cd || sym;
            const subject = item.NEWSSUB || "No Subject";
            const details = item.HEADLINE || "";
            const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || scripCode);

            const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
            const priority = determinePriority(subject, details);

            scripAnnouncements.push({
              newsId,
              companyName,
              subject,
              details,
              pdfLink,
              scrip_cd,
              bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
              priority: priority.level,
              category: priority.category,
              isWatchlist: true
            });
          }

          if (scripAnnouncements.length > 0) {
            const res = await saveAnnouncementsBatch(scripAnnouncements);
            totalSaved += (res.inserted + res.updated);
          }
        }
      }));
    }

    flushLocalDiskSave();
    invalidateEnrichedCalendarCache();
    const totalInRepo = getTotalAnnouncementsCount();

    await addLog('INFO', 'BSE', `Watchlist historical sync complete: ${totalInRepo} total records in repository (+${totalSaved} filings processed across ${activeSymbols.length} active watchlist stocks)`);
    return { success: true, count: totalInRepo, newlyLoaded: totalSaved, symbolsCount: activeSymbols.length };
  } catch (err: any) {
    await addLog('ERROR', 'BSE', `Watchlist sync failed: ${err?.message || err}`);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function syncSingleStockHistoricalData(symbolOrScrip: string): Promise<{ success: boolean; count: number; scripCode?: string; symbol?: string; newlyLoaded?: number; error?: string }> {
  try {
    if (!symbolOrScrip) return { success: false, count: 0, error: "Symbol or Scrip Code is required" };
    
    // Resolve scrip code dynamically
    let scripCode = getScripCodeForSymbolOrName(symbolOrScrip);
    let resolvedSym = symbolOrScrip.toUpperCase().trim();

    if (!scripCode) {
      const resolved = await resolveStockDetails(symbolOrScrip);
      if (resolved) {
        scripCode = resolved.scripCode;
        resolvedSym = resolved.symbol;
      }
    }

    if (!scripCode) {
      await addLog('WARNING', 'BSE', `Could not resolve BSE Scrip Code for "${symbolOrScrip}". Data sync will rely on general feed.`);
      return { success: false, count: 0, error: `BSE Scrip Code not found for ${symbolOrScrip}` };
    }

    await addLog('INFO', 'BSE', `Initiating live data fetch for ${resolvedSym} (BSE Scrip: ${scripCode})...`);

    // Fetch page 1 from AnnSubCategoryGetData and AnnGetData
    let totalSaved = 0;
    const page1 = await fetchSingleBsePage(1, scripCode, 'AnnSubCategoryGetData', 5000);
    let items = page1 || [];

    if (items.length === 0) {
      const fb1 = await fetchSingleBsePage(1, scripCode, 'AnnGetData', 5000);
      items = fb1 || [];
    }

    if (items && Array.isArray(items)) {
      const stockAnnouncements: any[] = [];
      for (const item of items) {
        const newsId = item.NEWSID;
        if (!newsId) continue;

        const companyName = item.SLONGNAME || item.scrip_cd || resolvedSym;
        const subject = item.NEWSSUB || "No Subject";
        const details = item.HEADLINE || "";
        const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || scripCode);

        const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
        const priority = determinePriority(subject, details);

        stockAnnouncements.push({
          newsId,
          companyName,
          subject,
          details,
          pdfLink,
          scrip_cd,
          bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
          priority: priority.level,
          category: priority.category,
          isWatchlist: true
        });
      }

      if (stockAnnouncements.length > 0) {
        const res = await saveAnnouncementsBatch(stockAnnouncements);
        totalSaved += (res.inserted + res.updated);
      }
    }

    flushLocalDiskSave();
    invalidateEnrichedCalendarCache();
    const totalInRepo = getTotalAnnouncementsCount();

    await addLog('INFO', 'BSE', `Synced ${totalSaved} filings for ${resolvedSym} (BSE: ${scripCode}). Total repository records: ${totalInRepo}`);
    return { success: true, count: totalInRepo, newlyLoaded: totalSaved, scripCode, symbol: resolvedSym };
  } catch (err: any) {
    await addLog('ERROR', 'BSE', `Single stock sync error for ${symbolOrScrip}: ${err.message}`);
    return { success: false, count: 0, error: err.message };
  }
}

export async function backfillRecentAnnouncements(daysBack = 4) {
  try {
    const activeSymbols = await getActiveWatchlistSymbols().catch(() => []);
    let totalIngested = 0;
    
    // Scan through dates from today backwards to daysBack
    for (let offset = 0; offset <= daysBack; offset++) {
      const dateStr = getBseISTDate(offset);
      // Fetch up to 3 pages per date (50 items each)
      for (let p = 1; p <= 3; p++) {
        const items = await fetchSingleBsePage(p, '', 'AnnSubCategoryGetData', 5000, dateStr);
        if (!items || items.length === 0) break;

        const pageAnnouncements: any[] = [];
        for (const item of items) {
          const newsId = item.NEWSID;
          if (!newsId) continue;
          if (await isAnnouncementProcessed(newsId)) continue;

          const companyName = item.SLONGNAME || item.scrip_cd || "BSE Stock";
          const subject = item.NEWSSUB || "No Subject";
          const details = item.HEADLINE || "";
          const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || '');

          const isWatchlist = activeSymbols.some(sym => isSymbolMatch(companyName, subject, sym, scrip_cd));
          const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
          const priority = determinePriority(subject, details);

          pageAnnouncements.push({
            newsId,
            companyName,
            subject,
            details,
            pdfLink,
            scrip_cd,
            bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
            priority: priority.level,
            category: priority.category,
            isWatchlist
          });
        }

        if (pageAnnouncements.length > 0) {
          const res = await saveAnnouncementsBatch(pageAnnouncements);
          totalIngested += (res.inserted + res.updated);
        }

        // If page has fewer than 50 items, no need to query subsequent pages for this date
        if (items.length < 50) break;
      }
    }

    if (totalIngested > 0) {
      flushLocalDiskSave();
      invalidateEnrichedCalendarCache();
      await addLog('INFO', 'BSE', `Backfilled ${totalIngested} recent announcements across last ${daysBack} days`);
    }
    return { success: true, count: totalIngested };
  } catch (err: any) {
    console.error("Backfill announcements error:", err.message);
    return { success: false, error: err.message };
  }
}



