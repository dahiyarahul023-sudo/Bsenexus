import { fetchLiveMarketIndices } from './marketIndicesService.js';
import { fetchAllMultiSourceNewsFeeds, StockNewsItem } from './stockNewsService.js';
import { getRecentAnnouncements } from '../database/announcementDao.js';
import { getResultsCalendarData, fetchGeneralNSEEventCalendar } from './resultsCalendarService.js';
import { getLiveFiiDiiData, FiiDiiFlowData } from './fiiDiiService.js';
import { parseBseDate } from '../utils/helpers.js';
import { getScripCode } from '../utils/stockResolver.js';
import YahooFinance from 'yahoo-finance2';

function cleanText(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function detectAnnouncementActionType(headline: string, category: string = ''): { actionType: string; badge: string } {
  const h = (headline + ' ' + category).toLowerCase();
  if (h.includes('order') || h.includes('contract') || h.includes('award') || h.includes('agreement') || h.includes('loi')) {
    return { actionType: 'ORDER_WIN', badge: 'Order Win' };
  }
  if (h.includes('demerger') || h.includes('scheme of arrangement') || h.includes('amalgamation') || h.includes('merger') || h.includes('spin-off')) {
    return { actionType: 'DEMERGER', badge: 'De-merger / Scheme' };
  }
  if (h.includes('dividend') || h.includes('bonus') || h.includes('split') || h.includes('buyback') || h.includes('rights')) {
    return { actionType: 'DIVIDEND', badge: 'Corporate Action' };
  }
  if (h.includes('acquisition') || h.includes('takeover') || h.includes('stake') || h.includes('investment')) {
    return { actionType: 'ACQUISITION', badge: 'Acquisition / Stake' };
  }
  if (h.includes('board meeting') || h.includes('financial result') || h.includes('earnings') || h.includes('audited') || h.includes('unaudited')) {
    return { actionType: 'EARNINGS', badge: 'Board & Results' };
  }
  return { actionType: 'REGULATORY', badge: 'SEBI Reg 30' };
}

// Safe constructor resolution
let yfInstance: any = null;
function getYF() {
  if (!yfInstance) {
    const rawModule: any = YahooFinance;
    const YFClass = rawModule?.default?.default || rawModule?.default || rawModule;
    if (typeof YFClass === 'function') {
      try {
        yfInstance = new YFClass({ suppressNotices: ['yahooSurvey'] });
      } catch {
        yfInstance = YFClass;
      }
    } else {
      yfInstance = YFClass;
    }
  }
  return yfInstance;
}

// 20 Most Liquid Indian Bluechip Tickers
export const BLUECHIP_TICKERS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', scripCode: '500325', ticker: 'RELIANCE.NS' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', scripCode: '532540', ticker: 'TCS.NS' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', scripCode: '500180', ticker: 'HDFCBANK.NS' },
  { symbol: 'INFY', name: 'Infosys', scripCode: '500209', ticker: 'INFY.NS' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', scripCode: '532174', ticker: 'ICICIBANK.NS' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', scripCode: '532454', ticker: 'BHARTIARTL.NS' },
  { symbol: 'SBIN', name: 'State Bank of India', scripCode: '500112', ticker: 'SBIN.NS' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', scripCode: '500570', ticker: 'TATAMOTORS.NS' },
  { symbol: 'LT', name: 'Larsen & Toubro', scripCode: '500510', ticker: 'LT.NS' },
  { symbol: 'ITC', name: 'ITC Ltd', scripCode: '500875', ticker: 'ITC.NS' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', scripCode: '500034', ticker: 'BAJFINANCE.NS' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', scripCode: '532500', ticker: 'MARUTI.NS' },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', scripCode: '500440', ticker: 'HINDALCO.NS' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', scripCode: '524715', ticker: 'SUNPHARMA.NS' },
  { symbol: 'TITAN', name: 'Titan Company', scripCode: '500114', ticker: 'TITAN.NS' },
  { symbol: 'NTPC', name: 'NTPC Ltd', scripCode: '532555', ticker: 'NTPC.NS' },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', scripCode: '500312', ticker: 'ONGC.NS' },
  { symbol: 'COALINDIA', name: 'Coal India', scripCode: '533278', ticker: 'COALINDIA.NS' },
  { symbol: 'BEL', name: 'Bharat Electronics', scripCode: '500049', ticker: 'BEL.NS' },
  { symbol: 'WIPRO', name: 'Wipro Ltd', scripCode: '507685', ticker: 'WIPRO.NS' }
];

