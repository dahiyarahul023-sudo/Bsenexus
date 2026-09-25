import YahooFinance from 'yahoo-finance2';

let yfClient: any = null;
function getYF() {
  if (!yfClient) {
    const rawModule = YahooFinance as any;
    const YFClass = rawModule?.default?.default || rawModule?.default || rawModule;
    if (typeof YFClass === 'function') {
      try {
        yfClient = new YFClass({ suppressNotices: ['yahooSurvey'] });
      } catch {
        yfClient = YFClass;
      }
    } else if (typeof rawModule?.quote === 'function') {
      yfClient = rawModule;
    } else {
      yfClient = YFClass;
    }
  }
  return yfClient;
}

export interface MarketIndexItem {
  id: string;
  symbol: string;
  alternateSymbols?: string[];
  name: string;
  category: 'EQUITY_INDEX' | 'VOLATILITY' | 'CURRENCY';
  price: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  currency: string;
  lastUpdated: string;
  description?: string;
  source?: string;
}

export interface MarketOverviewData {
  indices: MarketIndexItem[];
  isMarketOpen: boolean;
  marketSession: 'REGULAR' | 'CLOSED' | 'PRE_MARKET' | 'CLOSING_WINDOW_10MIN' | 'POST_MARKET';
  lastRefreshed: number;
  marketStatusText: string;
  sessionBadge: string;
}

// Indian Stock Exchange (NSE/BSE) Official Trading Holidays (Month-Day format MM-DD)
const NSE_BSE_HOLIDAYS_MAP: Record<string, string> = {
  '01-26': 'Republic Day',
  '03-08': 'Mahashivratri',
  '03-25': 'Holi',
  '03-29': 'Good Friday',
  '04-11': 'Id-Ul-Fitr (Ramzan Id)',
  '04-17': 'Shri Ram Navami',
  '04-21': 'Mahavir Jayanti',
  '05-01': 'Maharashtra Day',
  '06-17': 'Bakri Id / Eid ul-Adha',
  '07-17': 'Muharram',
  '08-15': 'Independence Day',
  '09-07': 'Ganesh Chaturthi',
  '10-02': 'Mahatma Gandhi Jayanti',
  '10-12': 'Dussehra',
  '11-01': 'Diwali Laxmi Pujan',
  '11-15': 'Gurunanak Jayanti',
  '12-25': 'Christmas'
};

// Rolling in-memory live state
const ROLLING_INDICES_STATE: MarketIndexItem[] = [
  {
    id: 'sensex',
    symbol: '^BSESN',
    name: 'SENSEX (BSE 30)',
    category: 'EQUITY_INDEX',
    price: 76853.87,
    change: -381.59,
    changePercent: -0.49,
    dayHigh: 77347.81,
    dayLow: 76823.91,
    previousClose: 77728.20,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'BSE SENSEX 30 Blue-Chips',
    source: 'BSE_OFFICIAL'
  },
  {
    id: 'nifty50',
    symbol: '^NSEI',
    name: 'NIFTY 50',
    category: 'EQUITY_INDEX',
    price: 24048.20,
    change: -106.70,
    changePercent: -0.44,
    dayHigh: 24172.85,
    dayLow: 24027.90,
    previousClose: 24154.90,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'NSE Top 50 Benchmark',
    source: 'NSE_OFFICIAL'
  },
  {
    id: 'banknifty',
    symbol: '^NSEBANK',
    name: 'BANK NIFTY',
    category: 'EQUITY_INDEX',
    price: 57111.45,
    change: -150.95,
    changePercent: -0.26,
    dayHigh: 57356.85,
    dayLow: 57001.75,
    previousClose: 57262.40,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'Indian Banking Sector Benchmark',
    source: 'NSE_OFFICIAL'
  },
  {
    id: 'niftymidcap',
    symbol: 'NIFTY_MIDCAP_100.NS',
    name: 'NIFTY MIDCAP',
    category: 'EQUITY_INDEX',
    price: 63404.35,
    change: -135.05,
    changePercent: -0.21,
    dayHigh: 63593.00,
    dayLow: 63198.40,
    previousClose: 63539.40,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'Top 100 Midcap Equities',
    source: 'NSE_OFFICIAL'
  },
  {
    id: 'indiavix',
    symbol: '^INDIAVIX',
    name: 'INDIA VIX',
    category: 'VOLATILITY',
    price: 11.50,
    change: 0.11,
    changePercent: 1.00,
    dayHigh: 11.73,
    dayLow: 10.06,
    previousClose: 11.39,
    currency: 'POINTS',
    lastUpdated: new Date().toISOString(),
    description: 'NSE Volatility & Fear Index',
    source: 'NSE_OFFICIAL'
  },
  {
    id: 'usdinr',
    symbol: 'INR=X',
    name: 'USD / INR',
    category: 'CURRENCY',
    price: 95.74,
    change: 0.07,
    changePercent: 0.07,
    dayHigh: 95.76,
    dayLow: 95.67,
    previousClose: 95.67,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'US Dollar to Indian Rupee Exchange Rate',
    source: 'NSE_FOREX'
  }
];

