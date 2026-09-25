/**
 * Utility to clean repetitive BSE announcement subject noise.
 * Strips duplicate company name, scrip code, boilerplate "Announcement under Regulation 30 (LODR)-" prefixes,
 * and extracts standard regulatory tag badges for ultra-clean terminal-style reading.
 */

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CleanSubjectResult {
  headline: string;
  humanTitle: string;
  regulation?: string;
  original: string;
}

export function detectHumanTitle(text: string, category?: string): string {
  const t = text.toLowerCase();
  
  if (t.includes('press release') || t.includes('media release')) return 'Press release';
  if (t.includes('financial result') || t.includes('financials') || t.includes('quarterly result') || category === 'RESULTS') return 'Financial results';
  if (t.includes('investor presentation') || t.includes('analyst presentation') || t.includes('investor deck')) return 'Investor presentation';
  if (t.includes('concall') || t.includes('conference call') || t.includes('audio recording') || t.includes('transcript') || category === 'CONFERENCE_CALL') return 'Earnings call';
  if (t.includes('outcome of board') || t.includes('board meeting outcome') || t.includes('board announcement') || t.includes('board meeting')) return 'Board announcement';
  if (t.includes('credit rating')) return 'Credit rating update';
  if (t.includes('order') || t.includes('contract') || t.includes('bagged') || t.includes('awarded')) return 'Commercial order';
  if (t.includes('resignation') || t.includes('appointment') || t.includes('kmp') || t.includes('director')) return 'Leadership update';
  if (t.includes('dividend') || t.includes('bonus') || t.includes('split') || t.includes('rights issue') || t.includes('buyback')) return 'Corporate action';
  if (t.includes('acquisition') || t.includes('takeover') || t.includes('amalgamation') || t.includes('merger') || t.includes('joint venture')) return 'Strategic acquisition';
  if (t.includes('agm') || t.includes('egm') || t.includes('postal ballot') || t.includes('general meeting')) return 'Shareholder meeting';
  if (t.includes('trading window')) return 'Trading window notice';
  if (t.includes('loss of share') || t.includes('duplicate share')) return 'Share certificate update';
  if (t.includes('clarification') || t.includes('news confirmation')) return 'Exchange clarification';

  return 'Corporate announcement';
}

export function cleanBseSubject(
  rawSubject: string | undefined | null,
  companyName?: string,
  scripCode?: string | number
): CleanSubjectResult {
  if (!rawSubject) {
    return { headline: 'Corporate Announcement', humanTitle: 'Corporate announcement', original: '' };
  }

  let text = String(rawSubject).trim();
  const original = text;

  // Sanitize common corrupted HTML entities and quotes in BSE strings
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/''+/g, "'")
    .replace(/([a-zA-Z])"([a-zA-Z])/g, "$1'$2") // Fixes e.g. "Scrutinizer"s" -> "Scrutinizer's"
    .replace(/""+/g, '"')
    .trim();

  // 1. Remove Company Name prefix if explicitly repeated at start
  // e.g. "Godrej Properties Ltd - 533150 - Announcement under..."
  if (companyName) {
    const cleanComp = companyName.replace(/\s+L(?:imi)?t(?:e)?d\.?$/i, '').trim();
    if (cleanComp.length > 2) {
      const compRegex = new RegExp(`^${escapeRegex(cleanComp)}(?:\\s+Limited|\\s+Ltd\\.?)?\\s*[-–—:]?\\s*`, 'i');
      text = text.replace(compRegex, '');
    }
  }

  // Also remove generic [Company Name - Scrip -] pattern if at start
  text = text.replace(/^[A-Za-z0-9\s&.,'()]{3,45}\s*[-–—]\s*\d{6}\s*[-–—:]\s*/, '');

  // 2. Remove Scrip code prefix if present: e.g. "533150 - "
  if (scripCode) {
    const scripRegex = new RegExp(`^${scripCode}\\s*[-–—:]?\\s*`, 'i');
    text = text.replace(scripRegex, '');
  }
  text = text.replace(/^\d{6}\s*[-–—:]\s*/, '');

  // 3. Extract Regulation info cleanly
  let regulation: string | undefined = undefined;
  if (/Regulation\s*30/i.test(text) || /Reg\.?\s*30/i.test(text)) {
    regulation = 'Reg 30 (LODR)';
  } else if (/Regulation\s*(\d+)/i.test(text)) {
    const match = text.match(/Regulation\s*(\d+)(?:\s*\(([^)]+)\))?/i);
    if (match) {
      regulation = `Reg ${match[1]}${match[2] ? ` (${match[2]})` : ''}`;
    }
  } else if (/Outcome\s+of\s+Board\s+Meeting/i.test(text)) {
    regulation = 'Board Outcome';
  } else if (/Financial\s+Results/i.test(text)) {
    regulation = 'Financials';
  }

  // 4. Strip boilerplate repetitive prefixes
  text = text.replace(/^(?:Announcement\s+under\s+)?Regulation\s+\d+\s*(?:\([A-Za-z0-9]+\))?\s*[-–—:]\s*/i, '');
  text = text.replace(/^(?:Announcement\s+under\s+)?Regulation\s+\d+\s+of\s+SEBI\s*\([^)]+\)\s*Regulations?,?\s*\d{4}\s*[-–—:]\s*/i, '');
  text = text.replace(/^SEBI\s*\([^)]+\)\s*Regulations?,?\s*\d{4}\s*[-–—:]\s*/i, '');
  text = text.replace(/^Corporate\s+Announcement\s*[-–—:]\s*/i, '');
  text = text.replace(/^Outcome\s+of\s+Board\s+Meeting\s*[-–—:]\s*/i, '');

  // Clean leading and trailing punctuation / whitespace
  text = text.replace(/^[-–—:\s]+/, '').replace(/[-–—:\s]+$/, '').trim();

  // If text became empty, fallback gracefully
  if (!text) {
    text = original.replace(/^[A-Za-z0-9\s&.,'()]{3,45}\s*[-–—]\s*/, '').trim() || original;
  }

  const humanTitle = detectHumanTitle(original);

  return {
    headline: text,
    humanTitle,
    regulation,
    original
  };
}
