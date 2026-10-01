import { GoogleGenAI } from "@google/genai";
import { sendReplyToTelegram } from "./telegram.js";
import { addLog } from "../database/logDao.js";
import { updateAnnouncementSummary, getAnnouncementById, getRecentAnnouncements } from "../database/announcementDao.js";
import { geminiCircuitBreaker } from "../utils/circuitBreaker.js";
import { getAllWatchlists, extractSymbol, extractPriority } from "../database/watchlistDao.js";
import { getResultsCalendarData } from "./resultsCalendarService.js";
// pdf-parse loaded dynamically when needed

let aiClient: GoogleGenAI | null = null;
let lastGeminiQuotaExhaustedTime = 0;
const GEMINI_QUOTA_COOLDOWN_MS = 30000; // 30s circuit breaker on hard quota exhaustion
const activeSummaryRequests = new Map<string, Promise<string>>();

function getAI() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

export function escapeHTML(str: string): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateInstantHeuristicSummary(
  company: string, 
  subject: string, 
  details: string, 
  category: string = 'OTHER'
): string {
  const cleanDetails = (details || "").replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanSubject = (subject || "").replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const text = `${cleanSubject} ${cleanDetails}`;

  // 1. Dividend / Corporate Action detection
  const divMatch = text.match(/(?:dividend\s+of\s+rs\.?|dividend\s+@\s*rs\.?|dividend\s+of\s*₹?|interim\s+dividend\s+of\s*rs\.?)\s*([\d\.]+)/i);
  const recDateMatch = text.match(/(?:record\s+date\s+(?:for\s+(?:payment|determining|dividend)\s+)?(?:is\s+|as\s+|fixed\s+as\s+)?)([a-zA-Z0-9\s,\/\-]+(?:,\s*\d{4}|\d{4}))/i);
  const bonusMatch = text.match(/(?:bonus\s+issue\s+(?:in\s+the\s+ratio\s+of\s+|of\s+)?|ratio\s+of\s+)(\d+\s*:\s*\d+)/i);
  const splitMatch = text.match(/(?:sub-division|split)\s+(?:of\s+each\s+equity\s+share\s+of\s+face\s+value\s+of\s+rs\.?\s*(\d+)\s+into\s+rs\.?\s*(\d+)|from\s+rs\.?\s*(\d+)\s+to\s+rs\.?\s*(\d+))/i);
  
  // 2. Order Win / Capex detection
  const orderAmountMatch = text.match(/(?:order|contract|worth|valued\s+at|amounting\s+to|aggregate\s+value\s+of)\s*(?:approx\.?|aggregating\s+to)?\s*(?:rs\.?|inr|₹)?\s*([\d\.,]+)\s*(cr|crore|crores|lakh|lakhs|million|billion)?/i);

  // 3. Results / Financials key mentions
  const revenueMatch = text.match(/(?:revenue\s+from\s+operations|total\s+revenue|turnover|net\s+sales)\s*(?:of\s+rs\.?|of\s*₹?|is\s+rs\.?|stands\s+at\s+rs\.?)?\s*([\d\.,]+)\s*(cr|crore|crores|lakh|lakhs)?/i);
  const patMatch = text.match(/(?:profit\s+after\s+tax|net\s+profit|pat)\s*(?:of\s+rs\.?|of\s*₹?|is\s+rs\.?|stands\s+at\s+rs\.?)?\s*([\d\.,]+)\s*(cr|crore|crores|lakh|lakhs)?/i);

  let output = `📊 **Fast Filing Summary (Direct Extraction)**\n\n`;
  output += `• **Company:** ${company}\n`;
  output += `• **Filing Type:** ${category}\n`;
  output += `• **Subject:** ${cleanSubject}\n\n`;

  output += `**Key Highlights:**\n`;

  if (category === 'RESULTS' || cleanSubject.toLowerCase().includes('result') || cleanSubject.toLowerCase().includes('financial')) {
    output += `• **Financial Results Submission:** Board of Directors approved quarterly / annual financial statements.\n`;
    if (revenueMatch) {
      output += `• **Revenue / Net Sales:** ₹${revenueMatch[1]} ${revenueMatch[2] || 'Cr'} (reported in filing)\n`;
    }
    if (patMatch) {
      output += `• **Net Profit (PAT):** ₹${patMatch[1]} ${patMatch[2] || 'Cr'}\n`;
    }
    if (divMatch) {
      output += `• **Dividend Declared:** ₹${divMatch[1]} per equity share.\n`;
    }
  }

  if (divMatch && !output.includes('Dividend Declared')) {
    output += `• **Dividend:** ₹${divMatch[1]} per equity share declared.\n`;
  }
  if (bonusMatch) {
    output += `• **Bonus Issue Ratio:** ${bonusMatch[1]} bonus shares approved.\n`;
  }
  if (splitMatch) {
    output += `• **Stock Split:** Share face value sub-divided (${splitMatch[1] || splitMatch[3]} to ${splitMatch[2] || splitMatch[4]}).\n`;
  }
  if (recDateMatch) {
    output += `• **Record Date:** ${recDateMatch[1].trim()}\n`;
  }
  if (orderAmountMatch) {
    output += `• **Order / Contract Value:** ₹${orderAmountMatch[1]} ${orderAmountMatch[2] || 'Cr'}\n`;
  }

  // Extract first 2-3 meaningful sentences from details if available
  const sentences = cleanDetails.split(/(?<=[.!?])\s+/).filter(s => s.length > 20 && !s.toLowerCase().includes('dear sir') && !s.toLowerCase().includes('scrip code'));
  if (sentences.length > 0) {
    output += `• **Filing Context:** ${sentences.slice(0, 2).join(' ')}\n`;
  }

  output += `\n<i>⚡ Instant structured extraction active. Full PDF attached in filing.</i>`;
  return output;
}