let cachedMarketData: MarketOverviewData | null = null;
let lastFetchTime = 0;
let inFlightFetchPromise: Promise<MarketOverviewData> | null = null;

// NSE Cookie Session Holder
let nseCookie: string = '';
let nseCookieExpiry = 0;

// Rate-limiting intervals (4 req/min during market, 1 req/min when closed)
const LIVE_MARKET_TTL_MS = 15000; // 15 seconds (4 requests/minute)
const CLOSED_MARKET_TTL_MS = 60000; // 60 seconds (1 request/minute)

export function getMarketSessionStatus(): {
  isMarketOpen: boolean;
  session: 'REGULAR' | 'CLOSED' | 'PRE_MARKET' | 'CLOSING_WINDOW_10MIN' | 'POST_MARKET';
  statusText: string;
  sessionBadge: string;
} {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  
  const day = istTime.getDay(); // 0 = Sun, 6 = Sat
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const date = String(istTime.getDate()).padStart(2, '0');
  const monthDateKey = `${month}-${date}`;
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 1. Weekend Check
  if (day === 0 || day === 6) {
    return {
      isMarketOpen: false,
      session: 'CLOSED',
      statusText: 'Market Closed (Weekend)',
      sessionBadge: 'WEEKEND'
    };
  }

  // 2. Official Indian Exchange Holiday Check
  if (NSE_BSE_HOLIDAYS_MAP[monthDateKey]) {
    const holidayName = NSE_BSE_HOLIDAYS_MAP[monthDateKey];
    return {
      isMarketOpen: false,
      session: 'CLOSED',
      statusText: `Market Closed (${holidayName})`,
      sessionBadge: 'HOLIDAY'
    };
  }

  // 3. Pre-Market (09:00 - 09:15 IST)
  if (totalMinutes >= 540 && totalMinutes < 555) {
    if (totalMinutes < 548) {
      return {
        isMarketOpen: false,
        session: 'PRE_MARKET',
        statusText: 'Pre-Market Order Placement (09:00 - 09:08 IST)',
        sessionBadge: 'PRE-OPEN'
      };
    }
    return {
      isMarketOpen: false,
      session: 'PRE_MARKET',
      statusText: 'Pre-Market Price Discovery (09:08 - 09:15 IST)',
      sessionBadge: 'PRICE DISCOVERY'
    };
  }

  // 4. Regular Live Trading: 09:15 AM - 03:30 PM (555 to 930 mins)
  if (totalMinutes >= 555 && totalMinutes < 930) {
    return {
      isMarketOpen: true,
      session: 'REGULAR',
      statusText: 'Live Market Open (09:15 - 15:30 IST)',
      sessionBadge: 'MARKET LIVE'
    };
  }

  // 5. 10-Min Closing Window: 03:30 PM - 03:40 PM (930 to 940 mins)
  if (totalMinutes >= 930 && totalMinutes < 940) {
    return {
      isMarketOpen: false,
      session: 'CLOSING_WINDOW_10MIN',
      statusText: '10-Min Closing Price Window (15:30 - 15:40 IST)',
      sessionBadge: '10-MIN POST-CLOSE'
    };
  }

  // 6. Post-Market Trading Session: 03:40 PM - 04:00 PM (940 to 960 mins)
  if (totalMinutes >= 940 && totalMinutes < 960) {
    return {
      isMarketOpen: false,
      session: 'POST_MARKET',
      statusText: 'Post-Market Trading (15:40 - 16:00 IST)',
      sessionBadge: 'POST-CLOSE'
    };
  }

  // 7. Night / After-Hours Closed
  return {
    isMarketOpen: false,
    session: 'CLOSED',
    statusText: 'Market Closed (Re-opens 09:00 AM IST)',
    sessionBadge: 'CLOSED'
  };
}