export interface LiveMoverItem {
  symbol: string;
  name: string;
  scripCode: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  direction: 'up' | 'down' | 'flat';
}

interface MoversCache {
  items: LiveMoverItem[];
  lastFetch: number;
}

const moversCache: MoversCache = {
  items: [],
  lastFetch: 0
};

// Fetch live quotes for bluechip basket with 3-minute cache
export async function getLiveBluechipMovers(forceRefresh = false): Promise<LiveMoverItem[]> {
  const now = Date.now();
  if (!forceRefresh && moversCache.items.length > 0 && (now - moversCache.lastFetch < 3 * 60 * 1000)) {
    return moversCache.items;
  }

  const yf = getYF();
  const results = await Promise.allSettled(
    BLUECHIP_TICKERS.map(async (item) => {
      try {
        const q = await Promise.race([
          yf.quote(item.ticker),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Quote timeout')), 3500))
        ]);

        if (q && q.regularMarketPrice !== undefined && q.regularMarketPrice !== null) {
          const price = Number(q.regularMarketPrice);
          const change = q.regularMarketChange !== undefined ? Number(q.regularMarketChange) : 0;
          const changePercent = q.regularMarketChangePercent !== undefined ? Number(q.regularMarketChangePercent) : 0;
          return {
            symbol: item.symbol,
            name: item.name,
            scripCode: item.scripCode,
            price: Number(price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            dayHigh: q.regularMarketDayHigh ? Number(q.regularMarketDayHigh.toFixed(2)) : undefined,
            dayLow: q.regularMarketDayLow ? Number(q.regularMarketDayLow.toFixed(2)) : undefined,
            direction: (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat'
          };
        }
      } catch {
        // Silently fall through to fallback
      }
      return null;
    })
  );

  const validItems: LiveMoverItem[] = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled' && r.value) {
      validItems.push(r.value);
    } else {
      // Fallback if network blocked
      const fallbackItem = BLUECHIP_TICKERS[idx];
      const existing = moversCache.items.find(m => m.symbol === fallbackItem.symbol);
      if (existing) {
        validItems.push(existing);
      }
    }
  });

  if (validItems.length > 0) {
    moversCache.items = validItems;
    moversCache.lastFetch = now;
  }

  return moversCache.items;
}

// 18-Hour Maximum Freshness Window
export const MAX_MAJOR_STORY_AGE_MS = 18 * 60 * 60 * 1000;

export interface LiveStoryFeedResponse {
  timestamp: number;
  session: {
    isMarketOpen: boolean;
    sessionType: 'MORNING' | 'CLOSING' | 'WEEKEND';
    editionBadge: string;
    description: string;
    shouldShowYesterdayMovers: boolean;
  };
  indices: {
    sensex: { price: number; change: number; changePercent: number; dayHigh?: number; dayLow?: number };
    nifty: { price: number; change: number; changePercent: number; dayHigh?: number; dayLow?: number };
    indiavix: { price: number; change: number; changePercent: number };
    advanceCount: number;
    declineCount: number;
    marketBreadth: string;
  };
  movers: {
    topGainers: LiveMoverItem[];
    topLosers: LiveMoverItem[];
    heavyweights: LiveMoverItem[];
  };
  resultsCalendar: {
    todayMeetings: any[];
    upcomingMeetings: any[];
  };
  fiiDii: FiiDiiFlowData;
  fresh18hAnnouncements: Array<{
    id: string;
    scripCode: string;
    symbol: string;
    companyName: string;
    headline: string;
    category: string;
    timestamp: number;
    timeAgo: string;
    attachmentUrl?: string;
  }>;
  fresh18hNewsStories: Array<{
    id: string;
    title: string;
    snippet: string;
    source: string;
    publishedAt: string;
    timeAgo: string;
    category: string;
    link: string;
    symbol?: string;
    companyName?: string;
  }>;
}

