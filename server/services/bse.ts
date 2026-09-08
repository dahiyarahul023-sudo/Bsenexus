import { addLog } from '../database/logDao.js';
import { isAnnouncementProcessed, saveAnnouncement, flushLocalDiskSave, getTotalAnnouncementsCount } from '../database/announcementDao.js';
import { symbolToScripCodeMap, stockMasterDatabase, getScripCodeForSymbolOrName, determinePriority, isSymbolMatch } from '../utils/helpers.js';
import { resolveStockDetails } from '../utils/stockResolver.js';
import { getActiveWatchlistSymbols } from '../database/watchlistDao.js';
import { invalidateEnrichedCalendarCache } from './resultsCalendarService.js';

let bseHealth = { status: 'unknown', latency: 0 };

export function getBseHealth() {
  return bseHealth;
}

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://www.bseindia.com",
  "Referer": "https://www.bseindia.com/",
  "Cache-Control": "no-cache"
};

export function getBseISTDate(offsetDays: number = 0): string {
  // IST is UTC + 5:30
  const now = new Date(Date.now() + (5.5 * 60 * 60 * 1000) - (offsetDays * 24 * 60 * 60 * 1000));
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function fetchSingleBsePage(
  page: number, 
  scripCode: string = '', 
  apiType: string = 'AnnSubCategoryGetData', 
  timeoutMs: number = 10000,
  targetDate?: string
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

  const url = `https://api.bseindia.com/BseIndiaAPI/api/${safeApiType}/w?pageno=${safePage}&strCat=-1&strPrevDate=${prevDate}&strScrip=${cleanScrip}&strSearch=${searchType}&strToDate=${toDate}&strType=C`;
  try {
    const res = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return null;
    const txt = await res.text();
    if (!txt || txt.includes("No Record") || txt.trim() === "{}" || txt.trim() === "[]") return [];
    const data = JSON.parse(txt);
    if (data && data.Table && Array.isArray(data.Table)) {
      return data.Table;
    }
    if (Array.isArray(data)) return data;
    return [];
  } catch (e) {
    return null;
  }
}

export async function testBSEConnection() {
  const start = Date.now();
  const todayDate = getBseISTDate(0);
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

export async function fetchBSEAnnouncements() {
  const start = Date.now();
  const todayDate = getBseISTDate(0);
  
  // Primary live endpoint: AnnSubCategoryGetData page 1 returns ~50 latest filings instantly
  let table = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 4000, todayDate);
  
  // If today is early morning / late night in India with fewer than 30 filings,
  // also fetch yesterday's filings so that the latest feed is rich and continuous!
  if (table && Array.isArray(table) && table.length < 30) {
    const yesterdayDate = getBseISTDate(1);
    const yestItems = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 3000, yesterdayDate) || [];
    table = [...table, ...yestItems];
  } else if (table && Array.isArray(table) && table.length >= 45) {
    // If today's page 1 is near-full (>= 45 items), volume is high; fetch page 2
    const page2 = await fetchSingleBsePage(2, '', 'AnnSubCategoryGetData', 3000, todayDate) || [];
    if (page2.length > 0) {
      table = [...table, ...page2];
    }
  }

  // Fallback to AnnGetData ONLY if table === null (network or server error)
  if (table === null) {
    table = await fetchSingleBsePage(1, '', 'AnnGetData', 4000, todayDate);
  }

  const totalLatency = Date.now() - start;

  if (table && Array.isArray(table) && table.length > 0) {
    bseHealth = { status: totalLatency > 3000 ? 'degraded' : 'stable', latency: Math.round(totalLatency) };
    
    // Deduplicate by NEWSID
    const uniqueMap = new Map();
    for (const item of table) {
      if (item.NEWSID && !uniqueMap.has(item.NEWSID)) {
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
          
          await saveAnnouncement({
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
          totalSaved++;
        }
      }
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
          for (const item of scripItems) {
            const newsId = item.NEWSID;
            if (!newsId) continue;

            const companyName = item.SLONGNAME || item.scrip_cd || sym;
            const subject = item.NEWSSUB || "No Subject";
            const details = item.HEADLINE || "";
            const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || scripCode);

            const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
            const priority = determinePriority(subject, details);

            await saveAnnouncement({
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
            totalSaved++;
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
      for (const item of items) {
        const newsId = item.NEWSID;
        if (!newsId) continue;

        const companyName = item.SLONGNAME || item.scrip_cd || resolvedSym;
        const subject = item.NEWSSUB || "No Subject";
        const details = item.HEADLINE || "";
        const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || scripCode);

        const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
        const priority = determinePriority(subject, details);

        await saveAnnouncement({
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
        totalSaved++;
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

          await saveAnnouncement({
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
          totalIngested++;
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



