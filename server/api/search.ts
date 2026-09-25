import fs from 'fs';
import path from 'path';
import { getAllStockEntries, getScripCode } from '../utils/stockResolver.js';

let nifty500: any[] = [];
try {
  const primaryPath = path.resolve(process.cwd(), 'server/data/nifty500.json');
  const secondaryPath = path.resolve(process.cwd(), 'data/nifty500.json');

  if (fs.existsSync(primaryPath)) {
    nifty500 = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
  } else if (fs.existsSync(secondaryPath)) {
    nifty500 = JSON.parse(fs.readFileSync(secondaryPath, 'utf8'));
  }
} catch (e) {
  // Graceful fallback without breaking server startup
}

if (!nifty500 || nifty500.length === 0) {
  // Fallback to stock resolver entries if file is ever missing
  nifty500 = getAllStockEntries().map(s => ({
    symbol: s.symbol,
    name: s.name,
    scripCode: s.scripCode,
    industry: s.sector || 'Equities',
    nameKeywords: s.nameKeywords || []
  }));
}

// Conglomerate & Sector Grouping Synonyms for Smart Semantic Search
const GROUP_SYNONYMS: Record<string, string[]> = {
  tata: ['TCS', 'TATAMOTORS', 'TATASTEEL', 'TATAPOWER', 'TATACONSUM', 'TATACHEM', 'TATACOMM', 'TATAELXSI', 'TATATECH', 'TATAINVEST', 'TITAN', 'TRENT', 'VOLTAS', 'INDHOTEL', 'RALLIS', 'TTML', 'NELCO', 'BANCOINDIA'],
  adani: ['ADANIENT', 'ADANIPORTS', 'ADANIPOWER', 'ADANIGREEN', 'ATGL', 'AWL', 'ADANIENSOL', 'ACC', 'AMBUJACEM', 'NDTV', 'SANGHIIND'],
  reliance: ['RELIANCE', 'JIOFIN', 'JUSTDIAL', 'DEN', 'HATHWAY', 'RIIL'],
  birla: ['GRASIM', 'HINDALCO', 'ULTRACEMCO', 'ABCAPITAL', 'ABFRL', 'CENTURYTEX', 'CENTURYPLY', 'IDEA'],
  bajaj: ['BAJFINANCE', 'BAJAJFINSV', 'BAJAJ-AUTO', 'BAJAJAUTO', 'BAJAJHLDNG', 'BAJAJELEC', 'BAJAJHCARE', 'MAHSEAMLES'],
  mahindra: ['M&M', 'TECHM', 'MMFIN', 'MAHLOG', 'MAHINDCIE', 'MAHLIFE', 'SWARAJENG'],
  godrej: ['GODREJCP', 'GODREJPROP', 'GODREJIND', 'GODREJAGRO', 'ASTEC'],
  railway: ['IRFC', 'RVNL', 'IRCTC', 'RITES', 'RAILTEL', 'TITAGARH', 'TEXRAIL'],
  defence: ['HAL', 'BEL', 'BDL', 'MAZDOCK', 'COCHINSHIP', 'SOLARINDS', 'ZENTEC', 'PARAS', 'DATAPATTNS', 'MTARTECH'],
  psu: ['SBIN', 'PNB', 'BANKBARODA', 'CANBK', 'UNIONBANK', 'INDIANB', 'MAHABANK', 'IOB', 'UCOBANK', 'CENTRALBK', 'PSB', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA', 'IOC', 'BPCL', 'HPCL', 'GAIL', 'NMDC', 'SAIL', 'PFC', 'RECLTD', 'IRFC', 'RVNL', 'IREDA', 'NHPC', 'SJVN', 'HAL', 'BEL', 'BHEL'],
  bank: ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'BANKBARODA', 'PNB', 'CANBK', 'UNIONBANK', 'INDIANB', 'FEDERALBNK', 'IDFCFIRSTB', 'BANDHANBNK', 'AUBANK', 'RBLBANK', 'YESBANK'],
  power: ['TATAPOWER', 'NTPC', 'POWERGRID', 'ADANIPOWER', 'ADANIGREEN', 'TORNTPOWER', 'JSWENERGY', 'NHPC', 'SJVN', 'IREDA', 'CESC', 'SUZLON', 'GIPCL'],
  ev: ['TATAMOTORS', 'OLECTRA', 'JBMMA', 'EXIDEIND', 'AMARAJABAT', 'SONACOMS', 'KPITTECH', 'TVSMOTOR', 'BAJAJ-AUTO', 'HEROMOTOCO'],
  solar: ['SOLARINDS', 'TATA POWER', 'ADANIGREEN', 'IREDA', 'SUZLON', 'BORORENEW', 'WAAREE', 'PREMIERENE']
};

