import YahooFinance from 'yahoo-finance2';
import { getStockResultsHistory, getResultsCalendarData } from './resultsCalendarService.js';
import { classifyMaterialEvent, MaterialEvent } from './timelineClassifier.js';
import { getRecentAnnouncements } from '../database/announcementDao.js';
import { generateDirectSummary } from './gemini.js';
import { parseBseDate } from '../utils/helpers.js';

let yfClient: any = null;
function getYF() {
  if (!yfClient) {
    yfClient = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
  }
  return yfClient;
}

export interface CompanyQuoteContext {
  symbol: string;
  scripCode?: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  exchange: string;
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  avgVolume?: number;
  sector?: string;
  industry?: string;
}

export interface CompanyIntelligenceData {
  symbol: string;
  scripCode: string;
  companyName: string;
  quote?: CompanyQuoteContext;
  upcomingEvent?: {
    meetingDate: string;
    purpose: string;
    countdownDays: number;
    isDeclared: boolean;
  };
  quarterlyResults: any[];
  materialTimeline: MaterialEvent[];
  recentFilings: any[];
  aiSnapshot?: string;
}

// In-memory quote cache (5-minute TTL)
const quoteCache = new Map<string, { data: CompanyQuoteContext; expiry: number }>();

export async function fetchStockQuote(symbol: string): Promise<CompanyQuoteContext | null> {
  if (!symbol) return null;
  const cleanSym = symbol.trim().toUpperCase();

  const cached = quoteCache.get(cleanSym);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const yf = getYF();
  // Restrict ticker lookup strictly to Indian exchanges (NSE .NS and BSE .BO)
  const tickerVariants = [`${cleanSym}.NS`, `${cleanSym}.BO`];

  for (const ticker of tickerVariants) {
    try {
      const q = await yf.quote(ticker);
      if (q && q.regularMarketPrice !== undefined) {
        // Enforce Indian Rupees currency and Indian exchange to guarantee India stocks only
        const currency = q.currency || 'INR';
        if (currency !== 'INR' && !ticker.endsWith('.NS') && !ticker.endsWith('.BO')) {
          continue;
        }

        const quote: CompanyQuoteContext = {
          symbol: cleanSym,
          name: q.shortName || q.longName || cleanSym,
          price: q.regularMarketPrice,
          change: q.regularMarketChange || 0,
          changePercent: q.regularMarketChangePercent || 0,
          currency: 'INR',
          exchange: ticker.endsWith('.NS') ? 'NSE' : 'BSE',
          marketCap: q.marketCap,
          peRatio: q.trailingPE || q.forwardPE,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          dayHigh: q.regularMarketDayHigh,
          dayLow: q.regularMarketDayLow,
          volume: q.regularMarketVolume,
          avgVolume: q.averageDailyVolume3Month,
        };
        quoteCache.set(cleanSym, { data: quote, expiry: Date.now() + 300000 });
        return quote;
      }
    } catch {
      // Try next variant
    }
  }

  return null;
}

