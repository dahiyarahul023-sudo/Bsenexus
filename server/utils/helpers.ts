export function escapeHTML(str: string): string {
  if (!str) return "";
  // Replace <br>, <br/>, <br > etc. with newline
  str = str.replace(/<br\s*\/?>/gi, '\n');
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

import { getAllStockEntries, getScripCode, resolveStockDetails } from './stockResolver.js';
export { resolveStockDetails, getScripCode, getAllStockEntries };

export const stockMasterDatabase: Record<string, { scripCode: string; nameKeywords: string[] }> = {};

// Initialize stockMasterDatabase from stockResolver
for (const entry of getAllStockEntries()) {
  stockMasterDatabase[entry.symbol] = {
    scripCode: entry.scripCode,
    nameKeywords: entry.nameKeywords
  };
}

// Build export maps dynamically for full compatibility
export const nseToBseMap: Record<string, string> = {};
export const symbolToScripCodeMap: Record<string, string> = {};

for (const [sym, entry] of Object.entries(stockMasterDatabase)) {
  symbolToScripCodeMap[sym] = entry.scripCode;
  if (entry.nameKeywords && entry.nameKeywords.length > 0) {
    nseToBseMap[sym] = entry.nameKeywords[0];
  }
}

export function getScripCodeForSymbolOrName(input: string): string | undefined {
  if (!input) return undefined;
  const clean = input.trim().toUpperCase();
  if (!clean) return undefined;

  if (/^\d{6}$/.test(clean)) {
    return clean;
  }

  const resolved = getScripCode(clean);
  if (resolved) return resolved;

  if (stockMasterDatabase[clean]) {
    return stockMasterDatabase[clean].scripCode;
  }

  const noSpace = clean.replace(/[\s-]/g, '');
  if (stockMasterDatabase[noSpace]) {
    return stockMasterDatabase[noSpace].scripCode;
  }

  for (const [sym, entry] of Object.entries(stockMasterDatabase)) {
    if (sym === clean || sym.replace(/[\s-]/g, '') === noSpace) {
      return entry.scripCode;
    }
    if (entry.nameKeywords) {
      for (const kw of entry.nameKeywords) {
        const kwClean = kw.trim().toUpperCase();
        if (kwClean === clean || kwClean.replace(/[\s-]/g, '') === noSpace) {
          return entry.scripCode;
        }
      }
    }
  }

  return undefined;
}

export const CONGLOMERATE_GROUP_KEYWORDS = new Set([
  'RELIANCE', 'TATA', 'ADANI', 'BAJAJ', 'BIRLA', 'MAHINDRA', 'GODREJ', 'L&T', 'LT', 'HIND', 
  'INDIA', 'BHARAT', 'NATIONAL', 'SHREE', 'JINDAL', 'TORRENT', 'VEDANTA', 'KALYAN', 
  'HERO', 'MUTHOOT', 'APOLLO', 'SUNDARAM', 'CHOLA'
]);

export function isSymbolMatch(companyName: string, subject: string, symbol: string, scripCd?: string): boolean {
  if (!symbol) return false;
  const sym = symbol.trim().toUpperCase();
  if (!sym) return false;

  const comp = String(companyName || '').toUpperCase().trim();
  const subj = String(subject || '').toUpperCase().trim();
  const announcementScrip = String(scripCd || '').trim();

  const targetScripCode = getScripCodeForSymbolOrName(sym);

  // 1. Scrip Code exact match & definitive disambiguation (Highest Priority - 100% Deterministic)
  if (announcementScrip && targetScripCode) {
    if (announcementScrip === targetScripCode) {
      return true;
    }
    // If BOTH have valid 6-digit BSE scrip codes and they differ, they are guaranteed distinct companies
    if (/^\d{6}$/.test(announcementScrip) && /^\d{6}$/.test(targetScripCode)) {
      return false;
    }
  }

  // If target symbol itself is a 6-digit scrip code
  if (/^\d{6}$/.test(sym) && announcementScrip) {
    return announcementScrip === sym;
  }

  // 2. Conglomerate / Ambiguous Group Name Protection
  // Words like 'RELIANCE', 'TATA', 'ADANI' represent whole conglomerates with dozens of listed entities.
  // We NEVER allow loose single-word substring match on other entities (e.g. Reliance Comm / Reliance Chemotex for RELIANCE).
  const isConglomerate = CONGLOMERATE_GROUP_KEYWORDS.has(sym) || CONGLOMERATE_GROUP_KEYWORDS.has(sym.replace(/[\s-]/g, ''));
  const master = stockMasterDatabase[sym] || stockMasterDatabase[sym.replace(/[\s-]/g, '')];

  if (isConglomerate) {
    // For conglomerate symbols, if an announcement has a scrip code but target has a verified scrip code and they don't match, reject
    if (announcementScrip && /^\d{6}$/.test(announcementScrip) && targetScripCode && /^\d{6}$/.test(targetScripCode)) {
      return announcementScrip === targetScripCode;
    }

    // Must match full specific name keywords (e.g. "RELIANCE INDUSTRIES", "TATA MOTORS", "ADANI PORTS")
    if (master && master.nameKeywords && master.nameKeywords.length > 0) {
      for (const kw of master.nameKeywords) {
        const kwUpper = kw.trim().toUpperCase();
        // Disallow single generic word in alias check for conglomerate
        if (kwUpper === sym) continue;
        const kwRegex = new RegExp(`(?:^|\\s|\\b)${kwUpper.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|\\b|$)`, 'i');
        if (kwRegex.test(comp) || kwRegex.test(subj)) {
          return true;
        }
      }
    }

    // Exact full name match only
    return false;
  }

  // 3. Keyword/Name match with STRICT word boundary for unique single-company tickers (e.g. INFY, TCS, PNB, SBIN)
  const searchTerms: string[] = [sym];
  if (master && master.nameKeywords) {
    for (const kw of master.nameKeywords) {
      searchTerms.push(kw.toUpperCase());
    }
  }

  const cleanComp = comp.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanSubj = subj.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const term of searchTerms) {
    const cleanTerm = term.trim().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanTerm) continue;

    // Exact string match or full term boundary match
    if (cleanComp === cleanTerm || cleanSubj === cleanTerm) {
      return true;
    }

    // Strict word boundary check (prevent matching "KAU" in "Kaushalya" or "ANU" in "Anuroop")
    const escaped = cleanTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const wordBoundaryRegex = new RegExp(`(?:^|\\s|\\b)${escaped}(?:\\s|\\b|$)`, 'i');

    if (wordBoundaryRegex.test(cleanComp)) {
      return true;
    }

    // For longer official phrases (>= 5 chars), check if company starts with the term
    if (cleanTerm.length >= 5 && (cleanComp.startsWith(cleanTerm + ' ') || cleanComp.includes(' ' + cleanTerm + ' '))) {
      return true;
    }

    // Check subject with strict word boundaries if symbol/term is distinct (>= 4 chars)
    if (cleanTerm.length >= 4 && wordBoundaryRegex.test(cleanSubj)) {
      return true;
    }
  }

  return false;
}

