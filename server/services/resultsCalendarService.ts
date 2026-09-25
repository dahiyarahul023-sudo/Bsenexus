import fs from 'fs';
import path from 'path';
import { getActiveWatchlistSymbols, getAllWatchlists, extractSymbol } from '../database/watchlistDao.js';
import { getScripCodeForSymbolOrName, isSymbolMatch, parseBseDate, resolveStockDetails } from '../utils/helpers.js';
import { addLog } from '../database/logDao.js';
import { 
  getRecentAnnouncements, 
  saveAnnouncement, 
  saveAnnouncementsBatch,
  flushLocalDiskSave, 
  boostAnnouncementsPriorityForWindow,
  getAnnouncementsForStockInWindow
} from '../database/announcementDao.js';
import { sendToTelegram } from './telegram.js';
import { getSettings } from '../database/settingsDao.js';
import { determinePriority } from '../utils/helpers.js';
import { isFirestoreQuotaExceeded, setFirestoreQuotaExceeded, isQuotaError, isPermissionDeniedError, setAdminPermissionDenied, isAdminPermissionDenied } from '../database/localStore.js';
import { adminDb } from '../database/firebase.js';
import { getBseISTDate } from './bse.js';
import { externalFeedsCircuitBreaker } from '../utils/circuitBreaker.js';

export interface ResultCalendarItem {
  id: string;
  symbol: string;
  scripCode: string;
  companyName: string;
  purpose: string;
  meetingDate: string;
  meetingTimestamp: number;
  daysLeft: number;
  status: 'TODAY' | 'UPCOMING' | 'RECENT' | 'PAST';
  updatedAt: string;
  isDeclared?: boolean;
  resultDeclarationTime?: string;
  declarationAnnouncementId?: string;
  declarationPdfLink?: string;
  declarationSubject?: string;
  aiSummary?: string;
}

let cachedCalendar: ResultCalendarItem[] = [];
let lastCalendarFetchTime = 0;
let isSyncing = false;

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'results_calendar.json');
const NOTIFIED_MEETINGS_FILE = path.join(process.cwd(), 'data', 'notified_calendar_meetings.json');

// Set of notified meeting IDs to avoid spamming
let notifiedMeetingIds = new Set<string>();

// Ensure directory exists
function ensureDataDir() {
  const dir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load notified meeting ids
function loadNotifiedMeetings() {
  try {
    ensureDataDir();
    if (fs.existsSync(NOTIFIED_MEETINGS_FILE)) {
      const data = fs.readFileSync(NOTIFIED_MEETINGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        notifiedMeetingIds = new Set(parsed);
      }
    }
  } catch (e: any) {
    console.error('Error loading notified meetings cache:', e.message);
  }
}

function saveNotifiedMeetings() {
  try {
    ensureDataDir();
    fs.writeFileSync(NOTIFIED_MEETINGS_FILE, JSON.stringify(Array.from(notifiedMeetingIds), null, 2));
  } catch (e: any) {
    console.error('Error saving notified meetings cache:', e.message);
  }
}

loadNotifiedMeetings();

// Load cached data from disk on startup
function loadLocalCache() {
  try {
    ensureDataDir();
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.items)) {
        cachedCalendar = parsed.items.filter((item: any) => {
          if (!item || !item.symbol) return false;
          // Filter out legacy corrupted entries where symbol had wrong scripCode
          if (item.symbol === 'ABCAPITAL' && item.scripCode === '540716') return false;
          if (item.symbol === 'TATAINVEST' && item.scripCode === '500470') return false;
          if (item.symbol === 'GODREJCP' && item.scripCode === '500165') return false;
          if (item.symbol === 'CONCOR' && item.scripCode === '531349') return false;
          if (item.symbol === 'JBMMA' && item.scripCode === '520066') return false;
          return true;
        });
        lastCalendarFetchTime = parsed.lastUpdated || 0;
      }
    }
  } catch (e: any) {
    console.error('Error loading local results calendar cache:', e.message);
  }
}

loadLocalCache();

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://www.bseindia.com",
  "Referer": "https://www.bseindia.com/",
  "Cache-Control": "no-cache"
};

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-event-calendar",
  "Cache-Control": "no-cache"
};

export interface NSECalendarEvent {
  symbol: string;
  company: string;
  purpose: string;
  bm_desc: string;
  date: string;
}

export async function fetchNSEEventCalendarForSymbol(symbol: string): Promise<NSECalendarEvent[]> {
  if (!symbol) return [];
  const cleanSym = symbol.trim().toUpperCase();
  const url = `https://www.nseindia.com/api/event-calendar?symbol=${encodeURIComponent(cleanSym)}`;
  return await externalFeedsCircuitBreaker.execute(
    async (signal) => {
      const res = await fetch(url, { headers: NSE_HEADERS, signal: signal || AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const text = await res.text();
      if (!text || text.trim() === '[]' || text.trim() === '{}' || text.includes('Resource not found')) return [];
      const data = JSON.parse(text);
      if (Array.isArray(data)) return data;
      return [];
    },
    (_err) => [],
    8000
  );
}

export async function fetchGeneralNSEEventCalendar(): Promise<NSECalendarEvent[]> {
  const url = `https://www.nseindia.com/api/event-calendar`;
  return await externalFeedsCircuitBreaker.execute(
    async (signal) => {
      const res = await fetch(url, { headers: NSE_HEADERS, signal: signal || AbortSignal.timeout(9000) });
      if (!res.ok) return [];
      const text = await res.text();
      if (!text || text.trim() === '[]' || text.trim() === '{}') return [];
      const data = JSON.parse(text);
      if (Array.isArray(data)) return data;
      return [];
    },
    (_err) => [],
    9000
  );
}

// IST (Indian Standard Time = UTC+5:30) helper for precise market day comparison
function getIstMidnightTs(date: Date = new Date()): number {
  try {
    const istDateStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // Returns YYYY-MM-DD in IST
    const ts = Date.parse(`${istDateStr}T00:00:00+05:30`);
    if (!isNaN(ts)) return ts;
  } catch (e) {}
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return Date.parse(`${year}-${month}-${day}T00:00:00+05:30`);
}

function parseMeetingDateToIstMidnight(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = dateStr.trim();
  const pad = (n: number | string) => String(n).padStart(2, '0');
  
  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const ts = Date.parse(`${year}-${pad(month)}-${pad(day)}T00:00:00+05:30`);
    return isNaN(ts) ? 0 : ts;
  }

  // Format: DD-Mon-YYYY or DD Mon YYYY e.g. 14-Aug-2026 or 14 Aug 2026 or 14-AUG-26
  const dMonYMatch = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})/);
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1], 10);
    const monStr = dMonYMatch[2].toLowerCase().substring(0, 3);
    const monthNames: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };
    const month = monthNames[monStr] !== undefined ? monthNames[monStr] : 1;
    let year = parseInt(dMonYMatch[3], 10);
    if (year < 100) year += 2000;
    const ts = Date.parse(`${year}-${pad(month)}-${pad(day)}T00:00:00+05:30`);
    return isNaN(ts) ? 0 : ts;
  }

  // Format: YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const ts = Date.parse(`${year}-${pad(month)}-${pad(day)}T00:00:00+05:30`);
    return isNaN(ts) ? 0 : ts;
  }

  const fallback = new Date(clean).getTime();
  return isNaN(fallback) ? 0 : getIstMidnightTs(new Date(fallback));
}