export async function searchCompany(q: string) {
  if (!q || q.trim().length < 1) return [];
  
  const rawQuery = q.toLowerCase().trim();
  const query = rawQuery.replace(/[^a-z0-9]/g, '');
  const candidateScores = new Map<string, { item: { name: string; symbol: string; scripCode: string; sector?: string }; score: number }>();

  // Helper to add or upgrade a candidate
  const addCandidate = (sym: string, name: string, scrip: string, sector: string | undefined, score: number) => {
    const symbol = sym.toUpperCase().trim();
    const existing = candidateScores.get(symbol);
    if (!existing || existing.score < score) {
      candidateScores.set(symbol, {
        item: {
          name,
          symbol,
          scripCode: scrip || getScripCode(symbol) || (/^\d{6}$/.test(symbol) ? symbol : ''),
          sector
        },
        score
      });
    }
  };

  // Group Synonym Boost (e.g. typing 'tata', 'adani', 'defence', 'railway')
  const matchedGroup = Object.keys(GROUP_SYNONYMS).find(g => rawQuery === g || rawQuery.startsWith(g) || g.startsWith(rawQuery));
  const groupSymbols = matchedGroup ? new Set(GROUP_SYNONYMS[matchedGroup]) : new Set<string>();

  // 1. Search in Stock Resolver master database
  const masterStocks = getAllStockEntries();
  for (const s of masterStocks) {
    const sym = s.symbol.toUpperCase();
    const cleanSym = sym.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanName = (s.name || '').toLowerCase();
    const cleanNameNoSpace = cleanName.replace(/[^a-z0-9]/g, '');
    const scrip = s.scripCode || '';
    const keywords = (s.nameKeywords || []).map(k => k.toLowerCase());

    let score = 0;

    // Exact matches
    if (cleanSym === query) {
      score = 200;
    } else if (cleanSym.startsWith(query)) {
      score = 150 - (cleanSym.length - query.length);
    } else if (cleanSym.includes(query)) {
      score = 110;
    }

    // Name match scoring
    if (cleanName.startsWith(rawQuery)) {
      score = Math.max(score, 140);
    } else {
      const words = cleanName.split(/\s+/);
      if (words.some(w => w === rawQuery)) {
        score = Math.max(score, 130);
      } else if (words.some(w => w.startsWith(rawQuery))) {
        score = Math.max(score, 120);
      } else if (cleanName.includes(rawQuery) || cleanNameNoSpace.includes(query)) {
        score = Math.max(score, 90);
      }
    }

    // Keyword match
    if (keywords.some(k => k.includes(rawQuery))) {
      score = Math.max(score, 100);
    }

    // Scrip Code match
    if (scrip === rawQuery || scrip === query) {
      score = Math.max(score, 190);
    } else if (scrip.startsWith(query)) {
      score = Math.max(score, 125);
    }

    // Group Synonym bonus
    if (groupSymbols.has(sym)) {
      score = Math.max(score, 135);
    }

    if (score > 0) {
      addCandidate(sym, s.name, scrip, s.sector, score);
    }
  }

  // 2. Search in nifty500 local file
  for (const item of nifty500) {
    const sym = (item.symbol || '').toUpperCase();
    const cleanSym = sym.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanName = (item.name || '').toLowerCase();
    const cleanNameNoSpace = cleanName.replace(/[^a-z0-9]/g, '');
    const scrip = item.scripCode || getScripCode(sym) || '';

    let score = 0;
    if (cleanSym === query) {
      score = 200;
    } else if (cleanSym.startsWith(query)) {
      score = 150 - (cleanSym.length - query.length);
    } else if (cleanSym.includes(query)) {
      score = 105;
    }

    if (cleanName.startsWith(rawQuery)) {
      score = Math.max(score, 135);
    } else {
      const words = cleanName.split(/\s+/);
      if (words.some(w => w === rawQuery)) {
        score = Math.max(score, 125);
      } else if (words.some(w => w.startsWith(rawQuery))) {
        score = Math.max(score, 115);
      } else if (cleanName.includes(rawQuery) || cleanNameNoSpace.includes(query)) {
        score = Math.max(score, 85);
      }
    }

    if (groupSymbols.has(sym)) {
      score = Math.max(score, 130);
    }

    if (score > 0) {
      addCandidate(sym, item.name, scrip, item.industry || item.sector, score);
    }
  }

  // 3. Fallback online search via Screener if fewer than 5 results and query >= 2 chars
  if (candidateScores.size < 5 && rawQuery.length >= 2) {
    try {
      const response = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(rawQuery)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const parts = (item.url || '').split('/').filter(Boolean);
            const symbol = (parts[1] || '').toUpperCase().trim();
            if (symbol && /^[A-Z0-9-]{2,15}$/.test(symbol)) {
              const scrip = getScripCode(symbol) || (/^\d{6}$/.test(symbol) ? symbol : '');
              addCandidate(symbol, item.name, scrip, 'Equities', 70 - i);
            }
          }
        }
      }
    } catch (error) {
      // Quiet fallback
    }
  }

  // Sort candidate list by score descending
  const sorted = Array.from(candidateScores.values())
    .sort((a, b) => b.score - a.score)
    .map(c => c.item);

  return sorted.slice(0, 25);
}