/**
 * Language-aware summary dispatcher. Default is English.
 * Each language is generated DIRECTLY from the filing (own prompt, own cache
 * field: `aiSummary` for Hinglish, `aiSummaryEn` for English) — one Gemini
 * call per language, cached afterwards. No translation chain.
 */
export async function generateDirectSummary(
  company: string,
  subject: string,
  details: string,
  category: string = 'OTHER',
  pdfLink: string = '',
  newsId?: string,
  lang: 'hinglish' | 'english' = 'english'
): Promise<string> {
  return generateLocalizedSummary(company, subject, details, category, pdfLink, newsId, lang);
}

async function generateLocalizedSummary(company: string, subject: string, details: string, category: string = 'OTHER', pdfLink: string = '', newsId?: string, lang: 'hinglish' | 'english' = 'english'): Promise<string> {
  const cacheField = lang === 'english' ? 'aiSummaryEn' : 'aiSummary';
  const cacheVariant = lang; // updateAnnouncementSummary variant
  const dedupKey = newsId ? `${lang}:${newsId}` : '';
  const langName = lang === 'english' ? 'English' : 'Hinglish';
  // Check if announcement already has a generated summary in cache/store
  if (newsId) {
    try {
      const existing = await getAnnouncementById(newsId);
      const cached = (existing as any)?.[cacheField];
      if (cached && typeof cached === 'string' && cached.trim().length > 0) {
        return cached;
      }
    } catch {}

    // Deduplicate in-flight generation promises for the same newsId+lang across multiple users
    if (dedupKey && activeSummaryRequests.has(dedupKey)) {
      return activeSummaryRequests.get(dedupKey)!;
    }
  }

  const executionPromise = (async () => {
    const ai = getAI();
    if (!ai) {
      addLog('INFO', 'GEMINI', `[${company}] Gemini API key missing. Generating instant heuristic extraction summary.`);
      return generateInstantHeuristicSummary(company, subject, details, category);
    }

    // Fast-fail if circuit breaker is OPEN with heuristic summary fallback
    if (geminiCircuitBreaker.getState() === 'OPEN') {
      const remainingCooldown = Math.round(geminiCircuitBreaker.getStatus().resetTimeoutMs / 1000);
      addLog('INFO', 'GEMINI', `[${company}] Gemini circuit breaker is OPEN (${remainingCooldown}s cooldown). Providing instant extraction summary.`);
      const fallbackSummary = generateInstantHeuristicSummary(company, subject, details, category);
      if (newsId) {
        try { await updateAnnouncementSummary(newsId, fallbackSummary, cacheVariant); } catch {}
      }
      return fallbackSummary;
    }

    const startTime = Date.now();
    addLog('INFO', 'GEMINI', `[${company}] Starting AI summary generation (${category}, ${langName})${pdfLink ? ' with PDF attachment' : ''}`);

  try {
    let pdfData: any = null;
    let extractedPdfText = "";

    if (pdfLink && (category === 'RESULTS' || category === 'CONFERENCE_CALL')) {
      try {
        addLog('INFO', 'GEMINI', `[${company}] Downloading filing PDF from BSE...`);
        const res = await fetch(pdfLink, { signal: AbortSignal.timeout(25000) });
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

          if (buffer.length <= 20 * 1024 * 1024) {
            // Send inline PDF to Gemini directly (up to 20MB)
            pdfData = {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf"
              }
            };
            addLog('INFO', 'GEMINI', `[${company}] Attached inline PDF (${sizeMB} MB) for deep financial analysis`);
          } else {
            // PDF is > 20MB, fallback to extracting text via pdf-parse
            addLog('INFO', 'GEMINI', `[${company}] PDF is large (${sizeMB} MB), extracting text via parser...`);
            try {
              const pdfParseMod: any = await import("pdf-parse");
              const pdfParse = pdfParseMod.default || pdfParseMod;
              const parsed = await pdfParse(buffer);
              if (parsed && parsed.text) {
                extractedPdfText = parsed.text.substring(0, 15000); // Limit text length
                addLog('SUCCESS', 'GEMINI', `[${company}] Extracted ${extractedPdfText.length} chars from large PDF`);
              }
            } catch (pErr: any) {
              addLog('WARNING', 'GEMINI', `[${company}] pdf-parse text extraction failed: ${pErr.message}`);
            }
          }
        } else {
          addLog('WARNING', 'GEMINI', `[${company}] BSE PDF returned HTTP status ${res.status}. Proceeding with headline.`);
        }
      } catch (err: any) {
        addLog('WARNING', 'GEMINI', `[${company}] Could not download PDF (${err.message}). Proceeding with text details.`);
      }
    }

    const combinedDetails = (details + (extractedPdfText ? "\n\nEXTRACTED PDF TEXT:\n" + extractedPdfText : "")).substring(0, 15000);
    let prompt = "";
    // Language instruction shared by all three prompt shapes below
    const langInstruction = lang === 'english'
      ? 'Use clear, professional plain English (no Hindi words).'
      : 'Use professional Hinglish (Hindi written in Roman/English script, the way Indians speak).';
    const summaryLineInstruction = lang === 'english'
      ? '[1-2 line professional plain-English summary highlighting whether performance is strong, weak, or stable]'
      : '[1-2 line Professional Hinglish summary highlighting whether performance is strong, weak, or stable]';
    
    if (category === 'RESULTS') {
      prompt = `You are a professional financial analyst monitoring Indian stock markets.
Read the attached financial results document/text for ${company} and analyze the key financial metrics.
${langInstruction}

INSTRUCTIONS FOR METRICS & PERCENTAGES:
1. Extract numbers for Current Period, Same Period Last Year (YoY), and Previous Quarter (QoQ) if explicitly available in the document.
2. CALCULATE and show YoY % change = ((Current - Same Period Last Year) / Same Period Last Year) * 100 for metrics ONLY when both figures exist in the filing.
3. CALCULATE and show QoQ % change = ((Current - Previous Quarter) / Previous Quarter) * 100 ONLY when previous quarter data exists in the filing.
4. For EBITDA/Operating Margins, show margin % and change in basis points (bps) or percentage points.
5. Convert Lakhs to Crores if appropriate (1 Cr = 100 Lakhs) or keep clear units (₹ Cr / ₹ Lakh).
6. Compute % growth figures yourself ONLY when table numbers exist in the text. If any metric or period is missing, write "Not available in filing". NEVER guess or invent numbers or figures.

METRICS TO COVER:
- Revenue / Net Sales
- Profit After Tax (PAT / Net Profit)
- Profit Before Tax (PBT)
- EBITDA / Operating Profit
- EBITDA Margin %
- EPS (Earnings Per Share)

FORMAT STRICTLY AS:

📊 **RESULTS ANALYSIS**

**YoY Growth:**
- **Revenue:** ₹[Current] Cr vs ₹[YoY] Cr (**[+X.X% / -X.X%]**)
- **PAT (Net Profit):** ₹[Current] Cr vs ₹[YoY] Cr (**[+X.X% / -X.X%]**)
- **EBITDA:** ₹[Current] Cr vs ₹[YoY] Cr (**[+X.X% / -X.X%]**)
- **EBITDA Margin:** [Current]% vs [YoY]% (**[+X bps / -X bps]**)
- **EPS:** ₹[Current] vs ₹[YoY] (**[+X.X% / -X.X%]**)

**QoQ Growth:**
[If previous quarter numbers exist, include QoQ breakdown in same format with % change, otherwise omit]

✨ **AI Summary:**
${summaryLineInstruction}

📈 **Key Positives:**
- [Bullet points of key positive growth, margin expansion, or operational highlights]

⚠️ **Key Concerns:**
- [Bullet points of margin compression, cost increases, or revenue dip if any]

Company: ${company}
Subject: ${subject}
Details: ${combinedDetails}`;
    } else if (category === 'CONFERENCE_CALL') {
      prompt = `You are a professional financial analyst monitoring Indian stock markets.
Extract Conference Call details from the announcement. ${langInstruction}

Extract:
- Date
- Time
- Purpose
SKIP any missing information. DO NOT invent dates or times.

Format strictly as:
✨ **AI Summary**
[Provide a brief professional summary of the call details. Include only information explicitly present.]

Use only the provided document or details below.

Company: ${company}
Subject: ${subject}
Details: ${combinedDetails}`;
    } else {
      prompt = `You are a professional financial analyst monitoring Indian stock markets.
Read this corporate announcement and provide a 1-2 line summary.
${langInstruction}
Keep it strictly professional and focus only on the core impact (e.g., Board meeting for dividends, Q3 results, Resignation of CEO, Acquisition etc.).
DO NOT invent numbers, dates, or statements that are not in the text.
If information is missing, explicitly say "Not mentioned in the filing."
Do not provide guaranteed price targets or personalized investment advice.
Format: Only return the summary text. No markdown except basic bold.

Company: ${company}
Subject: ${subject}
Details: ${combinedDetails}`;
    }
    
    const contents: any[] = [{ text: prompt }];
    if (pdfData) {
      contents.push(pdfData);
    }

    const modelsToTry = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let response: any = null;
    let lastError: any = null;
    let successfulModel = "";

    try {
      response = await geminiCircuitBreaker.execute(async () => {
        for (const modelName of modelsToTry) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const res = await ai.models.generateContent({
                model: modelName,
                contents: contents
              });
              if (res && res.text) {
                successfulModel = modelName;
                return res;
              }
            } catch (err: any) {
              lastError = err;
              const errStr = err?.message || String(err);
              const is429 = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || errStr.includes("quota");
              
              if (is429) {
                addLog('WARNING', 'GEMINI', `[${company}] Free tier rate limit on ${modelName} (Attempt ${attempt}). Trying fallback...`);
                await new Promise(r => setTimeout(r, 1500));
              } else {
                addLog('WARNING', 'GEMINI', `[${company}] Model ${modelName} returned error: ${errStr.substring(0, 100)}`);
                break; // Try next model in list
              }
            }
          }
        }
        throw (lastError || new Error("All Gemini models returned empty output"));
      }, undefined, 18000);
    } catch (cbErr: any) {
      lastError = cbErr;
    }

    if (!response || !response.text) {
      const msg = lastError?.message || "No response text generated";
      const is429 = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded") || msg.includes("quota");
      if (is429) {
        lastGeminiQuotaExhaustedTime = Date.now();
        addLog('WARNING', 'GEMINI', `[${company}] Gemini API quota / rate limit exhausted on all models. Falling back to instant text extraction summary.`);
      } else {
        const shortMsg = msg.length > 150 ? msg.substring(0, 150) + "..." : msg;
        addLog('WARNING', 'GEMINI', `[${company}] AI summary generation failed (${shortMsg}). Falling back to instant text extraction.`);
      }

      const fallbackSummary = generateInstantHeuristicSummary(company, subject, details, category);
      if (newsId) {
        try {
          await updateAnnouncementSummary(newsId, fallbackSummary, cacheVariant);
        } catch {}
      }
      return fallbackSummary;
    }
    
    let summaryText = response.text || "";
    if (summaryText) {
      summaryText = summaryText
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?b>/gi, '**');
      
      if (newsId) {
        await updateAnnouncementSummary(newsId, summaryText, cacheVariant);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    addLog('SUCCESS', 'GEMINI', `[${company}] AI ${langName} summary created via ${successfulModel} in ${elapsed}s (${summaryText.length} chars)`);
    return summaryText;
  } catch (e: any) {
    const msg = e?.message || String(e);
    const shortMsg = msg.length > 150 ? msg.substring(0, 150) + "..." : msg;
    addLog('ERROR', 'GEMINI', `[${company}] Unhandled exception in summary generation: ${shortMsg}`);
    return "";
  }
  })();

  if (dedupKey) {
    activeSummaryRequests.set(dedupKey, executionPromise);
    executionPromise.finally(() => {
      activeSummaryRequests.delete(dedupKey);
    });
  }

  return executionPromise;
}