export async function getCompanyIntelligence(scripCode: string, symbol: string): Promise<CompanyIntelligenceData> {
  const targetSym = (symbol || '').trim().toUpperCase();
  const targetScrip = String(scripCode || '').trim();

  // 1. Fetch Quote & Valuation Context
  let quote: CompanyQuoteContext | null = null;
  if (targetSym) {
    quote = await fetchStockQuote(targetSym);
  }

  // 2. Fetch Historical Results & Calendar Data
  const rawHistory = await getStockResultsHistory(targetScrip, targetSym);
  const calendarData = await getResultsCalendarData();
  
  // Find strictly upcoming or today event from calendarData
  const upcomingItem = (calendarData.items || []).find((c: any) => 
    ((c.scripCode && String(c.scripCode).trim() === targetScrip) || 
     (c.symbol && targetSym && c.symbol.toUpperCase() === targetSym)) &&
    (c.status === 'UPCOMING' || c.status === 'TODAY' || (typeof c.daysLeft === 'number' && c.daysLeft >= 0))
  );

  let upcomingEvent = undefined;
  if (upcomingItem && (upcomingItem.daysLeft === undefined || upcomingItem.daysLeft >= 0)) {
    const today = new Date().toISOString().split('T')[0];
    const diffMs = new Date(upcomingItem.meetingDate).getTime() - new Date(today).getTime();
    const countdownDays = Math.ceil(diffMs / 86400000);
    const effectiveDays = upcomingItem.daysLeft !== undefined ? upcomingItem.daysLeft : countdownDays;

    if (effectiveDays >= 0) {
      upcomingEvent = {
        meetingDate: upcomingItem.meetingDate,
        purpose: upcomingItem.purpose || 'Board Meeting / Financial Results',
        countdownDays: effectiveDays,
        isDeclared: Boolean(upcomingItem.isDeclared),
        declarationDate: upcomingItem.isDeclared ? (upcomingItem.resultDeclarationTime?.split(',')[0]?.trim() || upcomingItem.meetingDate) : undefined,
        declarationTime: upcomingItem.isDeclared ? upcomingItem.resultDeclarationTime : undefined
      };
    }
  } else {
    // Check rawHistory for any strictly future or today meeting
    const futureMeeting = (rawHistory || []).find((h: any) => {
      if (h.status !== 'Scheduled Upcoming' && h.status !== 'Meeting Today') return false;
      const meetingTs = h.submissionTimestamp || parseBseDate(h.meetingDate);
      return meetingTs && meetingTs >= (Date.now() - 24 * 60 * 60 * 1000);
    });
    if (futureMeeting) {
      const meetingTs = futureMeeting.submissionTimestamp || parseBseDate(futureMeeting.meetingDate);
      const diffMs = meetingTs - Date.now();
      const countdownDays = Math.max(0, Math.ceil(diffMs / 86400000));
      upcomingEvent = {
        meetingDate: futureMeeting.meetingDate,
        purpose: futureMeeting.details || futureMeeting.subject || 'Board Meeting / Financial Results',
        countdownDays,
        isDeclared: Boolean(futureMeeting.isOutcome),
        declarationDate: futureMeeting.declarationDate,
        declarationTime: futureMeeting.declarationTime
      };
    }
  }

  // 3. Process Quarterly Financial Results (Include both declared outcomes and scheduled quarters)
  const resultMap = new Map<string, any>();
  for (const r of rawHistory || []) {
    const key = (r.quarterKey || r.periodOrMeeting || r.meetingDate).trim();
    if (!resultMap.has(key)) {
      resultMap.set(key, r);
    } else {
      const existing = resultMap.get(key);
      // Prefer declared outcome with PDF over pending meeting
      if ((!existing.pdfLink && r.pdfLink) || (!existing.isOutcome && r.isOutcome)) {
        resultMap.set(key, { ...existing, ...r });
      }
    }
  }
  const quarterlyResults = Array.from(resultMap.values()).sort((a, b) => (b.submissionTimestamp || 0) - (a.submissionTimestamp || 0));

  // 4. Extract Material Corporate Events Timeline & All Recent Filings
  const recentAnnouncements = await getRecentAnnouncements(10000);
  const rawStockAnnouncements = recentAnnouncements.filter((ann: any) => {
    const annScrip = String(ann.scrip_cd || ann.SCRIP_CD || ann.scripCode || '').trim();
    const annSym = (ann.symbol || '').toUpperCase().trim();
    const annComp = (ann.companyName || ann.SLONGNAME || '').toUpperCase();
    return (targetScrip && annScrip === targetScrip) ||
      (targetSym && (annSym === targetSym || annComp.includes(targetSym)));
  });

  const filingMap = new Map<string, any>();

  // Add all raw announcements from DB
  for (const ann of rawStockAnnouncements) {
    const id = ann.id || ann.NEWSID || `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sub = ann.subject || ann.NEWSSUB || '';
    const det = ann.details || ann.HEADLINE || '';
    const rawTime = ann.bseTime || ann.News_submission_dt || ann.DT_TM || ann.NEWS_DT || '';
    const ts = ann.bseTimestamp || ann.timestamp || (ann.fetched_at ? new Date(ann.fetched_at).getTime() : Date.now());
    const pdfLink = ann.pdfLink || (ann.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${ann.ATTACHMENTNAME}` : '');

    filingMap.set(id, {
      id,
      subject: sub,
      details: det,
      bseTime: rawTime || new Date(ts).toISOString(),
      pdfLink,
      timestamp: ts,
      scripCode: targetScrip,
      symbol: targetSym,
      category: ann.category,
      priority: ann.priority
    });
  }

  // Also include calendar & history items
  for (const h of rawHistory || []) {
    const hId = h.id || `hist_${h.meetingDate}`;
    if (!filingMap.has(hId)) {
      filingMap.set(hId, {
        id: hId,
        subject: h.subject || h.periodOrMeeting,
        details: h.details,
        bseTime: h.declarationDate ? `${h.declarationDate} ${h.declarationTime || ''}` : h.meetingDate,
        pdfLink: h.pdfLink,
        timestamp: h.submissionTimestamp || Date.now(),
        scripCode: targetScrip,
        symbol: targetSym
      });
    }
  }

  const allStockFilings = Array.from(filingMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const timelineEvents: MaterialEvent[] = [];
  for (const filing of allStockFilings) {
    const classified = classifyMaterialEvent(filing);
    if (classified) {
      timelineEvents.push(classified);
    }
  }

  // Deduplicate timeline events
  const uniqueTimeline: MaterialEvent[] = [];
  const seenEvents = new Set<string>();
  for (const ev of timelineEvents) {
    const evKey = `${ev.eventType}_${ev.dateStr}_${ev.title.slice(0, 30)}`;
    if (!seenEvents.has(evKey)) {
      seenEvents.add(evKey);
      uniqueTimeline.push(ev);
    }
  }
  uniqueTimeline.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return {
    symbol: targetSym || quote?.name || targetScrip,
    scripCode: targetScrip,
    companyName: quote?.name || targetSym || "BSE Listed Stock",
    quote: quote || undefined,
    upcomingEvent,
    quarterlyResults,
    materialTimeline: uniqueTimeline,
    recentFilings: allStockFilings.slice(0, 40)
  };
}