// -------------------------------------------------------------
// 1. Direct Official BSE India API for SENSEX (BSE 30)
// -------------------------------------------------------------
async function fetchDirectBseSensex(): Promise<MarketIndexItem | null> {
  const bseEndpoints = [
    'https://api.bseindia.com/BseIndiaAPI/api/GetSensexDataLive/w',
    'https://api.bseindia.com/BseIndiaAPI/api/GetIndexData/w?index=16'
  ];

  for (const url of bseEndpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://www.bseindia.com/',
          'Origin': 'https://www.bseindia.com',
          'Accept': 'application/json, text/plain, */*'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const curval = parseFloat(data.curval || data.CurVal || data.currentValue || data.ltp || (Array.isArray(data) && data[0]?.curval));
        if (!isNaN(curval) && curval > 1000) {
          const chg = parseFloat(data.chg || data.Chg || data.change || (Array.isArray(data) && data[0]?.chg) || '0');
          const pChg = parseFloat(data.pChg || data.PChg || data.percentChange || (Array.isArray(data) && data[0]?.pChg) || '0');
          const highRaw = data.high ?? data.High;
          const lowRaw = data.low ?? data.Low;
          const high = highRaw != null ? parseFloat(highRaw) : NaN;
          const low = lowRaw != null ? parseFloat(lowRaw) : NaN;
          const prevClose = parseFloat(data.prevclose || data.PrevClose || (curval - chg));

          return {
            id: 'sensex',
            symbol: '^BSESN',
            name: 'SENSEX (BSE 30)',
            category: 'EQUITY_INDEX',
            price: curval,
            change: isNaN(chg) ? 0 : chg,
            changePercent: isNaN(pChg) ? 0 : pChg,
            dayHigh: isNaN(high) ? undefined : high,
            dayLow: isNaN(low) ? undefined : low,
            previousClose: isNaN(prevClose) ? (curval - chg) : prevClose,
            currency: 'INR',
            lastUpdated: new Date().toISOString(),
            description: 'BSE SENSEX 30 Blue-Chips (Official BSE Live Feed)',
            source: 'BSE_OFFICIAL_DIRECT'
          };
        }
      }
    } catch {
      // try next endpoint or fallback
    }
  }

  return null;
}

// -------------------------------------------------------------
// 2. Direct Official NSE India API for NIFTY, BANK NIFTY, MIDCAP, VIX, USDINR
// -------------------------------------------------------------
async function refreshNseSessionCookie(): Promise<string> {
  const now = Date.now();
  if (nseCookie && now < nseCookieExpiry) {
    return nseCookie;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const rawCookies = res.headers.get('set-cookie');
    if (rawCookies) {
      nseCookie = rawCookies.split(',').map(c => c.split(';')[0]).join('; ');
      nseCookieExpiry = now + (10 * 60 * 1000); // 10 min session validity
      return nseCookie;
    }
  } catch {
    // ignore
  }

  return '';
}