// ---------- Watchlist-aware AI Guide context ----------
// Builds a small, bounded context block from the user's OWN watchlists +
// the app's results calendar + latest filing. Keeps the guide grounded in
// real app data (never invented) and keeps token cost tiny: only the
// matched company (max 3), a few lines each. Returns '' when the question
// is pure app-help (no company intent).
interface WatchlistAiItem {
  symbol: string;
  name: string;
  listName: string;
  priority: string;
}

function normalizeForMatch(s: string): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
}

async function buildWatchlistAiContext(uid: string | undefined, question: string): Promise<string> {
  if (!uid || uid === 'anonymous' || uid.startsWith('guest_') || uid.startsWith('trader_')) return '';
  let lists: any[] = [];
  try {
    lists = await getAllWatchlists(uid);
  } catch {
    return '';
  }
  if (!Array.isArray(lists) || lists.length === 0) return '';

  const items: WatchlistAiItem[] = [];
  for (const list of lists) {
    const listName = list?.name || 'Watchlist';
    const arr = Array.isArray(list?.items) ? list.items : [];
    for (const it of arr) {
      try {
        const symbol = extractSymbol(it);
        if (!symbol) continue;
        items.push({
          symbol: String(symbol).toUpperCase(),
          name: normalizeForMatch(it?.name || it?.companyName || ''),
          listName: String(listName),
          priority: extractPriority(it) || 'MEDIUM',
        });
      } catch { /* skip malformed item */ }
    }
  }
  if (items.length === 0) return '';

  const qNorm = ' ' + normalizeForMatch(question) + ' ';
  const matched: WatchlistAiItem[] = [];
  for (const it of items) {
    let hit = false;
    if (it.symbol && it.symbol.length >= 2 && qNorm.includes(' ' + it.symbol + ' ')) hit = true;
    if (!hit && it.name) {
      const words = it.name.split(/\s+/).filter(w => w.length >= 5);
      for (const w of words) {
        if (qNorm.includes(' ' + w + ' ')) { hit = true; break; }
      }
    }
    if (hit && !matched.some(m => m.symbol === it.symbol)) matched.push(it);
  }

  const looksLikeCompanyQ = /(result|results|board meeting|dividend|bonus|split|filing|announcement|share|price|stock|company|watchlist|add)/i.test(question);

  if (matched.length === 0) {
    if (!looksLikeCompanyQ) return ''; // pure app-help question — no context needed
    return `USER_WATCHLIST_NOTE: The user asked about a company, but no company in their watchlist matched this question. Their watchlist currently tracks ${items.length} stock(s) across ${lists.length} list(s). Tell them this company is not in their watchlist yet, and briefly explain how to add it (Watchlists tab → Add stock → search the symbol → set priority High/Medium/Low). Do NOT invent any company facts, dates, or figures.`;
  }

  // Enrich matches with calendar + latest filing (bounded: max 3 companies).
  // getResultsCalendarData already filters to this user's watchlist when uid is passed.
  const uniqueSymbols = [...new Set(matched.map(m => m.symbol))].slice(0, 3);
  let calendarItems: any[] = [];
  try {
    const calData = await getResultsCalendarData('all', undefined, uid);
    if (calData && Array.isArray((calData as any).items)) calendarItems = (calData as any).items;
  } catch { calendarItems = []; }

  const lines: string[] = [];
  for (const sym of uniqueSymbols) {
    const entries = matched.filter(m => m.symbol === sym);
    const e0 = entries[0];
    const listBits = entries.map(e => `"${e.listName}" (${e.priority})`).join(', ');

    let calBit = 'no upcoming board meeting found in the app calendar';
    try {
      const calItems = (calendarItems || []).filter((c: any) =>
        String(c.symbol || '').toUpperCase() === sym ||
        String(c.companyName || '').toUpperCase().includes(sym)
      );
      const upcoming = calItems
        .filter((c: any) => c.status === 'UPCOMING' || c.status === 'TODAY')
        .sort((a: any, b: any) => (a.meetingTimestamp || 0) - (b.meetingTimestamp || 0))[0];
      if (upcoming) {
        calBit = `${upcoming.status === 'TODAY' ? 'board meeting TODAY' : 'next board meeting'} on ${upcoming.meetingDate}${upcoming.purpose ? ` (${upcoming.purpose})` : ''}`;
      } else {
        const recent = calItems
          .filter((c: any) => c.status === 'RECENT' || c.isDeclared)
          .sort((a: any, b: any) => (b.meetingTimestamp || 0) - (a.meetingTimestamp || 0))[0];
        if (recent) calBit = `last board meeting ${recent.meetingDate}${recent.purpose ? ` (${recent.purpose})` : ''}; no upcoming meeting scheduled in the app calendar`;
      }
    } catch { /* keep default */ }

    let filingBit = 'no recent filing found in the last 7 days';
    try {
      const recent = await getRecentAnnouncements(3, [sym]);
      if (recent && recent.length > 0) {
        const f = recent[0] as any;
        const when = f.bseTime || f.time || '';
        filingBit = `latest filing: "${String(f.subject || f.NEWSSUB || 'announcement').slice(0, 90)}"${when ? ` (${when})` : ''}`;
      }
    } catch { /* keep default */ }

    lines.push(`- ${sym}: in watchlist ${listBits}. Calendar: ${calBit}. ${filingBit}.`);
  }

  const ambiguous = uniqueSymbols.length > 1;
  return `USER_WATCHLIST_CONTEXT (use ONLY these app facts for company specifics; never invent dates or figures):\n` +
    lines.join('\n') +
    (ambiguous ? `\nNOTE: Multiple watchlist companies matched — ask the user which one they mean before giving specifics.` : '');
}