export function parseBseDate(dateStr?: string): number {
  if (!dateStr) return 0;
  const str = String(dateStr).trim();
  if (!str) return 0;

  // 1. /Date(123456789)/
  const msMatch = str.match(/\/Date\((\d+)\)\//);
  if (msMatch) {
    const ts = parseInt(msMatch[1], 10);
    return isNaN(ts) ? 0 : ts;
  }

  // 2. Standard ISO with Z or explicit timezone offset (+05:30, -04:00, etc.)
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    const ts = Date.parse(str.replace(' ', 'T'));
    if (!isNaN(ts)) return ts;
  }

  // 3. YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss without offset (native BSE IST +05:30)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (isoMatch) {
    const [, y, m, d, hh, mm, ss, ms] = isoMatch;
    const isoString = `${y}-${m}-${d}T${hh}:${mm}:${ss}${ms ? '.' + ms.padEnd(3, '0').slice(0, 3) : ''}+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return ts;
  }

  // 4. Date only: YYYY-MM-DD
  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const isoString = `${y}-${m}-${d}T00:00:00+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return ts;
  }

  // 5. DD/MM/YYYY HH:mm:ss or DD-MM-YYYY HH:mm:ss or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
  if (dmyMatch) {
    const [, d, m, y, hhStr, mmStr = '00', ssStr = '00', ampm] = dmyMatch;
    let hh = hhStr !== undefined ? parseInt(hhStr, 10) : 0;
    const mm = parseInt(mmStr, 10);
    const ss = parseInt(ssStr, 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hh < 12) hh += 12;
      if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
    }
    const pad = (n: number | string) => String(n).padStart(2, '0');
    const isoString = `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return ts;
  }

  // 6. Month names: "13 Aug 2026 08:12:48 PM" or "13-Aug-2026 20:12:48" or "13 Aug 2026"
  const textMonthMatch = str.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,9})[\s\-]+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (textMonthMatch) {
    const [, d, monthName, y, hhStr, mmStr = '00', ssStr = '00', ampm] = textMonthMatch;
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const mIdx = monthNames.indexOf(monthName.toLowerCase().slice(0, 3));
    if (mIdx >= 0) {
      let hh = hhStr !== undefined ? parseInt(hhStr, 10) : 0;
      const mm = parseInt(mmStr, 10);
      const ss = parseInt(ssStr, 10);
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hh < 12) hh += 12;
        if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
      }
      const pad = (n: number | string) => String(n).padStart(2, '0');
      const isoString = `${y}-${pad(mIdx + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}+05:30`;
      const ts = Date.parse(isoString);
      if (!isNaN(ts)) return ts;
    }
  }

  // 7. Numeric timestamp string
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    return str.length === 10 ? num * 1000 : num;
  }

  // Fallback
  const fallback = Date.parse(str);
  return !isNaN(fallback) ? fallback : 0;
}

export function determinePriority(subject: string, details: string): { level: string, icon: string, category: string } {
  const text = (subject + " " + details).toUpperCase();
  
  // 1. Investor Calls, Analyst Meets, Transcripts, Investor Presentations (Regulation 30)
  const callKeywords = [
    'ANALYST / INVESTOR MEET', 'ANALYST MEET', 'INVESTOR MEET',
    'ANALYST/INVESTOR MEET', 'INVESTOR PRESENTATION', 'ANALYST PRESENTATION',
    'CONFERENCE CALL', 'EARNINGS CALL', 'ANALYST CALL', 'INVESTOR CALL', 
    'RESULTS CONFERENCE CALL', 'EARNINGS CONFERENCE CALL',
    'CALL TRANSCRIPT', 'AUDIO RECORDING OF', 'AUDIO RECORDING', 'TRANSCRIPT OF'
  ];
  for (const kw of callKeywords) {
    if (text.includes(kw)) {
      return { level: 'HIGH', icon: '🔴', category: 'CONFERENCE_CALL' };
    }
  }

  // 2. Pre-Meeting Intimations, Notices, Window Closures
  const isPreMeetingNotice = 
    text.includes('INTIMATION') ||
    text.includes('NOTICE OF BOARD') ||
    text.includes('BOARD MEETING INTIMATION') ||
    text.includes('PRIOR INTIMATION') ||
    text.includes('UPDATE ON BOARD MEETING') ||
    text.includes('RESCHEDULED') ||
    text.includes('POSTPONEMENT') ||
    text.includes('TRADING WINDOW') ||
    text.includes('CLOSURE OF TRADING') ||
    text.includes('NEWSPAPER PUBLICATION') ||
    text.includes('VOTING RESULTS') ||
    text.includes('SCRUTINIZER') ||
    text.includes('REGULATION 29') ||
    text.includes('REG 29');

  const isExplicitResultsOutcome = 
    text.includes('REGULATION 33') ||
    text.includes('REG 33') ||
    text.includes('FINANCIAL RESULTS') ||
    text.includes('FINANCIAL RESULT') ||
    text.includes('UNAUDITED FINANCIAL') ||
    text.includes('AUDITED FINANCIAL') ||
    text.includes('UN-AUDITED FINANCIAL') ||
    text.includes('STATEMENT OF FINANCIAL') ||
    text.includes('STATEMENT OF STANDALONE') ||
    text.includes('STATEMENT OF CONSOLIDATED') ||
    text.includes('CONSIDERED AND APPROVED THE FINANCIAL') ||
    text.includes('APPROVED THE FINANCIAL RESULTS') ||
    text.includes('APPROVAL OF FINANCIAL RESULTS');

  // 3. Genuine Financial Results & Board Meeting Outcome for Results Detection (Regulation 33)
  if (isExplicitResultsOutcome && !text.includes('INTIMATION OF BOARD') && !text.includes('PRIOR INTIMATION') && !text.includes('TO CONSIDER AND APPROVE')) {
    return { level: 'HIGH', icon: '🔴', category: 'RESULTS' };
  }

  const resultKeywords = [
    'FINANCIAL RESULTS', 'FINANCIAL RESULT',
    'QUARTERLY RESULTS', 'QUARTERLY RESULT',
    'AUDITED FINANCIAL RESULTS', 'AUDITED FINANCIAL RESULT',
    'UNAUDITED FINANCIAL RESULTS', 'UNAUDITED FINANCIAL RESULT',
    'AUDITED RESULTS', 'UNAUDITED RESULTS',
    'Q1 RESULTS', 'Q2 RESULTS', 'Q3 RESULTS', 'Q4 RESULTS',
    'Q1 RESULT', 'Q2 RESULT', 'Q3 RESULT', 'Q4 RESULT',
    'ANNUAL RESULTS', 'HALF YEARLY RESULTS',
    'FINANCIAL STATEMENTS', 'FINANCIAL STATEMENT',
    'BOARD MEETING OUTCOME FOR FINANCIAL RESULTS',
    'OUTCOME OF BOARD MEETING HELD ON'
  ];

  if (!isPreMeetingNotice) {
    for (const kw of resultKeywords) {
      if (text.includes(kw)) {
        return { level: 'HIGH', icon: '🔴', category: 'RESULTS' };
      }
    }

    if (text.includes('OUTCOME OF BOARD') || text.includes('BOARD MEETING OUTCOME') || text.includes('OUTCOME OF THE BOARD')) {
      // Check if it is a financial results outcome vs a generic governance/allotment outcome
      if (text.includes('RESULT') || text.includes('FINANCIAL') || text.includes('UNAUDITED') || text.includes('AUDITED') || text.includes('QUARTER ENDED') || text.includes('YEAR ENDED') || text.includes('DIVIDEND')) {
        return { level: 'HIGH', icon: '🔴', category: 'RESULTS' };
      }
      return { level: 'MEDIUM', icon: '🟡', category: 'BOARD_MEETING' };
    }
  } else {
    // Shareholder meetings (AGM/EGM) are NOT board meetings — tag as governance
    if (text.includes('SHAREHOLDER') || text.includes('GENERAL MEETING') || text.includes('ANNUAL GENERAL') || text.includes('EXTRAORDINARY GENERAL') || /\bAGM\b/.test(text) || /\bEGM\b/.test(text)) {
      return { level: 'MEDIUM', icon: '🟡', category: 'GOVERNANCE' };
    }
    // If it's a Board Meeting Intimation / Notice
    if (text.includes('BOARD') || text.includes('MEETING')) {
      return { level: 'MEDIUM', icon: '🟡', category: 'BOARD_MEETING' };
    }
  }

  // 3. Other Major Material Events (Resignation of Directors/KMP, Merger, Acquisition, Default, Fraud, Buyback)
  const criticalKeywords = [
    'RESIGNATION OF', 'RESIGNATION', 'ACQUISITION', 'MERGER', 'DEFAULT', 'FRAUD', 'BUYBACK', 
    'ORDER WIN', 'INVOLUNTARY DELISTING'
  ];
  const isRoutineNotice = text.includes('LOSS OF SHARE') || text.includes('TRADING WINDOW') || text.includes('SHARE CERTIFICATE');
  const isNewspaperOrVoting = text.includes('NEWSPAPER PUBLICATION') || text.includes('VOTING RESULTS') || text.includes('SCRUTINIZER');
  
  if (!isRoutineNotice && !isNewspaperOrVoting) {
    for (const kw of criticalKeywords) {
      if (text.includes(kw)) {
        return { level: 'MEDIUM', icon: '🟡', category: 'MATERIAL_EVENT' };
      }
    }
  }

  // 4. Routine & Medium Priority (Dividend, AGM/EGM, Voting Results, Newspaper, Regulation 30, ESOPs)
  const mediumKeywords = [
    'BOARD MEETING', 'INVESTOR PRESENTATION', 'NEWSPAPER PUBLICATION', 
    'AGM', 'EGM', 'ANNUAL GENERAL MEETING', 'VOTING RESULTS', 'DIVIDEND', 
    'RECORD DATE', 'CREDIT RATING'
  ];
  for (const kw of mediumKeywords) {
    if (text.includes(kw)) return { level: 'MEDIUM', icon: '🟡', category: 'OTHER' };
  }

  return { level: 'LOW', icon: '🟢', category: 'OTHER' };
}

export function getISTMarketStatus(): {
  isMarketHours: boolean;
  intervalMs: number;
  statusLabel: string;
  cycleLabel: string;
  dayOfWeek: number;
  hours: number;
  minutes: number;
} {
  const now = new Date();
  // IST is UTC + 5:30 fixed (no Daylight Savings Time)
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);

  const dayOfWeek = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Monday (1) to Friday (5), between 09:15 (555m) and 15:30 (930m) IST
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMarketHours = isWeekday && totalMinutes >= 555 && totalMinutes <= 930;

  if (isMarketHours) {
    return {
      isMarketHours: true,
      intervalMs: 30 * 1000, // 30 seconds during active market trading hours
      statusLabel: 'Live (30s)',
      cycleLabel: '30s polling cycle',
      dayOfWeek,
      hours,
      minutes
    };
  }

  return {
    isMarketHours: false,
    intervalMs: 5 * 60 * 1000, // 5 minutes off-hours / nights / weekends
    statusLabel: 'Relaxed (5m)',
    cycleLabel: '5m polling cycle',
    dayOfWeek,
    hours,
    minutes
  };
}

export function isMarketHoursIST(): boolean {
  return getISTMarketStatus().isMarketHours;
}

export function getPollingIntervalMs(consecutiveFailures: number = 0): number {
  const { isMarketHours, intervalMs } = getISTMarketStatus();

  // If there are failures, apply modest backoff
  if (consecutiveFailures >= 5) {
    return isMarketHours ? 60000 : 300000; // 60s during market hours, 5m off-hours
  }
  if (consecutiveFailures >= 3) {
    return isMarketHours ? 45000 : 300000;
  }

  // Base interval: 30s during market hours, 5m off-hours (with +/- 1s natural jitter to avoid bot pattern)
  const jitter = Math.floor(Math.random() * 2000) - 1000;
  return Math.max(20000, intervalMs + jitter);
}