async function fetchDirectNseIndices(): Promise<Partial<Record<string, MarketIndexItem>>> {
  const results: Partial<Record<string, MarketIndexItem>> = {};

  try {
    const cookie = await refreshNseSessionCookie();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://www.nseindia.com/api/allIndices', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(cookie ? { 'Cookie': cookie } : {})
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const items = json.data || [];

      for (const item of items) {
        const indexName = (item.index || item.indexSymbol || '').toUpperCase();
        const last = parseFloat(item.last || item.lastPrice);
        const change = parseFloat(item.change || 0);
        const percentChange = parseFloat(item.percentChange || item.pChange || 0);
        const highRaw = item.high ?? null;
        const lowRaw = item.low ?? null;
        const high = highRaw != null ? parseFloat(highRaw) : NaN;
        const low = lowRaw != null ? parseFloat(lowRaw) : NaN;
        const previousClose = parseFloat(item.previousClose || (last - change));

        if (!isNaN(last) && last > 0) {
          if (indexName === 'NIFTY 50') {
            results['nifty50'] = {
              id: 'nifty50',
              symbol: '^NSEI',
              name: 'NIFTY 50',
              category: 'EQUITY_INDEX',
              price: last,
              change,
              changePercent: percentChange,
              dayHigh: isNaN(high) ? undefined : high,
              dayLow: isNaN(low) ? undefined : low,
              previousClose,
              currency: 'INR',
              lastUpdated: new Date().toISOString(),
              description: 'NSE Top 50 Benchmark (Official NSE Live Feed)',
              source: 'NSE_OFFICIAL_DIRECT'
            };
          } else if (indexName === 'NIFTY BANK') {
            results['banknifty'] = {
              id: 'banknifty',
              symbol: '^NSEBANK',
              name: 'BANK NIFTY',
              category: 'EQUITY_INDEX',
              price: last,
              change,
              changePercent: percentChange,
              dayHigh: isNaN(high) ? undefined : high,
              dayLow: isNaN(low) ? undefined : low,
              previousClose,
              currency: 'INR',
              lastUpdated: new Date().toISOString(),
              description: 'Indian Banking Sector Benchmark (Official NSE Live Feed)',
              source: 'NSE_OFFICIAL_DIRECT'
            };
          } else if (indexName.includes('MIDCAP 100') || indexName === 'NIFTY MIDCAP 100') {
            results['niftymidcap'] = {
              id: 'niftymidcap',
              symbol: 'NIFTY_MIDCAP_100.NS',
              name: 'NIFTY MIDCAP',
              category: 'EQUITY_INDEX',
              price: last,
              change,
              changePercent: percentChange,
              dayHigh: isNaN(high) ? undefined : high,
              dayLow: isNaN(low) ? undefined : low,
              previousClose,
              currency: 'INR',
              lastUpdated: new Date().toISOString(),
              description: 'Top 100 Midcap Equities (Official NSE Live Feed)',
              source: 'NSE_OFFICIAL_DIRECT'
            };
          } else if (indexName === 'INDIA VIX') {
            results['indiavix'] = {
              id: 'indiavix',
              symbol: '^INDIAVIX',
              name: 'INDIA VIX',
              category: 'VOLATILITY',
              price: last,
              change,
              changePercent: percentChange,
              dayHigh: isNaN(high) ? undefined : high,
              dayLow: isNaN(low) ? undefined : low,
              previousClose,
              currency: 'POINTS',
              lastUpdated: new Date().toISOString(),
              description: 'NSE Volatility & Fear Index (Official NSE Live Feed)',
              source: 'NSE_OFFICIAL_DIRECT'
            };
          }
        }
      }
    }
  } catch {
    // fallback will handle
  }

  return results;
}

// -------------------------------------------------------------
// 3. Parallel Secondary Fallback Layer (Yahoo Finance Quote)
// -------------------------------------------------------------
const FALLBACK_CONFIG = [
  { id: 'sensex', symbol: '^BSESN', name: 'SENSEX (BSE 30)', category: 'EQUITY_INDEX' as const, description: 'BSE SENSEX 30 Blue-Chips' },
  { id: 'nifty50', symbol: '^NSEI', name: 'NIFTY 50', category: 'EQUITY_INDEX' as const, description: 'NSE Top 50 Companies' },
  { id: 'banknifty', symbol: '^NSEBANK', name: 'BANK NIFTY', category: 'EQUITY_INDEX' as const, description: 'Indian Banking Sector' },
  { id: 'niftymidcap', symbol: 'NIFTY_MIDCAP_100.NS', alternateSymbols: ['^CRSLDX'], name: 'NIFTY MIDCAP', category: 'EQUITY_INDEX' as const, description: 'Top 100 Midcap Equities' },
  { id: 'indiavix', symbol: '^INDIAVIX', name: 'INDIA VIX', category: 'VOLATILITY' as const, description: 'Market Volatility & Fear Index' },
  { id: 'usdinr', symbol: 'INR=X', alternateSymbols: ['USDINR=X'], name: 'USD / INR', category: 'CURRENCY' as const, description: 'US Dollar to Indian Rupee' }
];

async function fetchSingleFallbackQuote(cfg: typeof FALLBACK_CONFIG[0]): Promise<MarketIndexItem | null> {
  const yf = getYF();
  const candidates = [cfg.symbol, ...(cfg.alternateSymbols || [])];

  for (const sym of candidates) {
    try {
      const q = await Promise.race([
        yf.quote(sym),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]);

      if (q && q.regularMarketPrice !== undefined && q.regularMarketPrice !== null) {
        const price = Number(q.regularMarketPrice);
        const change = q.regularMarketChange !== undefined ? Number(q.regularMarketChange) : 0;
        const changePercent = q.regularMarketChangePercent !== undefined ? Number(q.regularMarketChangePercent) : 0;

        return {
          id: cfg.id,
          symbol: cfg.symbol,
          name: cfg.name,
          category: cfg.category,
          price,
          change,
          changePercent,
          dayHigh: q.regularMarketDayHigh || q.dayHigh || price,
          dayLow: q.regularMarketDayLow || q.dayLow || price,
          previousClose: q.regularMarketPreviousClose || q.previousClose || (price - change),
          currency: cfg.category === 'VOLATILITY' ? 'POINTS' : (q.currency || 'INR'),
          lastUpdated: new Date().toISOString(),
          description: cfg.description,
          source: 'PARALLEL_BACKUP'
        };
      }
    } catch {
      // continue
    }
  }

  return null;
}