export async function askAppHelpAI(
  userQuestion: string, 
  history: Array<{ role: 'user' | 'model'; text: string }> = [],
  opts: { uid?: string } = {}
): Promise<string> {
  const ai = getAI();
  if (!ai) {
    return "Gemini AI is not configured yet. Please ensure the GEMINI_API_KEY environment secret is active in settings.";
  }

  // Watchlist grounding: real app facts for company questions (bounded, cheap).
  // Never let a context failure break the guide — fail open to plain app help.
  let watchlistContext = '';
  try {
    watchlistContext = await buildWatchlistAiContext(opts.uid, userQuestion);
  } catch {
    watchlistContext = '';
  }

  // Cost-control nudge: after 2-3 user questions in this session, steer the
  // user toward exploring the app themselves instead of more AI questions.
  const userQuestionsInSession = history.filter(m => m.role === 'user').length + 1;

  const systemInstruction = `You are the official AI Assistant and Guide for **Bsenexus** (Bombay Stock Exchange Live Disclosures & Regulatory Intelligence Terminal).
Your job is to guide users, explain all app features, and help them configure and use Bsenexus effectively in clear, friendly, and structured language (reply in Hindi, Hinglish, or English matching the user's language).

### ANSWER STYLE (strict — keeps answers useful and AI costs low):
- Keep every answer under 90 words. Be casual, direct, and warm — like a knowledgeable friend, not a manual.
- No long bullet essays unless the user explicitly asks for step-by-step instructions.
- When the user asks about a company, answer ONLY from USER_WATCHLIST_CONTEXT below. If a fact is missing there, say "the app doesn't show this right now" — never invent dates, figures, or filings.
${userQuestionsInSession >= 3 ? `
### SESSION NUDGE (this user has asked ${userQuestionsInSession} questions in this chat):
After your brief answer, add ONE short line pointing them to the exact app screen where they can explore this themselves (e.g. "Results Calendar tab", "Company Hub → Filing Facts", "Watchlists tab"), plus 2 short follow-up questions they could ask. Goal: help them discover the app so they need the AI less. Stay helpful — never refuse, never give wrong info.` : ''}
${watchlistContext ? `
### ${watchlistContext.startsWith('USER_WATCHLIST_CONTEXT') ? 'Live watchlist facts for this question' : 'Watchlist note'}:
${watchlistContext}
` : ''}

### Bsenexus knowledge base (compressed to save API quota — answer ONLY from this; never invent dates/figures):
- Bsenexus = live BSE disclosures, board meetings & filings terminal for Indian equity investors.
- Watchlists (Pro): unlimited lists/stocks; per-stock priority HIGH/MED/LOW (a stock in multiple lists resolves to the highest priority); Free plan: no watchlists.
- Results Calendar: board meetings for results/dividends/bonus/demerger; status Upcoming / Today-Awaiting Outcome / Outcome Declared; per-stock past results history with BSE PDFs.
- AI summaries: 50+ page BSE PDFs distilled to YoY revenue, PAT, EBITDA margin, dividend. Pro: 100/day. Free: ONE one-time demo summary ever.
- Telegram alerts (Pro): get Chat ID from @userinfobot → Settings → Telegram Configuration → paste → Save & Test. Categories: Results, Concalls, Dividends, Order Wins, Insider Trading. Master toggle in Settings stops everything.
- Free: live BSE feed + one AI demo; no watchlists, no Telegram. Pro one-time packs (no auto-renewal): Weekly ₹59 (7 days), Monthly ₹199 (30 days), 6-Month ₹999 (180 days), Yearly ₹1,799 (365 days). Pro adds unlimited watchlists, 100 AI summaries/day, Telegram alerts, CSV export. 7-day free Pro trial, no card.
- Storage: Firestore primary; auto-falls-back to local JSON near quota; admin can force modes in Storage Manager.
- Security: Master PIN locks admin/Telegram settings; Noise Filter mutes spam filings.

When the user asks how to do something in the app, give direct, actionable steps. Otherwise keep it short and conversational. Be polite, precise, and supportive.`;

  if (geminiCircuitBreaker.getState() === 'OPEN') {
    // NOTE: this fires when the summary pipeline (not the Guide itself) hit
    // repeated upstream failures — the key is fine, the AI service is just
    // overloaded. Never blame the API key here.
    return "The AI Assistant is taking a short break — the AI service is seeing heavy demand right now. Please try again in a few moments.";
  }

  try {
    const formattedContents: any[] = [];
    
    // Add recent history for context
    if (history && history.length > 0) {
      for (const msg of history.slice(-6)) {
        formattedContents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      }
    }

    formattedContents.push({
      role: 'user',
      parts: [{ text: userQuestion }]
    });

    // Lite-first: the smallest/cheapest model answers user Q&A so API quota
    // and cost stay at minimum. Bigger models are fallbacks only.
    const helpModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
    let response: any = null;
    let lastErr: any = null;

    // 503/429/UNAVAILABLE = transient upstream overload — worth one short
    // retry before falling through to the next model.
    const isRetryableUpstream = (e: any) => {
      const s = String(e?.message || e);
      return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|try again later/i.test(s);
    };

    for (const mName of helpModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: mName,
            contents: formattedContents,
            config: {
              systemInstruction,
              temperature: 0.4,
            }
          });
          if (response && response.text) break;
        } catch (e: any) {
          lastErr = e;
          if (attempt === 1 && isRetryableUpstream(e)) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          break;
        }
      }
      if (response && response.text) break;
    }

    if (!response || !response.text) {
      throw lastErr || new Error("Failed to generate response");
    }

    return response.text.trim() || "I am sorry, I could not generate an answer right now. Please try again.";
  } catch (err: any) {
    // Never show raw API JSON to the user — it leaks internals and confuses.
    // The raw error is already logged server-side above.
    addLog('ERROR', 'GEMINI', `Help AI Chat error: ${err?.message || err}`);
    return "The AI Assistant is busy right now (heavy demand on the AI service). Please try again in a few moments.";
  }
}