export async function syncSingleStockResultsCalendar(
  symbolOrScrip: string,
  scripCodeOverride?: string
): Promise<{ success: boolean; count: number; newlyFound: number; items: ResultCalendarItem[] }> {
  try {
    let resolvedSym = symbolOrScrip.toUpperCase().trim();
    let scripCode = scripCodeOverride || getScripCodeForSymbolOrName(resolvedSym);

    if (!scripCode) {
      const resolved = await resolveStockDetails(symbolOrScrip);
      if (resolved) {
        scripCode = resolved.scripCode;
        resolvedSym = resolved.symbol;
      }
    }

    if (!scripCode) {
      return { success: false, count: cachedCalendar.length, newlyFound: 0, items: [] };
    }

    const url = `https://api.bseindia.com/BseIndiaAPI/api/BoardMeeting/w?scripcode=${scripCode}&strPurpose=&fromdate=&todate=`;
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      return { success: false, count: cachedCalendar.length, newlyFound: 0, items: [] };
    }
    const text = await res.text();
    if (!text || text.includes("No Record") || text.trim() === "{}" || text.trim() === "[]") {
      return { success: true, count: cachedCalendar.length, newlyFound: 0, items: [] };
    }
    const json = JSON.parse(text);
    const todayStartTs = getIstMidnightTs(new Date());
    const stockItems: ResultCalendarItem[] = [];

    if (json && json.Table && Array.isArray(json.Table)) {
      for (const row of json.Table) {
        const purpose = (row.Purpose_name || row.Purpose || "").trim();
        if (/result|financial|quarter|audited|unaudited|dividend|bonus|board meeting/i.test(purpose)) {
          const meetingDateStr = (row.meeting_date || row.Meeting_Date || "").trim();
          const meetingTs = parseMeetingDateToIstMidnight(meetingDateStr);
          if (!meetingDateStr || isNaN(meetingTs) || meetingTs <= 0) continue;

          const diffTime = meetingTs - todayStartTs;
          const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));
          let status: 'TODAY' | 'UPCOMING' | 'RECENT' | 'PAST' = 'PAST';
          if (daysLeft === 0) status = 'TODAY';
          else if (daysLeft > 0) status = 'UPCOMING';
          else if (daysLeft >= -30) status = 'RECENT';
          else status = 'PAST';

          const companyName = (row.LONG_NAME || row.Short_name || resolvedSym).trim();
          const itemId = `${scripCode}_${meetingTs}_${purpose.replace(/[^a-zA-Z0-9]/g, '')}`;

          stockItems.push({
            id: itemId,
            symbol: resolvedSym,
            scripCode,
            companyName,
            purpose,
            meetingDate: meetingDateStr,
            meetingTimestamp: meetingTs,
            daysLeft,
            status,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    // Deduplicate by meeting timestamp
    const uniqueStockItems = new Map<number, ResultCalendarItem>();
    for (const item of stockItems) {
      if (!uniqueStockItems.has(item.meetingTimestamp)) {
        uniqueStockItems.set(item.meetingTimestamp, item);
      } else {
        const existing = uniqueStockItems.get(item.meetingTimestamp)!;
        if (item.purpose && !existing.purpose.toLowerCase().includes(item.purpose.toLowerCase())) {
          existing.purpose = `${existing.purpose} & ${item.purpose}`;
        }
      }
    }
    const finalStockItems = Array.from(uniqueStockItems.values());

    // Merge into in-memory cachedCalendar (remove older items for this scripCode first)
    loadLocalCache();
    const otherItems = cachedCalendar.filter(i => i.scripCode !== scripCode && i.symbol !== resolvedSym);
    cachedCalendar = [...otherItems, ...finalStockItems];
    lastCalendarFetchTime = Date.now();

    // Save to disk
    try {
      ensureDataDir();
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify({
        lastUpdated: lastCalendarFetchTime,
        items: cachedCalendar
      }, null, 2));
    } catch {}

    // Invalidate enriched cache so next request computes instant declaration times
    invalidateEnrichedCalendarCache();

    await addLog('INFO', 'RESULTS_CALENDAR', `Instant Synced ${finalStockItems.length} board meeting(s) for ${resolvedSym} (BSE: ${scripCode})`);

    return {
      success: true,
      count: cachedCalendar.length,
      newlyFound: finalStockItems.length,
      items: finalStockItems
    };
  } catch (err: any) {
    console.error('syncSingleStockResultsCalendar error:', err.message);
    return { success: false, count: cachedCalendar.length, newlyFound: 0, items: [] };
  }
}

export async function fetchAndSyncResultsCalendar(
  force: boolean = false,
  options?: { quick?: boolean; symbols?: string[] }
): Promise<ResultCalendarItem[]> {
  const now = Date.now();
  if (!force && isSyncing) return cachedCalendar;
  if (!force && lastCalendarFetchTime > 0 && (now - lastCalendarFetchTime < 60 * 60 * 1000) && cachedCalendar.length > 0) {
    return cachedCalendar;
  }

  isSyncing = true;
  try {
    let targetSymbols: string[] = [];
    if (options?.symbols && options.symbols.length > 0) {
      targetSymbols = options.symbols;
    } else {
      targetSymbols = await getActiveWatchlistSymbols();
    }

    if (!targetSymbols || targetSymbols.length === 0) {
      cachedCalendar = [];
      lastCalendarFetchTime = now;
      return [];
    }

    const scripMap = new Map<string, string[]>(); // scripCode -> list of symbols
    for (const sym of targetSymbols) {
      const cleanSym = sym.trim().toUpperCase();
      if (!cleanSym) continue;
      const sc = getScripCodeForSymbolOrName(cleanSym);
      if (sc) {
        if (!scripMap.has(sc)) scripMap.set(sc, []);
        scripMap.get(sc)!.push(cleanSym);
      }
    }

    const todayStartTs = getIstMidnightTs(new Date());
    const fetchedItems: ResultCalendarItem[] = [];
    const scripEntries = Array.from(scripMap.entries());

    // Fetch batch by batch (BATCH_SIZE = 8 to prevent rate limiting)
    const BATCH_SIZE = 8;
    for (let i = 0; i < scripEntries.length; i += BATCH_SIZE) {
      const batch = scripEntries.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async ([scripCode, symbols]) => {
        const url = `https://api.bseindia.com/BseIndiaAPI/api/BoardMeeting/w?scripcode=${scripCode}&strPurpose=&fromdate=&todate=`;
        try {
          const res = await fetch(url, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(8000) });
          if (!res.ok) return [];
          const text = await res.text();
          if (!text || text.includes("No Record") || text.trim() === "{}" || text.trim() === "[]") return [];
          const json = JSON.parse(text);

          const items: ResultCalendarItem[] = [];
          if (json && json.Table && Array.isArray(json.Table)) {
            for (const row of json.Table) {
              const purpose = (row.Purpose_name || row.Purpose || "").trim();
              if (/result|financial|quarter|audited|unaudited|dividend|bonus|board meeting/i.test(purpose)) {
                const meetingDateStr = (row.meeting_date || row.Meeting_Date || "").trim();
                let meetingTs = parseMeetingDateToIstMidnight(meetingDateStr);

                if (!meetingDateStr || isNaN(meetingTs) || meetingTs <= 0) continue;

                const diffTime = meetingTs - todayStartTs;
                const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));

                let status: 'TODAY' | 'UPCOMING' | 'RECENT' | 'PAST' = 'PAST';
                if (daysLeft === 0) status = 'TODAY';
                else if (daysLeft > 0) status = 'UPCOMING';
                else if (daysLeft >= -30) status = 'RECENT';
                else status = 'PAST';

                const primarySymbol = symbols[0];
                const companyName = (row.LONG_NAME || row.Short_name || primarySymbol).trim();
                const itemId = `${scripCode}_${meetingTs}_${purpose.replace(/[^a-zA-Z0-9]/g, '')}`;

                items.push({
                  id: itemId,
                  symbol: primarySymbol,
                  scripCode,
                  companyName,
                  purpose,
                  meetingDate: meetingDateStr,
                  meetingTimestamp: meetingTs,
                  daysLeft,
                  status,
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }
          return items;
        } catch (e: any) {
          return [];
        }
      });

      const outputs = await Promise.allSettled(promises);
      for (const out of outputs) {
        if (out.status === 'fulfilled' && out.value.length > 0) {
          fetchedItems.push(...out.value);
        }
      }
    }

    // Deduplicate fetched items by scripCode + meetingTimestamp, combining multi-purposes (e.g. Financial Results & Dividend)
    const uniqueMap = new Map<string, ResultCalendarItem>();
    for (const item of fetchedItems) {
      const canonicalKey = `${item.scripCode}_${item.meetingTimestamp}`;
      if (!uniqueMap.has(canonicalKey)) {
        uniqueMap.set(canonicalKey, item);
      } else {
        const existing = uniqueMap.get(canonicalKey)!;
        if (item.purpose && !existing.purpose.toLowerCase().includes(item.purpose.toLowerCase())) {
          existing.purpose = `${existing.purpose} & ${item.purpose}`;
        }
      }
    }

    cachedCalendar = Array.from(uniqueMap.values());
    lastCalendarFetchTime = now;

    // Save to disk cache
    try {
      ensureDataDir();
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify({
        lastUpdated: lastCalendarFetchTime,
        items: cachedCalendar
      }, null, 2));
    } catch (fsErr: any) {
      console.error('Failed to write results calendar disk cache:', fsErr.message);
    }

    // Optionally sync with Firestore
    try {
      if (!isFirestoreQuotaExceeded() && !isAdminPermissionDenied()) {
        const batch = adminDb.batch();
        let count = 0;
        for (const item of cachedCalendar) {
          if (count >= 400) break;
          const docRef = adminDb.collection('results_calendar').doc(item.id);
          batch.set(docRef, item, { merge: true });
          count++;
        }
        if (count > 0) {
          await batch.commit();
        }
      }
    } catch (fireErr: any) {
      if (isQuotaError(fireErr)) {
        setFirestoreQuotaExceeded(true);
      } else if (isPermissionDeniedError(fireErr)) {
        setAdminPermissionDenied(true);
      } else {
        console.warn('Firestore results calendar sync notice:', fireErr.message);
      }
    }

    // Auto-notify Telegram for newly discovered upcoming board meetings
    try {
      const settings = await getSettings();
      if (settings.autoTelegramCalendar !== false) {
        const newlyFoundUpcoming = cachedCalendar.filter(item => 
          (item.daysLeft >= 0) && !notifiedMeetingIds.has(item.id)
        );

        if (newlyFoundUpcoming.length > 0) {
          for (const item of newlyFoundUpcoming) {
            notifiedMeetingIds.add(item.id);
            const daysText = item.daysLeft === 0 ? '🔥 <b>TODAY (आज)</b>' : `⏳ <b>${item.daysLeft} days remaining</b>`;
            const telegramMsg = 
              `📅 <b>UPCOMING BOARD MEETING SCHEDULED</b>\n\n` +
              `🏢 <b>${item.companyName} (${item.symbol})</b>\n` +
              `📌 BSE Scrip Code: <code>${item.scripCode}</code>\n` +
              `🗓️ Meeting Date: <b>${item.meetingDate}</b>\n` +
              `🎯 Purpose: <i>${item.purpose}</i>\n` +
              `⏰ Schedule: ${daysText}\n\n` +
              `🔗 <a href="https://www.bseindia.com/corporates/Comp_Resultsnew.aspx?scrip_cd=${item.scripCode}">View BSE Filings & Outcomes</a>\n` +
              `⚡ <i>Auto-synced from Watchlist Results Calendar</i>`;

            await sendToTelegram(telegramMsg).catch(e => console.error('Telegram calendar send err:', e));
          }
          saveNotifiedMeetings();
          await addLog('INFO', 'TELEGRAM', `Auto-dispatched ${newlyFoundUpcoming.length} upcoming board meeting alert(s) to Telegram channel`);
        }
      }
    } catch (tgErr: any) {
      console.error('Failed to auto-dispatch calendar meetings to Telegram:', tgErr.message);
    }

    await addLog('INFO', 'RESULTS_CALENDAR', `Updated results calendar for ${cachedCalendar.length} items across active watchlists`);
    return cachedCalendar;
  } catch (err: any) {
    await addLog('ERROR', 'RESULTS_CALENDAR', `Error fetching results calendar: ${err.message}`);
    return cachedCalendar;
  } finally {
    isSyncing = false;
  }
}