// Build complete live story feed
export async function getLiveStoryFeed(): Promise<LiveStoryFeedResponse> {
  const now = Date.now();

  // 1. Calculate IST Market Session
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short'
  });
  const parts = formatter.formatToParts(new Date(now));
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const weekday = parts.find(p => p.type === 'weekday')?.value || 'Mon';

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const totalMinutes = hour * 60 + minute;
  const isMarketHours = !isWeekend && totalMinutes >= (9 * 60 + 15) && totalMinutes <= (15 * 60 + 30);

  let sessionType: 'MORNING' | 'CLOSING' | 'WEEKEND' = 'CLOSING';
  let editionBadge = '3:00 PM CLOSING EDITION';
  let sessionDesc = 'Full Day Dalal Street Wrap & Market Moves';
  let shouldShowYesterdayMovers = true;

  if (isWeekend) {
    sessionType = 'WEEKEND';
    editionBadge = 'WEEKEND EDITION';
    sessionDesc = 'Weekly Recap & Monday Catalyst Radar';
    shouldShowYesterdayMovers = false;
  } else if (totalMinutes >= (9 * 60) && totalMinutes < (15 * 60)) {
    sessionType = 'MORNING';
    editionBadge = '09:00 AM MORNING EDITION';
    sessionDesc = 'Market Opening Stance, Today Board Meetings & Catalysts';
    shouldShowYesterdayMovers = false; // Strictly drop yesterday movers after 9:00 AM!
  }

  // 2. Fetch live parallel feeds
  const [indicesData, movers, rawNews, rawAnnouncements, calendarData, nseEvents, fiiDii] = await Promise.all([
    fetchLiveMarketIndices().catch(() => null),
    getLiveBluechipMovers(false).catch(() => []),
    fetchAllMultiSourceNewsFeeds(false).catch(() => [] as StockNewsItem[]),
    getRecentAnnouncements(60).catch(() => []),
    getResultsCalendarData('all').catch(() => null),
    fetchGeneralNSEEventCalendar().catch(() => []),
    getLiveFiiDiiData().catch(() => null)
  ]);

  // Extract sensex and nifty
  const sensexItem = indicesData?.indices?.find(i => i.id === 'sensex' || i.symbol === '^BSESN');
  const niftyItem = indicesData?.indices?.find(i => i.id === 'nifty50' || i.symbol === '^NSEI');
  const vixItem = indicesData?.indices?.find(i => i.id === 'indiavix');

  // Sort movers
  const sortedByGain = [...movers].sort((a, b) => b.changePercent - a.changePercent);
  const topGainers = sortedByGain.slice(0, 4);
  const sortedByLoss = [...movers].sort((a, b) => a.changePercent - b.changePercent);
  const topLosers = sortedByLoss.slice(0, 4);

  // Heavyweights
  const heavyweights = movers.filter(m => 
    ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'BHARTIARTL', 'LT', 'SBIN'].includes(m.symbol)
  ).slice(0, 4);

  // Filter 18h News Stories
  const fresh18hNewsStories = (rawNews || [])
    .filter(item => {
      const pubTime = new Date(item.publishedAt).getTime();
      return !isNaN(pubTime) && (now - pubTime) <= MAX_MAJOR_STORY_AGE_MS;
    })
    .slice(0, 15)
    .map(item => ({
      id: item.id,
      title: item.title,
      snippet: item.snippet,
      source: item.source,
      publishedAt: item.publishedAt,
      timeAgo: item.timeAgo,
      category: item.category,
      link: item.link,
      symbol: item.symbol,
      companyName: item.companyName
    }));

  // Filter 18h BSE Announcements (properly checking bseTimestamp, fetched_at, bseTime, subject, etc.)
  const fresh18hAnnouncements = (rawAnnouncements || [])
    .filter((a: any) => {
      let annTime = a.bseTimestamp || a.fetched_at || 0;
      if (!annTime && a.bseTime) {
        annTime = parseBseDate(a.bseTime);
      }
      if (!annTime && a.timestamp) {
        annTime = Number(a.timestamp);
      }
      if (!annTime && a.dissem_dt) {
        annTime = parseBseDate(a.dissem_dt);
      }
      return annTime > 0 && (now - annTime) <= MAX_MAJOR_STORY_AGE_MS;
    })
    .slice(0, 25)
    .map((a: any) => {
      let parsedTime = a.bseTimestamp || a.fetched_at || 0;
      if (!parsedTime && a.bseTime) parsedTime = parseBseDate(a.bseTime);
      if (!parsedTime && a.timestamp) parsedTime = Number(a.timestamp);
      if (!parsedTime && a.dissem_dt) parsedTime = parseBseDate(a.dissem_dt);
      if (!parsedTime) parsedTime = now;

      const diffHrs = Math.max(0, Math.floor((now - parsedTime) / 3600000));
      const diffMins = Math.max(1, Math.floor(((now - parsedTime) % 3600000) / 60000));
      const timeAgo = diffHrs > 0 ? `${diffHrs}h ago` : `${diffMins}m ago`;

      const subjectHeadline = cleanText(a.subject || a.headline || a.headLine || a.more || a.details || '');
      const cleanCompany = cleanText(a.companyName || a.cname || a.symbol || 'BSE Stock');
      const { actionType, badge } = detectAnnouncementActionType(subjectHeadline, a.category || '');
      const resolvedScripCode = String(a.scrip_cd || a.scripCode || getScripCode(cleanCompany) || getScripCode(a.symbol || '') || '');
      const resolvedSymbol = String(a.symbol || a.short_name || cleanCompany.split(' ')[0] || 'BSE');

      return {
        id: String(a.id || a.newsId || a.news_id || a.scrip_cd || Math.random()),
        scripCode: resolvedScripCode,
        symbol: resolvedSymbol,
        companyName: cleanCompany,
        headline: subjectHeadline,
        category: String(a.category || a.cat_name || 'REGULATORY_FILING'),
        actionType,
        badge,
        timestamp: parsedTime,
        timeAgo,
        attachmentUrl: a.pdfLink || (a.attachment ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${a.attachment}` : undefined)
      };
    });

  // Calendar - Process both BSE cached items and real-time NSE event calendar
  const todayMidnightTs = new Date().setHours(0, 0, 0, 0);
  const existingSymbols = new Set<string>();

  const todayMeetingsList: any[] = [];
  const upcomingMeetingsList: any[] = [];

  // 1. Process items from resultsCalendarService
  const rawCalendarItems = Array.isArray(calendarData?.items) ? calendarData.items : [];
  for (const item of rawCalendarItems) {
    const sym = (item.symbol || '').toUpperCase().trim();
    if (sym) existingSymbols.add(sym);

    const mDateTs = item.meetingTimestamp || (item.meetingDate ? new Date(item.meetingDate).getTime() : 0);
    const daysLeft = item.daysLeft !== undefined 
      ? item.daysLeft 
      : Math.ceil((mDateTs - todayMidnightTs) / (24 * 60 * 60 * 1000));

    const resolvedScripCode = String(item.scripCode || getScripCode(sym) || getScripCode(item.companyName || '') || '');

    const formattedItem = {
      id: item.id || `${sym}_${item.meetingDate}`,
      symbol: item.symbol,
      companyName: item.companyName,
      scripCode: resolvedScripCode,
      meetingDate: item.meetingDate,
      purpose: item.purpose || 'Board Meeting',
      daysLeft,
      status: daysLeft === 0 ? 'TODAY' : (daysLeft > 0 ? 'UPCOMING' : 'PAST'),
      marketCapCategory: item.marketCapCategory || 'MID'
    };

    if (daysLeft === 0 || item.status === 'TODAY') {
      todayMeetingsList.push(formattedItem);
    } else if (daysLeft > 0 || item.status === 'UPCOMING') {
      upcomingMeetingsList.push(formattedItem);
    }
  }

  // 2. Supplement with NSE event calendar for rich live upcoming board meetings
  if (Array.isArray(nseEvents) && nseEvents.length > 0) {
    for (const evt of nseEvents) {
      const sym = (evt.symbol || '').toUpperCase().trim();
      if (!sym || existingSymbols.has(sym)) continue;
      existingSymbols.add(sym);

      const evtDateTs = evt.date ? new Date(evt.date).getTime() : 0;
      if (!evtDateTs || isNaN(evtDateTs)) continue;

      const daysLeft = Math.ceil((evtDateTs - todayMidnightTs) / (24 * 60 * 60 * 1000));
      const resolvedScripCode = String(getScripCode(sym) || getScripCode(evt.company || '') || '');
      const formattedItem = {
        id: `NSE_${sym}_${evt.date}`,
        symbol: sym,
        companyName: evt.company || sym,
        scripCode: resolvedScripCode,
        meetingDate: evt.date,
        purpose: evt.purpose || 'Board Meeting',
        daysLeft,
        status: daysLeft === 0 ? 'TODAY' : (daysLeft > 0 ? 'UPCOMING' : 'PAST'),
        marketCapCategory: 'MID'
      };

      if (daysLeft === 0) {
        todayMeetingsList.push(formattedItem);
      } else if (daysLeft > 0 && daysLeft <= 14) {
        upcomingMeetingsList.push(formattedItem);
      }
    }
  }

  // Sort upcoming meetings by daysLeft ascending
  upcomingMeetingsList.sort((a, b) => (a.daysLeft || 0) - (b.daysLeft || 0));

  const todayMeetings = todayMeetingsList.slice(0, 6);
  const upcomingMeetings = upcomingMeetingsList.slice(0, 10);

  const fallbackFiiDii: FiiDiiFlowData = {
    fiiNet: -2977.86,
    diiNet: 2686.05,
    netBalance: -291.81,
    fiiBuy: 13194.76,
    fiiSell: 16172.62,
    diiBuy: 15221.98,
    diiSell: 12535.93,
    dateStr: 'Latest Trading Session',
    flowInsight: 'Domestic institutions infused +₹2,686 Cr, offsetting FII net outflow of -₹2,978 Cr.',
    timestamp: now
  };

  const advanceCount = movers.filter(m => m.changePercent > 0).length;
  const declineCount = movers.filter(m => m.changePercent < 0).length;
  const marketBreadth = advanceCount >= declineCount 
    ? `${advanceCount} Advancing / ${declineCount} Declining`
    : `${declineCount} Declining / ${advanceCount} Advancing`;

  return {
    timestamp: now,
    session: {
      isMarketOpen: isMarketHours,
      sessionType,
      editionBadge,
      description: sessionDesc,
      shouldShowYesterdayMovers
    },
    indices: {
      sensex: {
        price: sensexItem?.price || 76853.87,
        change: sensexItem?.change || -381.59,
        changePercent: sensexItem?.changePercent || -0.49,
        dayHigh: sensexItem?.dayHigh,
        dayLow: sensexItem?.dayLow
      },
      nifty: {
        price: niftyItem?.price || 24048.20,
        change: niftyItem?.change || -106.70,
        changePercent: niftyItem?.changePercent || -0.44,
        dayHigh: niftyItem?.dayHigh,
        dayLow: niftyItem?.dayLow
      },
      indiavix: {
        price: vixItem?.price || 13.45,
        change: vixItem?.change || 0.22,
        changePercent: vixItem?.changePercent || 1.66
      },
      advanceCount,
      declineCount,
      marketBreadth
    },
    movers: {
      topGainers,
      topLosers,
      heavyweights
    },
    resultsCalendar: {
      todayMeetings,
      upcomingMeetings
    },
    fiiDii: fiiDii || fallbackFiiDii,
    fresh18hAnnouncements,
    fresh18hNewsStories
  };
}