/**
 * Public website FAQ answerer — Layer 2 of the AI FAQ abuse defence.
 *
 * Only called when the curated bank (Layer 1) has no match. Deliberately
 * lean: single-shot, no conversation history, no watchlist context (the
 * visitor is usually anonymous), cheapest model first, English only.
 * Throws on failure so the caller can return a 503 WITHOUT consuming the
 * visitor's daily quota.
 */
export async function askPublicFaq(userQuestion: string): Promise<string> {
  const ai = getAI();
  if (!ai) {
    throw new Error('Gemini AI is not configured');
  }
  if (geminiCircuitBreaker.getState() === 'OPEN') {
    throw new Error('AI service is temporarily overloaded');
  }

  const systemInstruction = `You are the Bsenexus website FAQ assistant. Answer ONLY questions about Bsenexus itself: its features, plans and pricing, free trial, and how to use the site (watchlists, Telegram alerts, results calendar, AI summaries, company pages, filings).

Rules (strict):
- Plain English, friendly, under 80 words. No markdown tables.
- Use ONLY the facts below; never invent prices, dates, or features.
- If the question is NOT about Bsenexus, reply with exactly this sentence and nothing else: "I can only answer questions about Bsenexus — try asking about our features, plans, or how to use the site."
- Never give investment advice, stock tips, or buy/sell recommendations.

Facts:
- Bsenexus = live BSE India corporate disclosures terminal: filings feed, results calendar, AI filing summaries, watchlists, Telegram alerts. Data from official bseindia.com filings, 5000+ scrips covered.
- Pro one-time plans (NO auto-renewal, NO subscription): Weekly ₹59/7 days, Monthly ₹199/30 days (most popular), 6-Month ₹999/180 days, Yearly ₹1,799/365 days (best value).
- 7-day free Pro trial, no card required. After trial ends the account moves to the Free tier; nothing is ever charged automatically.
- Free tier: live BSE announcements, results calendar, exactly one one-time AI summary demo. No watchlists, no Telegram alerts.
- Pro adds: unlimited watchlists (per-stock priority HIGH/MED/LOW), Telegram alerts for watched stocks, AI filing summaries, smart mute filter for routine filings, CSV/JSON export.
- AI summaries: English by default, Hinglish toggle available. Generated from official filing text — verify critical figures on bseindia.com.
- Telegram alerts: Pro feature; link via Settings → Telegram.
- Company pages: search any BSE scrip or open /company/SYMBOL for filings history, board meetings, price data, peers.
- Bsenexus is NOT affiliated with BSE India Ltd, SEBI, or Nexus Select Trust.`;

  const publicFaqModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastErr: any = null;
  for (const mName of publicFaqModels) {
    try {
      const response = await ai.models.generateContent({
        model: mName,
        contents: [{ role: 'user', parts: [{ text: userQuestion }] }],
        config: { systemInstruction, temperature: 0.4 },
      });
      const text = (response as any)?.text?.trim();
      if (text) return text;
    } catch (e: any) {
      lastErr = e;
    }
  }
  addLog('ERROR', 'GEMINI', `Public FAQ AI error: ${lastErr?.message || lastErr}`);
  throw lastErr || new Error('Failed to generate answer');
}