// Memory cache for processed & enriched results calendar (invalidated on new fetch or after TTL)
let enrichedCache: {
  ts: number;
  items: ResultCalendarItem[];
  byWatchlist: Map<string, ResultCalendarItem[]>;
} | null = null;

export function invalidateEnrichedCalendarCache() {
  enrichedCache = null;
}

export async function getResultsCalendarData(
  filterStatus: 'all' | 'today' | 'upcoming' | 'recent' = 'all', 
  watchlistId?: string,
  userId?: string
) {
  const now = Date.now();
  if (cachedCalendar.length === 0 || now - lastCalendarFetchTime > 12 * 60 * 60 * 1000) {
    await fetchAndSyncResultsCalendar(false);
  }

  // Use cached enriched items if fresh (< 45s old)
  let allEnrichedItems: ResultCalendarItem[] = [];
  if (enrichedCache && (now - enrichedCache.ts < 45000)) {
    allEnrichedItems = enrichedCache.items;
  } else {
    const todayStartTs = getIstMidnightTs(new Date());
    const recentAnnouncements = await getRecentAnnouncements(10000);

    // Build O(1) indexed lookup by scrip_cd and normalized symbol
    const annByScrip = new Map<string, any[]>();
    const annBySym = new Map<string, any[]>();

    for (const a of recentAnnouncements) {
      if (a.scrip_cd) {
        const scStr = String(a.scrip_cd).trim();
        if (!annByScrip.has(scStr)) annByScrip.set(scStr, []);
        annByScrip.get(scStr)!.push(a);
      }
      if (a.companyName || a.subject) {
        const fullTxt = `${a.companyName || ''} ${a.subject || ''}`.toUpperCase();
        // Index first word token
        const tokens = fullTxt.match(/[A-Z0-9]{3,}/g) || [];
        for (const tok of tokens) {
          if (!annBySym.has(tok)) annBySym.set(tok, []);
          annBySym.get(tok)!.push(a);
        }
      }
    }

    allEnrichedItems = cachedCalendar.map(item => {
      const meetingStartTs = parseMeetingDateToIstMidnight(item.meetingDate) || item.meetingTimestamp;
      const diffTime = meetingStartTs - todayStartTs;
      const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let status: 'TODAY' | 'UPCOMING' | 'RECENT' | 'PAST' = 'PAST';
      if (daysLeft === 0) status = 'TODAY';
      else if (daysLeft > 0) status = 'UPCOMING';
      else if (daysLeft >= -30) status = 'RECENT';
      else status = 'PAST';

      // Gather candidate matches from index
      const candidates: any[] = [];
      const byScrip = item.scripCode ? annByScrip.get(String(item.scripCode).trim()) : undefined;
      if (byScrip) candidates.push(...byScrip);

      const symKey = (item.symbol || '').toUpperCase().trim();
      const bySym = symKey ? annBySym.get(symKey) : undefined;
      if (bySym) {
        for (const c of bySym) {
          if (!candidates.includes(c)) candidates.push(c);
        }
      }

      // STRICT WINDOW: Meeting Day start (-6 hours for evening filings / timezone buffer) to Meeting Day + 3 days (72 hours buffer)
      // This strictly prevents an old meeting (e.g. Feb 2026 or Nov 2025) from ever grabbing an unrelated future quarter's filing (e.g. May 2026)!
      const windowStartTs = meetingStartTs - (6 * 60 * 60 * 1000);
      const windowEndTs = meetingStartTs + (3 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000);

      // Filter candidate matches for actual Board Outcome / Result
      const validMatches = candidates.filter(a => {
        const fullText = `${a.subject || ''} ${a.details || ''}`.toLowerCase();
        const isPreNotice = isIntimationOrNoticeFiling(a.subject || '', a.details || '');
        if (isPreNotice) return false;

        const isResultOrOutcome = a.category === 'RESULTS' ||
          /financial result|quarterly result|audited result|unaudited result|q1 result|q2 result|q3 result|q4 result|statement of financial|outcome of board|board meeting outcome|outcome of the board/i.test(fullText);
        if (!isResultOrOutcome) return false;

        const annTs = parseBseDate(a.bseTime) || (a.fetched_at ? new Date(a.fetched_at).getTime() : 0);
        if (annTs <= 0) return false;

        // Check if filing explicitly mentions this exact meeting date text in subject/details
        const parsedMeetingDateStr = item.meetingDate ? item.meetingDate.toLowerCase().trim() : '';
        const hasExplicitMeetingDateMention = parsedMeetingDateStr && fullText.includes(parsedMeetingDateStr);

        // Strict Window match OR Explicit meeting date mention
        return (annTs >= windowStartTs && annTs <= windowEndTs) || hasExplicitMeetingDateMention;
      });

      // Earliest result announcement on/around meeting date, prioritizing exact board outcome & closest timestamp
      validMatches.sort((a, b) => {
        const tsA = parseBseDate(a.bseTime) || (a.fetched_at ? new Date(a.fetched_at).getTime() : 0);
        const tsB = parseBseDate(b.bseTime) || (b.fetched_at ? new Date(b.fetched_at).getTime() : 0);

        const isOutcomeA = /outcome of board|board meeting outcome|outcome of the board|financial results/i.test((a.subject || ''));
        const isOutcomeB = /outcome of board|board meeting outcome|outcome of the board|financial results/i.test((b.subject || ''));
        if (isOutcomeA && !isOutcomeB) return -1;
        if (!isOutcomeA && isOutcomeB) return 1;

        return Math.abs(tsA - meetingStartTs) - Math.abs(tsB - meetingStartTs);
      });

      const matched = validMatches[0];
      let isDeclared = false;
      let resultDeclarationTime: string | undefined = undefined;
      let declarationAnnouncementId: string | undefined = undefined;
      let declarationPdfLink: string | undefined = undefined;
      let declarationSubject: string | undefined = undefined;
      let aiSummary: string | undefined = undefined;

      if (matched) {
        isDeclared = true;
        resultDeclarationTime = matched.bseTime || (matched.fetched_at ? new Date(matched.fetched_at).toISOString() : undefined);
        declarationAnnouncementId = matched.id;
        declarationPdfLink = matched.pdfLink;
        declarationSubject = matched.subject;
        aiSummary = matched.aiSummary;
      } else if (daysLeft < 0) {
        // Past meeting with no specific filing in store - mark declared with clean meeting date
        isDeclared = true;
        resultDeclarationTime = item.meetingDate;
      }

      return { 
        ...item, 
        meetingTimestamp: meetingStartTs,
        daysLeft, 
        status, 
        isDeclared, 
        resultDeclarationTime,
        declarationAnnouncementId,
        declarationPdfLink,
        declarationSubject,
        aiSummary
      };
    });

    enrichedCache = {
      ts: now,
      items: allEnrichedItems,
      byWatchlist: new Map()
    };
  }

  let items = [...allEnrichedItems];

  // Retrieve user's watchlists to enforce strict visibility filtering
  const userWatchlists = await getAllWatchlists(userId);
  const userSymbols = new Set<string>();
  const userScripCodes = new Set<string>();

  for (const wl of userWatchlists) {
    if (wl.is_active !== 0) {
      for (const raw of (wl.items || [])) {
        const sym = extractSymbol(raw);
        if (sym) userSymbols.add(sym.toUpperCase().trim());
        const scrip = (typeof raw === 'object' && raw.scripCode) ? String(raw.scripCode).trim() : getScripCodeForSymbolOrName(sym);
        if (scrip) userScripCodes.add(scrip);
      }
    }
  }

  // Filter by specific watchlist if requested, otherwise filter across all active watchlists
  if (watchlistId) {
    const selectedList = userWatchlists.find(w => String(w.id) === String(watchlistId));
    if (selectedList && selectedList.items) {
      const listSymbols = new Set(selectedList.items.map(s => extractSymbol(s).toUpperCase().trim()));
      const listScrips = new Set(selectedList.items.map(s => (typeof s === 'object' && s.scripCode) ? String(s.scripCode).trim() : getScripCodeForSymbolOrName(extractSymbol(s))).filter(Boolean));
      items = items.filter(item => 
        listSymbols.has(item.symbol.toUpperCase().trim()) ||
        (item.scripCode && listScrips.has(String(item.scripCode).trim()))
      );
    } else {
      items = [];
    }
  } else {
    // If user has watchlists configured and userSymbols is empty (all stocks deleted), return empty list
    if (userWatchlists.length > 0 && userSymbols.size === 0) {
      items = [];
    } else if (userSymbols.size > 0) {
      items = items.filter(item => 
        userSymbols.has(item.symbol.toUpperCase().trim()) ||
        (item.scripCode && userScripCodes.has(String(item.scripCode).trim()))
      );
    }
  }

  // Calculate clean, non-confusing summary metrics across active scope
  const todayItems = items.filter(i => i.status === 'TODAY' || i.daysLeft === 0);
  const todayCount = todayItems.length;
  const todayDeclaredCount = todayItems.filter(i => i.isDeclared).length;
  const todayPendingCount = todayItems.filter(i => !i.isDeclared).length;

  // Upcoming meetings happening in the future (tomorrow and onwards, daysLeft > 0)
  const upcomingFutureItems = items.filter(i => i.status === 'UPCOMING' || i.daysLeft > 0);
  const upcomingFutureCount = upcomingFutureItems.length;

  // Recent declared in past 30 days
  const recentItems = items.filter(i => i.status === 'RECENT' || (i.daysLeft < 0 && i.daysLeft >= -30));
  const recentCount = recentItems.length;

  // Total filings with AI summary
  const aiSummaryCount = items.filter(i => Boolean(i.aiSummary)).length;

  // Apply requested tab filter cleanly
  if (filterStatus === 'today') {
    items = todayItems;
    items.sort((a, b) => {
      // Pending first, then declared
      if (a.isDeclared !== b.isDeclared) return a.isDeclared ? 1 : -1;
      return (a.companyName || '').localeCompare(b.companyName || '');
    });
  } else if (filterStatus === 'upcoming') {
    items = upcomingFutureItems;
    items.sort((a, b) => a.daysLeft - b.daysLeft); // Earliest future date first
  } else if (filterStatus === 'recent') {
    items = recentItems;
    items.sort((a, b) => b.meetingTimestamp - a.meetingTimestamp); // Most recent first
  } else {
    // 'all' -> today & upcoming first (ascending), then past records (descending)
    const todayAndUpcoming = items.filter(i => i.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
    const pastRecords = items.filter(i => i.daysLeft < 0).sort((a, b) => b.meetingTimestamp - a.meetingTimestamp);
    items = [...todayAndUpcoming, ...pastRecords];
  }

  return {
    lastUpdated: lastCalendarFetchTime,
    totalCount: items.length,
    allCount: allEnrichedItems.length,
    todayCount,
    todayDeclaredCount,
    todayPendingCount,
    upcomingFutureCount,
    upcomingCount: todayCount + upcomingFutureCount,
    recentCount,
    aiSummaryCount,
    items
  };
}

export interface StockHistoricalFollowUpFiling {
  id: string;
  subject: string;
  timeStr: string;
  exactDateTimeStr?: string;
  timestamp?: number;
  pdfLink?: string;
  category?: string;
}

export interface StockHistoricalResultItem {
  id: string;
  symbol?: string;
  companyName?: string;
  companyShortName?: string;
  scripCode?: string;
  quarterKey?: string;
  periodOrMeeting: string;
  meetingDate?: string;
  boardMeetingDate?: string;
  declarationDate?: string;
  declarationTime?: string;
  declaredAtFormatted?: string;
  exactDateTimeStr?: string;
  submissionTimestamp?: number;
  subject: string;
  details?: string;
  pdfLink?: string;
  aiSummary?: string;
  isOutcome: boolean;
  status: string;
  priority?: string;
  category?: string;
  isPreResultBoosted?: boolean;
  preResultAnnouncementsCount?: number;
  followUpFilings?: StockHistoricalFollowUpFiling[];
  followUpCount?: number;
}

export function isPureResultOutcomeFiling(subject: string = '', details: string = ''): boolean {
  const combined = `${subject || ''} ${details || ''}`.trim();
  if (!combined) return false;
  const lower = combined.toLowerCase();

  // 1. Strictly reject non-financial result filings (Regulation 30 intimations, investor meets, analyst calls, press releases, etc.)
  const isCorporateNoticeOrIntimation = 
    /analyst\s*\/\s*investor\s*meet|investor\s*meet|analyst\s*meet|institutional\s*investor|conference\s*call|earnings\s*call/i.test(lower) ||
    /investor\s*presentation|analyst\s*presentation|corporate\s*presentation|audio\s*recording|transcript\s*of|press\s*release/i.test(lower) ||
    /newspaper\s*publication|loss\s*of\s*share|duplicate\s*share|credit\s*rating|change\s*in\s*(?:director|kmp|management|auditor)|resignation|appointment/i.test(lower) ||
    /closure\s*of\s*trading\s*window|trading\s*window\s*closure|prior\s*intimation|intimation\s*of\s*board\s*meeting|notice\s*of\s*board\s*meeting|meeting\s*scheduled\s*to\s*be\s*held|to\s*consider\s*and\s*approve/i.test(lower) ||
    /postal\s*ballot|scrutinizer|voting\s*results|record\s*date\s*intimation|allotment\s*of\s*shares|reconstitution/i.test(lower);

  if (isCorporateNoticeOrIntimation) {
    const hasStrictReg33 = /\b(?:regulation 33|reg\s*33|reg\.\s*33|lodr\s*33)\b/i.test(lower);
    const hasApprovedResults = /\b(?:considered and approved the (?:un-?audited|audited|financial)|approved the (?:un-?audited|audited|financial) results)\b/i.test(lower);
    if (!hasStrictReg33 && !hasApprovedResults) {
      return false;
    }
  }

  // 2. Definitive Regulation 33 Financial Results Outcome Matches
  if (/\b(?:regulation 33|reg\s*33|reg\.\s*33|lodr\s*33)\b/i.test(lower)) {
    return true;
  }

  // 3. Exact and simple Financial Results / Results phrases (e.g. Shriram Finance "Financial Results", "Results", "Results/Dividend")
  if (
    /^(?:financial results?|results?|results\s*\/\s*dividend|financial results\s*\/\s*dividend)[\.\s\-:]*$/i.test(combined.trim()) ||
    /\b(?:financial results?|financial result|un-?audited financial results?|audited financial results?|statement of (?:standalone|consolidated|financial) results)\b/i.test(lower) ||
    /\b(?:financial results \(standalone|financial results - standalone|financial results \(consolidated|financial results - consolidated)\b/i.test(lower) ||
    /\b(?:standalone and consolidated financial results|financial results for the (?:quarter|half year|nine months|year ended))\b/i.test(lower) ||
    /\b(?:considered and approved (?:the )?(?:un-?audited|audited|financial)|approved (?:the )?(?:un-?audited|audited|financial) results|approval of (?:un-?audited|audited|financial) results)\b/i.test(lower)
  ) {
    return true;
  }

  // 4. Board meeting outcome specifically mentioning financial results
  if (/\b(?:outcome of board|board meeting outcome|outcome of the board)\b/i.test(lower)) {
    if (/\b(?:financial results?|un-?audited|audited|quarter ended|half year ended|year ended|profit and loss|balance sheet)\b/i.test(lower)) {
      return true;
    }
    // Generic outcome of board meeting without financial results is NOT a financial result
    return false;
  }

  return false;
}

export function isIntimationOrNoticeFiling(subject: string = '', details: string = ''): boolean {
  const fullText = `${subject || ''} ${details || ''}`.toLowerCase();
  if (!fullText.trim()) return false;

  // 1. Explicit OUTCOME / RESULTS indicators override any notice keywords
  // (Regulation 33 is specifically Financial Results submission under SEBI LODR)
  const isDefinitiveOutcome = 
    /^(?:financial results?|results?|results\s*\/\s*dividend|financial results\s*\/\s*dividend)[\.\s\-:]*$/i.test(fullText.trim()) ||
    /\b(?:regulation 33|reg\s*33|reg\.\s*33|lodr\s*33)\b/i.test(fullText) ||
    /\b(?:financial results?|financial result|un-?audited financial results?|audited financial results?|statement of (?:standalone|consolidated|financial) results)\b/i.test(fullText) ||
    /\b(?:considered and approved the (?:un-?audited|audited|financial)|approved the (?:un-?audited|audited|financial) results|approval of (?:un-?audited|audited|financial) results)\b/i.test(fullText) ||
    /\b(?:financial results \(standalone|financial results - standalone|financial results \(consolidated|financial results - consolidated)\b/i.test(fullText);

  if (isDefinitiveOutcome) {
    return false; // It is a genuine OUTCOME, NOT a prior intimation/notice
  }

  // 2. True Prior Notice / Intimations
  const hasIntimationKeywords = 
    /\b(?:prior intimation|notice of board|board meeting intimation|intimation of board|to consider and approve|meeting scheduled|meeting will be held|update on board meeting|rescheduled|trading window|closure of window|closure of trading|regulation 29|reg\s*29|reg\.\s*29)\b/i.test(fullText);

  if (hasIntimationKeywords) {
    return true;
  }

  if (/intimation.*(?:to consider|meeting to be held|scheduled on)/i.test(fullText)) {
    return true;
  }

  if (/newspaper publication|press release|investor presentation|audio recording|transcript|analyst.*meet.*intimation|loss of share|duplicate share|scrutinizer/i.test(fullText)) {
    return true;
  }

  return false;
}

export function parseQuarterPeriod(text: string, timestamp: number): {
  quarterKey: string;
  quarterDisplay: string;
  periodLabel: string;
  fyLabel: string;
  isPriorNotice: boolean;
} {
  const clean = (text || '').toLowerCase();
  const isPriorNotice = isIntimationOrNoticeFiling(text);
  const filingDate = new Date(timestamp || Date.now());
  const filingYear = filingDate.getFullYear();
  const filingMonth = filingDate.getMonth(); // 0 = Jan, 11 = Dec

  // Standalone vs Consolidated tags
  const hasConsol = /\b(?:consolidated|consol)\b/i.test(clean);
  const hasStd = /\b(?:standalone|std)\b/i.test(clean);
  const reportingType = (hasStd && hasConsol) ? ' (STD & CONSOL)' : hasStd ? ' (STD)' : hasConsol ? ' (CONSOL)' : '';

  // 1. Try to find explicit period ended month and year in text
  let detectedQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null = null;
  let detectedPeriodYear: number | null = null;

  // Q1 Check: June 30 / 30-Jun / 30.06 / 30/06
  if (
    /(?:quarter|period|three\s*months?)\s*ended\s*(?:on\s*)?(?:30(?:th)?[\s\.\-\/]*(?:jun(?:e)?|06)|june\s*30|30\/06|30-jun)/i.test(clean) ||
    /for\s*the\s*quarter\s*ended\s*(?:30(?:th)?[\s\.\-\/]*(?:jun(?:e)?|06)|june|30-jun)/i.test(clean) ||
    /\b(?:q1\s*results?|first\s*quarter\s*results?|results?\s*for\s*q1)\b/i.test(clean)
  ) {
    detectedQuarter = 'Q1';
  }
  // Q2 Check: September 30 / 30-Sep / 30.09 / 30/09 / Half Year
  else if (
    /(?:quarter|period|half\s*year|six\s*months?)\s*ended\s*(?:on\s*)?(?:30(?:th)?[\s\.\-\/]*(?:sep(?:tember)?|09)|sept(?:ember)?\s*30|30\/09|30-sep)/i.test(clean) ||
    /for\s*the\s*(?:quarter|half\s*year)\s*ended\s*(?:30(?:th)?[\s\.\-\/]*(?:sep(?:tember)?|09)|sep|30-sep)/i.test(clean) ||
    /\b(?:q2\s*results?|second\s*quarter\s*results?|results?\s*for\s*q2|h1\s*results?|half\s*yearly\s*results?)\b/i.test(clean)
  ) {
    detectedQuarter = 'Q2';
  }
  // Q3 Check: December 31 / 31-Dec / 31.12 / 31/12 / Nine Months
  else if (
    /(?:quarter|period|nine\s*months?|9m)\s*ended\s*(?:on\s*)?(?:31(?:st)?[\s\.\-\/]*(?:dec(?:ember)?|12)|dec(?:ember)?\s*31|31\/12|31-dec)/i.test(clean) ||
    /for\s*the\s*(?:quarter|nine\s*months?)\s*ended\s*(?:31(?:st)?[\s\.\-\/]*(?:dec(?:ember)?|12)|dec|31-dec)/i.test(clean) ||
    /\b(?:q3\s*results?|third\s*quarter\s*results?|results?\s*for\s*q3|9m\s*results?)\b/i.test(clean)
  ) {
    detectedQuarter = 'Q3';
  }
  // Q4 Check: March 31 / 31-Mar / 31.03 / 31/03 / Year Ended / Annual
  else if (
    /(?:quarter|period|year|annual)\s*ended\s*(?:on\s*)?(?:31(?:st)?[\s\.\-\/]*(?:mar(?:ch)?|03)|march\s*31|31\/03|31-mar)/i.test(clean) ||
    /for\s*the\s*(?:quarter|financial\s*year|year)\s*ended\s*(?:31(?:st)?[\s\.\-\/]*(?:mar(?:ch)?|03)|mar|31-mar)/i.test(clean) ||
    /\b(?:q4\s*results?|fourth\s*quarter\s*results?|results?\s*for\s*q4|annual\s*audited\s*results?|annual\s*results?)\b/i.test(clean)
  ) {
    detectedQuarter = 'Q4';
  }

  // Extract year near period ended if present
  const yearNearPeriod = text.match(/(?:period|quarter|half\s*year|nine\s*months?|year)\s*ended[^\d\n\r]{0,30}(\d{4})/i) ||
    text.match(/(?:30[\s\.\-\/]*(?:jun|sep)|31[\s\.\-\/]*(?:dec|mar))[\s\.\-\/,]*(\d{4})/i);
  if (yearNearPeriod && yearNearPeriod[1]) {
    detectedPeriodYear = parseInt(yearNearPeriod[1], 10);
  }

  // 2. If no explicit period was in headline/subject, deduce strictly by Board Meeting / Filing Timestamp
  // In the Indian corporate reporting calendar:
  // Jan 1 - Mar 20 -> Q3 (Ended 31-Dec of previous calendar year)
  // Mar 21 - Jun 25 -> Q4 (Year ended 31-Mar of current calendar year)
  // Jun 26 - Sep 20 -> Q1 (Ended 30-Jun of current calendar year)
  // Sep 21 - Dec 31 -> Q2 (Ended 30-Sep of current calendar year)
  if (!detectedQuarter) {
    if (filingMonth >= 0 && filingMonth <= 2) {
      detectedQuarter = 'Q3';
      detectedPeriodYear = detectedPeriodYear || (filingYear - 1);
    } else if (filingMonth >= 3 && filingMonth <= 5) {
      detectedQuarter = 'Q4';
      detectedPeriodYear = detectedPeriodYear || filingYear;
    } else if (filingMonth >= 6 && filingMonth <= 8) {
      detectedQuarter = 'Q1';
      detectedPeriodYear = detectedPeriodYear || filingYear;
    } else {
      detectedQuarter = 'Q2';
      detectedPeriodYear = detectedPeriodYear || filingYear;
    }
  }

  // Ensure period year is valid
  if (!detectedPeriodYear || detectedPeriodYear < 2015 || detectedPeriodYear > 2035) {
    if (detectedQuarter === 'Q3' && filingMonth <= 2) {
      detectedPeriodYear = filingYear - 1;
    } else {
      detectedPeriodYear = filingYear;
    }
  }

  // 3. Compute Indian Financial Year (FY) and Canonical Quarter Key
  // FY starts April 1 and ends March 31.
  // Period Ended 30-Jun-2025 -> Q1 FY26 (fy = 26)
  // Period Ended 30-Sep-2025 -> Q2 FY26 (fy = 26)
  // Period Ended 31-Dec-2025 -> Q3 FY26 (fy = 26)
  // Period Ended 31-Mar-2026 -> Q4 FY26 (fy = 26)
  let fyNumber: number;
  let periodEndDayMonth: string;

  if (detectedQuarter === 'Q1') {
    fyNumber = (detectedPeriodYear % 100) + 1;
    periodEndDayMonth = `30-Jun-${detectedPeriodYear}`;
  } else if (detectedQuarter === 'Q2') {
    fyNumber = (detectedPeriodYear % 100) + 1;
    periodEndDayMonth = `30-Sep-${detectedPeriodYear}`;
  } else if (detectedQuarter === 'Q3') {
    fyNumber = (detectedPeriodYear % 100) + 1;
    periodEndDayMonth = `31-Dec-${detectedPeriodYear}`;
  } else {
    // Q4
    fyNumber = detectedPeriodYear % 100;
    periodEndDayMonth = `31-Mar-${detectedPeriodYear}`;
  }

  const fyLabel = `FY${fyNumber < 10 ? '0' + fyNumber : fyNumber}`;
  const quarterDisplay = `${detectedQuarter} ${fyLabel}`;
  const quarterKey = `${fyLabel}-${detectedQuarter}`;

  const periodTypeStr = detectedQuarter === 'Q4' ? 'Year Ended' : 'Quarter Ended';
  const periodLabel = `${periodTypeStr} ${periodEndDayMonth} (${quarterDisplay})${reportingType}`;

  return {
    quarterKey,
    quarterDisplay,
    periodLabel,
    fyLabel,
    isPriorNotice
  };
}

export async function getStockResultsHistory(
  param1: string, 
  param2?: string, 
  companyName?: string
): Promise<StockHistoricalResultItem[]> {
  const p1 = String(param1 || '').trim();
  const p2 = String(param2 || '').trim();

  let sym = '';
  let targetScrip = '';

  if (/^\d{5,7}$/.test(p1)) {
    targetScrip = p1;
    sym = p2.toUpperCase();
  } else if (/^\d{5,7}$/.test(p2)) {
    targetScrip = p2;
    sym = p1.toUpperCase();
  } else {
    sym = (p1 || p2).toUpperCase();
    targetScrip = getScripCodeForSymbolOrName(sym) || '';
  }

  let resolvedEntry: any = null;
  if (targetScrip) {
    resolvedEntry = await resolveStockDetails(targetScrip);
    if (!sym && resolvedEntry?.symbol) sym = resolvedEntry.symbol.toUpperCase();
  } else if (sym) {
    resolvedEntry = await resolveStockDetails(sym);
    if (resolvedEntry?.scripCode) targetScrip = resolvedEntry.scripCode;
  }

  const effectiveCompName = companyName || resolvedEntry?.companyName || sym || 'Company';
  const effectiveShortName = resolvedEntry?.companyShortName || effectiveCompName.split(' ')[0] || sym;

  // Dedicated map for 1 Result Per Quarter (keyed by canonical quarterKey e.g. "2026-Q1", "2026-Q4")
  const quarterOutcomesMap = new Map<string, StockHistoricalResultItem>();
  const todayStartTs = getIstMidnightTs(new Date());

  // 1. Fetch announcements for this stock from Dao
  const recentAnnouncements = await getRecentAnnouncements(10000);
  const stockAnns = recentAnnouncements.filter((ann: any) => {
    const annScrip = String(ann.scrip_cd || ann.SCRIP_CD || ann.scripCode || '').trim();
    const annSym = (ann.symbol || '').toUpperCase().trim();
    const annComp = (ann.companyName || ann.SLONGNAME || '').toUpperCase();
    return (targetScrip && annScrip === targetScrip) ||
      (sym && (annSym === sym || isSymbolMatch(annComp, ann.subject || '', sym, annScrip)));
  });

  // Group announcements strictly by calendar date in IST
  const dateMap = new Map<string, any[]>();
  for (const ann of stockAnns) {
    const rawTime = ann.bseTime || ann.News_submission_dt || ann.DT_TM || ann.NEWS_DT || '';
    let ts = ann.bseTimestamp || ann.timestamp || (rawTime ? parseBseDate(rawTime) : 0);
    if (!ts && ann.fetched_at) ts = ann.fetched_at;
    if (!ts) continue;

    const d = new Date(ts);
    const dateStr = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const formattedExact = `${dateStr}, ${timeStr} IST`;

    if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
    dateMap.get(dateStr)!.push({
      ...ann,
      ts,
      dateStr,
      timeStr,
      formattedExact,
      subject: (ann.subject || ann.NEWSSUB || '').trim(),
      details: (ann.details || ann.HEADLINE || '').trim(),
      pdfLink: ann.pdfLink || (ann.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${ann.ATTACHMENTNAME}` : '')
    });
  }

  // 2. Identify canonical declared quarter results from date groups
  for (const [dateStr, filings] of dateMap.entries()) {
    filings.sort((a, b) => a.ts - b.ts);

    const outcomeFiling = filings.find(f => isPureResultOutcomeFiling(f.subject, f.details));
    if (outcomeFiling) {
      const { quarterKey, periodLabel } = parseQuarterPeriod(`${outcomeFiling.subject} ${outcomeFiling.details}`, outcomeFiling.ts);

      const followUps: StockHistoricalFollowUpFiling[] = filings
        .filter(f => f !== outcomeFiling)
        .map(f => ({
          id: f.id || f.NEWSID || String(Math.random()),
          subject: f.subject,
          timeStr: `${f.timeStr} IST`,
          exactDateTimeStr: f.formattedExact,
          timestamp: f.ts,
          pdfLink: f.pdfLink,
          category: f.category || 'Results'
        }));

      quarterOutcomesMap.set(quarterKey, {
        id: outcomeFiling.id || outcomeFiling.NEWSID || `decl_${quarterKey}`,
        symbol: sym,
        companyName: effectiveCompName,
        companyShortName: effectiveShortName,
        scripCode: targetScrip,
        quarterKey,
        periodOrMeeting: periodLabel,
        meetingDate: dateStr,
        boardMeetingDate: dateStr,
        declarationDate: dateStr,
        declarationTime: outcomeFiling.timeStr,
        declaredAtFormatted: outcomeFiling.formattedExact,
        exactDateTimeStr: outcomeFiling.formattedExact,
        submissionTimestamp: outcomeFiling.ts,
        subject: outcomeFiling.subject,
        details: outcomeFiling.details,
        pdfLink: outcomeFiling.pdfLink,
        aiSummary: outcomeFiling.aiSummary,
        isOutcome: true,
        status: 'Declared',
        priority: outcomeFiling.priority || 'HIGH',
        category: 'Results',
        followUpFilings: followUps,
        followUpCount: followUps.length
      });
    }
  }

  // 3. Process NSE Event Calendar for official Scheduled Upcoming meetings
  let nseEvents: NSECalendarEvent[] = [];
  if (sym) {
    try {
      nseEvents = await fetchNSEEventCalendarForSymbol(sym);
    } catch (e: any) {
      console.warn(`NSE Event Calendar fetch for ${sym} notice:`, e.message);
    }
  }

  for (const nseItem of nseEvents) {
    const purpose = (nseItem.purpose || nseItem.bm_desc || '').trim();
    const isResultMeeting = /result|financial|quarter|audited|unaudited/i.test(purpose);
    if (!isResultMeeting) continue;

    const dateStr = (nseItem.date || '').trim();
    const meetingTs = parseMeetingDateToIstMidnight(dateStr);
    if (!dateStr || isNaN(meetingTs) || meetingTs <= 0) continue;

    const { quarterKey, periodLabel } = parseQuarterPeriod(`${purpose} ${nseItem.bm_desc || ''}`, meetingTs);
    if (quarterOutcomesMap.has(quarterKey)) {
      // If already declared, ensure board meeting date is aligned
      continue;
    }

    const diffTime = meetingTs - todayStartTs;
    const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const isPast = daysLeft < 0;
    let statusText = 'Scheduled Upcoming';
    if (daysLeft === 0) statusText = 'Meeting Today';
    else if (isPast) statusText = 'Declared';

    quarterOutcomesMap.set(quarterKey, {
      id: `nse_${sym}_${meetingTs}_${quarterKey}`,
      symbol: sym,
      companyName: effectiveCompName,
      companyShortName: effectiveShortName,
      scripCode: targetScrip,
      quarterKey,
      periodOrMeeting: periodLabel,
      meetingDate: dateStr,
      boardMeetingDate: dateStr,
      declarationDate: dateStr,
      declaredAtFormatted: isPast ? `${dateStr} IST` : undefined,
      exactDateTimeStr: isPast ? `${dateStr} IST` : undefined,
      submissionTimestamp: meetingTs,
      subject: nseItem.bm_desc || nseItem.purpose || 'Financial Results',
      details: nseItem.purpose,
      isOutcome: isPast ? true : false,
      status: statusText,
      priority: 'HIGH',
      category: 'Results',
      followUpFilings: [],
      followUpCount: 0
    });
  }

  // 4. Also check active Results Calendar items for upcoming / today meetings
  const calendarData = await getResultsCalendarData('all');
  for (const calItem of calendarData.items || []) {
    const calScrip = String(calItem.scripCode || '').trim();
    const isCalMatch = (targetScrip && calScrip === targetScrip) ||
      (sym && calItem.symbol && calItem.symbol.toUpperCase() === sym);

    if (isCalMatch) {
      const meetingTs = calItem.meetingTimestamp || parseMeetingDateToIstMidnight(calItem.meetingDate || '');
      const { quarterKey, periodLabel } = parseQuarterPeriod(`${calItem.purpose} ${calItem.declarationSubject || ''}`, meetingTs);

      if (calItem.isDeclared) {
        if (!quarterOutcomesMap.has(quarterKey) || !quarterOutcomesMap.get(quarterKey)?.pdfLink) {
          const declTimeStr = calItem.resultDeclarationTime || '';
          quarterOutcomesMap.set(quarterKey, {
            id: calItem.declarationAnnouncementId || calItem.id,
            symbol: sym,
            companyName: calItem.companyName || effectiveCompName,
            companyShortName: effectiveShortName,
            scripCode: targetScrip,
            quarterKey,
            periodOrMeeting: periodLabel,
            meetingDate: calItem.meetingDate,
            boardMeetingDate: calItem.meetingDate,
            declarationDate: calItem.meetingDate,
            declarationTime: declTimeStr,
            declaredAtFormatted: declTimeStr.includes('IST') ? declTimeStr : `${declTimeStr} IST`,
            exactDateTimeStr: declTimeStr,
            submissionTimestamp: calItem.meetingTimestamp || meetingTs,
            subject: calItem.declarationSubject || calItem.purpose,
            details: calItem.purpose,
            pdfLink: calItem.declarationPdfLink,
            aiSummary: calItem.aiSummary,
            isOutcome: true,
            status: 'Declared',
            priority: 'HIGH',
            category: 'Results',
            followUpFilings: quarterOutcomesMap.get(quarterKey)?.followUpFilings || [],
            followUpCount: quarterOutcomesMap.get(quarterKey)?.followUpCount || 0
          });
        }
      } else if (!quarterOutcomesMap.has(quarterKey)) {
        const diffTime = meetingTs - todayStartTs;
        const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));
        let statusText = 'Scheduled Upcoming';
        if (daysLeft === 0 || calItem.status === 'TODAY') statusText = 'Meeting Today';
        else if (daysLeft < 0) statusText = 'Past Meeting';

        quarterOutcomesMap.set(quarterKey, {
          id: calItem.id,
          symbol: sym,
          companyName: calItem.companyName || effectiveCompName,
          companyShortName: effectiveShortName,
          scripCode: targetScrip,
          quarterKey,
          periodOrMeeting: periodLabel,
          meetingDate: calItem.meetingDate,
          boardMeetingDate: calItem.meetingDate,
          submissionTimestamp: meetingTs,
          subject: calItem.declarationSubject || calItem.purpose,
          details: calItem.purpose,
          isOutcome: false,
          status: statusText,
          priority: 'HIGH',
          category: 'Results',
          followUpFilings: [],
          followUpCount: 0
        });
      }
    }
  }

  // Return strictly 1 canonical item per quarter, ordered descending
  const canonicalResults = Array.from(quarterOutcomesMap.values());
  canonicalResults.sort((a, b) => (b.submissionTimestamp || 0) - (a.submissionTimestamp || 0));

  return canonicalResults;
}

export async function fetchDeepHistoricalResultsForStock(
  scripCode: string,
  symbol?: string,
  years: number = 1
): Promise<{ success: boolean; newlySaved: number; totalHistoryCount: number; years: number }> {
  const targetScrip = String(scripCode || '').trim();
  const targetSym = String(symbol || '').trim().toUpperCase();

  if (!targetScrip) {
    throw new Error('Valid BSE Scrip Code is required for deep historical fetch');
  }

  const validYears = Math.max(1, Math.min(5, years || 1));
  const maxPages = Math.min(35, validYears * 6);
  const cutoffTimestamp = Date.now() - (validYears * 365.25 * 86400000);

  let totalSaved = 0;
  let reachedCutoff = false;

  // Also fetch official BSE Board Meetings archive table
  try {
    const cleanTargetScrip = targetScrip.replace(/[^0-9]/g, '');
    const bmUrl = `https://api.bseindia.com/BseIndiaAPI/api/BoardMeeting/w?scripcode=${cleanTargetScrip}&strPurpose=&fromdate=&todate=`;
    const bmRes = await fetch(bmUrl, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(9000)
    });
    if (bmRes.ok) {
      const bmJson = await bmRes.json();
      if (bmJson && Array.isArray(bmJson.Table)) {
        const bmAnnouncements: any[] = [];
        for (const bm of bmJson.Table) {
          const mDate = bm.meeting_date || '';
          const purpose = bm.Purpose_name || 'Board Meeting';
          if (mDate) {
            const safeDateKey = mDate.replace(/[^a-zA-Z0-9]/g, '_');
            const newsId = `bm_${cleanTargetScrip}_${safeDateKey}`;
            bmAnnouncements.push({
              newsId,
              companyName: bm.Long_Name || targetSym || "BSE Stock",
              subject: `Board Meeting Intimation - ${purpose}`,
              details: `Board Meeting scheduled on ${mDate} to consider ${purpose}`,
              pdfLink: "",
              scrip_cd: cleanTargetScrip,
              bseTime: mDate,
              priority: 'MEDIUM',
              category: 'BOARD_MEETING',
              isWatchlist: true
            });
          }
        }
        if (bmAnnouncements.length > 0) {
          const res = await saveAnnouncementsBatch(bmAnnouncements);
          totalSaved += (res.inserted + res.updated);
        }
      }
    }
  } catch (e: any) {
    console.warn(`BSE BoardMeeting sync for ${targetScrip} notice:`, e.message);
  }

  // Process in batches of 4 pages concurrently for rapid sync
  const batchSize = 4;
  for (let startPage = 1; startPage <= maxPages && !reachedCutoff; startPage += batchSize) {
    const pageNumbers = Array.from({ length: Math.min(batchSize, maxPages - startPage + 1) }, (_, i) => startPage + i);

    const batchResults = await Promise.all(
      pageNumbers.map(async (page) => {
        const prevDate = getBseISTDate(180);
        const toDate = getBseISTDate(0);
        try {
          const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=${page}&strCat=Result&strPrevDate=${prevDate}&strScrip=${targetScrip}&strSearch=P&strToDate=${toDate}&strType=C`;
          const res = await fetch(url, {
            headers: COMMON_HEADERS,
            signal: AbortSignal.timeout(9000)
          });
          if (!res.ok) return [];
          const txt = await res.text();
          if (!txt || txt.includes("No Record") || txt.trim() === "{}" || txt.trim() === "[]") return [];

          const data = JSON.parse(txt);
          if (data && data.Table && Array.isArray(data.Table)) return data.Table;
          if (Array.isArray(data)) return data;
          return [];
        } catch {
          // Fallback to general AnnSubCategoryGetData for this page
          try {
            const fbUrl = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=${page}&strCat=-1&strPrevDate=${prevDate}&strScrip=${targetScrip}&strSearch=P&strToDate=${toDate}&strType=C`;
            const fbRes = await fetch(fbUrl, {
              headers: COMMON_HEADERS,
              signal: AbortSignal.timeout(9000)
            });
            if (!fbRes.ok) return [];
            const fbTxt = await fbRes.text();
            if (!fbTxt || fbTxt.includes("No Record")) return [];
            const fbData = JSON.parse(fbTxt);
            if (fbData && fbData.Table && Array.isArray(fbData.Table)) return fbData.Table;
            if (Array.isArray(fbData)) return fbData;
          } catch {}
          return [];
        }
      })
    );

    for (const items of batchResults) {
      if (!items || items.length === 0) {
        reachedCutoff = true;
        continue;
      }

      const historicalAnnouncements: any[] = [];
      for (const item of items) {
        const newsId = item.NEWSID;
        if (!newsId) continue;

        const companyName = item.SLONGNAME || item.scrip_cd || targetSym || "BSE Stock";
        const subject = item.NEWSSUB || "No Subject";
        const details = item.HEADLINE || "";
        const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || targetScrip);
        const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
        const priority = determinePriority(subject, details);
        const rawTime = item.News_submission_dt || item.DT_TM || item.NEWS_DT;
        const parsedTs = parseBseDate(rawTime);

        if (parsedTs > 0 && parsedTs < cutoffTimestamp) {
          reachedCutoff = true;
        }

        historicalAnnouncements.push({
          newsId,
          companyName,
          subject,
          details,
          pdfLink,
          scrip_cd,
          bseTime: rawTime,
          priority: priority.level,
          category: priority.category,
          isWatchlist: true
        });
      }

      if (historicalAnnouncements.length > 0) {
        const res = await saveAnnouncementsBatch(historicalAnnouncements);
        totalSaved += (res.inserted + res.updated);
      }
    }
  }

  flushLocalDiskSave();

  // Re-fetch historical results list to return updated count
  const updatedHistory = await getStockResultsHistory(targetSym, targetScrip);

  await addLog(
    'INFO', 
    'BSE', 
    `Deep historical sync (${validYears} Year(s)) for ${targetSym || targetScrip} complete: +${totalSaved} filings processed, ${updatedHistory.length} total results/meetings recorded.`
  );

  return {
    success: true,
    newlySaved: totalSaved,
    totalHistoryCount: updatedHistory.length,
    years: validYears
  };
}

export async function fetchDeepHistoricalResultsForWatchlist(
  years: number = 1
): Promise<{ success: boolean; newlySaved: number; symbolsCount: number; years: number }> {
  const activeSymbols = await getActiveWatchlistSymbols();
  if (!activeSymbols || activeSymbols.length === 0) {
    return { success: true, newlySaved: 0, symbolsCount: 0, years };
  }

  const validYears = Math.max(1, Math.min(5, years || 1));
  let totalSaved = 0;
  const processedScrips = new Set<string>();

  // Process in batches of 4 to respect BSE API rate limits while maintaining fast sync
  const batchSize = 4;
  for (let i = 0; i < activeSymbols.length; i += batchSize) {
    const batch = activeSymbols.slice(i, i + batchSize);
    await Promise.all(batch.map(async (sym) => {
      const scripCode = getScripCodeForSymbolOrName(sym);
      if (!scripCode || processedScrips.has(scripCode)) return;
      processedScrips.add(scripCode);

      try {
        const res = await fetchDeepHistoricalResultsForStock(scripCode, sym, validYears);
        if (res && res.newlySaved) {
          totalSaved += res.newlySaved;
        }
      } catch (err: any) {
        console.warn(`Error during deep sync for ${sym} (${scripCode}):`, err.message);
      }
    }));
  }

  await addLog(
    'INFO', 
    'BSE', 
    `Watchlist ${validYears}-Year deep sync complete across ${activeSymbols.length} stocks (+${totalSaved} total historical filings)`
  );

  return {
    success: true,
    newlySaved: totalSaved,
    symbolsCount: activeSymbols.length,
    years: validYears
  };
}

export async function boostPreResultWindow(
  scripCode: string,
  symbol: string,
  targetDateStr: string,
  windowDays: number = 10
): Promise<{ success: boolean; boostedCount: number; announcements: any[]; windowDetails: any }> {
  let targetTs = 0;
  if (targetDateStr) {
    targetTs = parseMeetingDateToIstMidnight(targetDateStr);
    if (!targetTs) {
      const parsed = Date.parse(targetDateStr);
      if (!isNaN(parsed)) targetTs = parsed;
    }
  }
  if (!targetTs) targetTs = Date.now();

  const daysMs = (windowDays || 10) * 24 * 60 * 60 * 1000;
  const startTs = targetTs - daysMs;
  const endTs = targetTs + (24 * 60 * 60 * 1000); // include result date itself

  const result = await boostAnnouncementsPriorityForWindow(scripCode, symbol, startTs, endTs, 'HIGH');

  const startFormatted = new Date(startTs).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const endFormatted = new Date(targetTs).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

  return {
    success: true,
    boostedCount: result.boostedCount,
    announcements: result.announcements,
    windowDetails: {
      windowDays,
      resultDate: targetDateStr,
      startDate: startFormatted,
      endDate: endFormatted,
      totalAnnouncementsInWindow: result.announcements.length
    }
  };
}

export function getPreResultRunupAnnouncements(
  scripCode: string,
  symbol: string,
  targetDateStr: string,
  windowDays: number = 10
): any[] {
  let targetTs = 0;
  if (targetDateStr) {
    targetTs = parseMeetingDateToIstMidnight(targetDateStr);
    if (!targetTs) {
      const parsed = Date.parse(targetDateStr);
      if (!isNaN(parsed)) targetTs = parsed;
    }
  }
  if (!targetTs) targetTs = Date.now();

  const daysMs = (windowDays || 10) * 24 * 60 * 60 * 1000;
  const startTs = targetTs - daysMs;
  const endTs = targetTs + (24 * 60 * 60 * 1000);

  return getAnnouncementsForStockInWindow(scripCode, symbol, startTs, endTs);
}

function generateServerGoogleCalUrl(item: { symbol: string; companyName: string; purpose: string; meetingDate: string; scripCode: string }) {
  let targetDate = new Date();
  const clean = (item.meetingDate || '').trim();
  const dMonYMatch = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})/);
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1], 10);
    const monStr = dMonYMatch[2].toLowerCase().substring(0, 3);
    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthNames[monStr] !== undefined ? monthNames[monStr] : 0;
    let year = parseInt(dMonYMatch[3], 10);
    if (year < 100) year += 2000;
    targetDate = new Date(Date.UTC(year, month, day, 4, 30, 0));
  } else {
    const parsed = new Date(item.meetingDate);
    if (!isNaN(parsed.getTime())) targetDate = parsed;
  }

  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  const startIso = `${y}${m}${d}T043000Z`;
  const endIso = `${y}${m}${d}T103000Z`;

  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `BSE: ${item.symbol} Board Meeting (${item.purpose})`,
    details: `Company: ${item.companyName}\nSymbol: ${item.symbol} (BSE: ${item.scripCode})\nMeeting Purpose: ${item.purpose}\nScheduled Date: ${item.meetingDate}\n\nTrack real-time outcomes on BSE Nexus.`,
    location: 'BSE India / Corporate Headquarters',
    dates: `${startIso}/${endIso}`
  });

  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export async function broadcastUpcomingMeetingsToTelegram(options: { forceAll?: boolean } = {}) {
  const data = await getResultsCalendarData('all');
  const items = data.items || [];
  
  // Filter for upcoming / today meetings
  const upcoming = items.filter(i => i.daysLeft >= 0 || i.status === 'TODAY' || i.status === 'UPCOMING');
  if (upcoming.length === 0) {
    return { success: true, count: 0, message: 'No upcoming board meetings found in watchlist schedule.' };
  }

  // Sort by daysLeft ascending (earliest first)
  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

  let sentCount = 0;
  for (const item of upcoming) {
    if (!options.forceAll && notifiedMeetingIds.has(item.id)) {
      continue;
    }

    notifiedMeetingIds.add(item.id);
    const daysText = item.daysLeft === 0 ? '🔥 <b>TODAY (आज)</b>' : `⏳ <b>${item.daysLeft} days remaining</b>`;
    const isDeclared = item.isDeclared ? ' (Outcome Declared)' : '';
    const calUrl = generateServerGoogleCalUrl(item);
    
    const telegramMsg = 
      `📅 <b>UPCOMING BOARD MEETING ALERT</b>\n\n` +
      `🏢 <b>${item.companyName} (${item.symbol})</b>\n` +
      `📌 BSE Scrip Code: <code>${item.scripCode}</code>\n` +
      `🗓️ Meeting Date: <b>${item.meetingDate}</b>${isDeclared}\n` +
      `🎯 Purpose: <i>${item.purpose}</i>\n` +
      `⏰ Timeline: ${daysText}\n\n` +
      `📅 <a href="${calUrl}">Add to Google Calendar (1-Click)</a>\n` +
      `🔗 <a href="https://www.bseindia.com/corporates/Comp_Resultsnew.aspx?scrip_cd=${item.scripCode}">View BSE Corporate Filings</a>\n` +
      `⚡ <i>Dispatched via BSE Results Calendar</i>`;

    const res = await sendToTelegram(telegramMsg).catch(e => ({ success: false, error: e.message }));
    if (res && res.success) {
      sentCount++;
    }
  }

  saveNotifiedMeetings();
  await addLog('INFO', 'TELEGRAM', `Broadcast ${sentCount} upcoming board meeting(s) to Telegram`);
  return { 
    success: true, 
    count: sentCount, 
    totalUpcoming: upcoming.length,
    message: `Successfully broadcast ${sentCount} upcoming board meeting(s) to Telegram channel.` 
  };
}