// -------------------------------------------------------------
// 4. Central Fetch Orchestrator with Shared Mutex & Rate-Limit
// -------------------------------------------------------------
async function executeInternalFetch(): Promise<MarketOverviewData> {
  const now = Date.now();
  const { isMarketOpen, session, statusText, sessionBadge } = getMarketSessionStatus();

  // Execute Direct BSE & Direct NSE in parallel
  const [bseSensex, nseIndices] = await Promise.all([
    fetchDirectBseSensex(),
    fetchDirectNseIndices()
  ]);

  // Update rolling state from Direct Official feeds
  if (bseSensex) {
    const idx = ROLLING_INDICES_STATE.findIndex(r => r.id === 'sensex');
    if (idx !== -1) ROLLING_INDICES_STATE[idx] = bseSensex;
  }

  if (nseIndices.nifty50) {
    const idx = ROLLING_INDICES_STATE.findIndex(r => r.id === 'nifty50');
    if (idx !== -1) ROLLING_INDICES_STATE[idx] = nseIndices.nifty50;
  }

  if (nseIndices.banknifty) {
    const idx = ROLLING_INDICES_STATE.findIndex(r => r.id === 'banknifty');
    if (idx !== -1) ROLLING_INDICES_STATE[idx] = nseIndices.banknifty;
  }

  if (nseIndices.niftymidcap) {
    const idx = ROLLING_INDICES_STATE.findIndex(r => r.id === 'niftymidcap');
    if (idx !== -1) ROLLING_INDICES_STATE[idx] = nseIndices.niftymidcap;
  }

  if (nseIndices.indiavix) {
    const idx = ROLLING_INDICES_STATE.findIndex(r => r.id === 'indiavix');
    if (idx !== -1) ROLLING_INDICES_STATE[idx] = nseIndices.indiavix;
  }

  // Check if any symbols still need refresh (e.g. USDINR or missing values)
  const missingConfigs = FALLBACK_CONFIG.filter(cfg => {
    if (cfg.id === 'sensex' && bseSensex) return false;
    if (nseIndices[cfg.id]) return false;
    return true;
  });

  if (missingConfigs.length > 0) {
    const fallbackResults = await Promise.allSettled(
      missingConfigs.map(cfg => fetchSingleFallbackQuote(cfg))
    );

    fallbackResults.forEach((res, i) => {
      const cfg = missingConfigs[i];
      if (res.status === 'fulfilled' && res.value) {
        const idx = ROLLING_INDICES_STATE.findIndex(r => r.id === cfg.id);
        if (idx !== -1) ROLLING_INDICES_STATE[idx] = res.value;
      }
    });
  }

  cachedMarketData = {
    indices: [...ROLLING_INDICES_STATE],
    isMarketOpen,
    marketSession: session,
    lastRefreshed: now,
    marketStatusText: statusText,
    sessionBadge
  };
  lastFetchTime = now;

  return cachedMarketData;
}

export async function fetchLiveMarketIndices(): Promise<MarketOverviewData> {
  const now = Date.now();
  const { isMarketOpen } = getMarketSessionStatus();
  const currentTtl = isMarketOpen ? LIVE_MARKET_TTL_MS : CLOSED_MARKET_TTL_MS;

  // 1. Return fresh cached data if within TTL
  if (cachedMarketData && (now - lastFetchTime) < currentTtl) {
    return cachedMarketData;
  }

  // 2. Reuse in-flight promise to prevent concurrent duplicate network requests
  if (inFlightFetchPromise) {
    return inFlightFetchPromise;
  }

  // 3. Initiate fetch with mutex lock
  inFlightFetchPromise = executeInternalFetch()
    .finally(() => {
      inFlightFetchPromise = null;
    });

  return inFlightFetchPromise;
}