export async function generateAndSendSummary(
  replyToMessageId: number, 
  company: string, 
  subject: string, 
  details: string, 
  category: string = 'OTHER', 
  pdfLink: string = '', 
  newsId?: string,
  customChatId?: string | null,
  lang: 'hinglish' | 'english' = 'english'
) {
  const summaryText = await generateDirectSummary(company, subject, details, category, pdfLink, newsId, lang);
  if (!summaryText) {
    addLog('WARNING', 'GEMINI', `[${company}] No AI summary generated. Telegram reply skipped.`);
    return;
  }

  try {
    // Escape HTML special characters so < and > in text don't break Telegram HTML parser
    let safeText = escapeHTML(summaryText);

    // Convert markdown bold **text** to <b>text</b>
    let formattedText = safeText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    
    let msg = "";
    if (category === 'RESULTS' || category === 'CONFERENCE_CALL') {
      msg = formattedText;
    } else {
      msg = `✨ <b>AI Summary</b>\n\n${formattedText}`;
    }

    if (msg.length > 3900) {
      msg = msg.substring(0, 3850) + "\n\n<i>[Summary truncated due to length]</i>";
    }
    
    const replyRes = await sendReplyToTelegram(msg, replyToMessageId, customChatId);
    if (replyRes && replyRes.success) {
      addLog('SUCCESS', 'TELEGRAM', `[${company}] Telegram reply with AI summary delivered (ReplyTo: #${replyToMessageId})`);
    } else {
      addLog('ERROR', 'TELEGRAM', `[${company}] Failed to deliver summary reply to Telegram: ${replyRes?.error || 'Unknown error'}`);
    }
  } catch (e: any) {
    addLog('ERROR', 'TELEGRAM', `[${company}] Telegram summary reply exception: ${e.message}`);
  }
}