export async function generateCompanyAiOverview(scripCode: string, symbol: string): Promise<string> {
  const intel = await getCompanyIntelligence(scripCode, symbol);
  
  const filingsSummary = (intel.recentFilings || []).slice(0, 8).map(f => `- ${f.bseTime || 'Recent'}: ${f.subject}`).join('\n');
  const resultsSummary = (intel.quarterlyResults || []).slice(0, 4).map(q => `- ${q.periodOrMeeting}: Declared on ${q.declarationDate || q.meetingDate}`).join('\n');

  const detailsText = `
Price: ${intel.quote?.price ? `₹${intel.quote.price}` : 'N/A'}, 52W: ${intel.quote?.fiftyTwoWeekLow ? `₹${intel.quote.fiftyTwoWeekLow} - ₹${intel.quote.fiftyTwoWeekHigh}` : 'N/A'}
Recent Results:
${resultsSummary || 'None'}
Recent Filings:
${filingsSummary || 'None'}
  `.trim();

  try {
    const summary = await generateDirectSummary(intel.companyName, `360 Corporate Intelligence Brief: ${intel.companyName}`, detailsText, 'OTHER');
    return summary || `Analysis for ${intel.companyName}: Active BSE tracking initialized. ${intel.quarterlyResults.length} quarterly results indexed with ${intel.materialTimeline.length} material corporate actions tracked.`;
  } catch (e: any) {
    return `Analysis for ${intel.companyName}: Active BSE tracking initialized. ${intel.quarterlyResults.length} quarterly results indexed with ${intel.materialTimeline.length} material corporate actions tracked.`;
  }
}
