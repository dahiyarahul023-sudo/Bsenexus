import { GoogleGenAI } from "@google/genai";
import { sendReplyToTelegram } from "./telegram.js";
import { addLog } from "../database/logDao.js";
import { updateAnnouncementSummary, getAnnouncementById } from "../database/announcementDao.js";
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

export async function generateDirectSummary(company: string, subject: string, details: string, category: string = 'OTHER', pdfLink: string = '', newsId?: string): Promise<string> {
  // Check if announcement already has a generated summary in cache/store
  if (newsId) {
    try {
      const existing = await getAnnouncementById(newsId);
      if (existing && existing.aiSummary && typeof existing.aiSummary === 'string' && existing.aiSummary.trim().length > 0) {
        return existing.aiSummary;
      }
    } catch {}

    // Deduplicate in-flight generation promises for the same newsId across multiple users
    if (activeSummaryRequests.has(newsId)) {
      return activeSummaryRequests.get(newsId)!;
    }
  }

  const executionPromise = (async () => {
    const ai = getAI();
    if (!ai) {
      addLog('INFO', 'GEMINI', `[${company}] Gemini API key missing. Generating instant heuristic extraction summary.`);
      return generateInstantHeuristicSummary(company, subject, details, category);
    }

  // Fast-fail if quota is temporarily exhausted with heuristic summary fallback
  const elapsedCooldown = Date.now() - lastGeminiQuotaExhaustedTime;
  if (elapsedCooldown < GEMINI_QUOTA_COOLDOWN_MS) {
    addLog('INFO', 'GEMINI', `[${company}] Gemini cooldown active (${Math.ceil((GEMINI_QUOTA_COOLDOWN_MS - elapsedCooldown)/1000)}s remaining). Providing instant extraction summary.`);
    const fallbackSummary = generateInstantHeuristicSummary(company, subject, details, category);
    if (newsId) {
      try { await updateAnnouncementSummary(newsId, fallbackSummary); } catch {}
    }
    return fallbackSummary;
  }

  const startTime = Date.now();
  addLog('INFO', 'GEMINI', `[${company}] Starting AI summary generation (${category})${pdfLink ? ' with PDF attachment' : ''}`);

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
    
    if (category === 'RESULTS') {
      prompt = `You are a professional financial analyst monitoring Indian stock markets.
Read the attached financial results document/text for ${company} and analyze the key financial metrics.
Use Professional Hinglish.

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
[1-2 line Professional Hinglish summary highlighting whether performance is strong, weak, or stable]

📈 **Key Positives:**
- [Bullet points of key positive growth, margin expansion, or operational highlights]

⚠️ **Key Concerns:**
- [Bullet points of margin compression, cost increases, or revenue dip if any]

Company: ${company}
Subject: ${subject}
Details: ${combinedDetails}`;
    } else if (category === 'CONFERENCE_CALL') {
      prompt = `You are a professional financial analyst monitoring Indian stock markets.
Extract Conference Call details from the announcement. Use Professional Hinglish.

Extract:
- Date
- Time
- Purpose
SKIP any missing information. DO NOT invent dates or times.

Format strictly as:
✨ **AI Summary**
[Provide a brief professional Hinglish summary of the call details. Include only information explicitly present.]

Use only the provided document or details below.

Company: ${company}
Subject: ${subject}
Details: ${combinedDetails}`;
    } else {
      prompt = `You are a professional financial analyst monitoring Indian stock markets.
Read this corporate announcement and provide a 1-2 line summary.
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

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contents
          });
          if (response && response.text) {
            successfulModel = modelName;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const errStr = err?.message || String(err);
          const is429 = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || errStr.includes("quota");
          
          if (is429) {
            addLog('WARNING', 'GEMINI', `[${company}] Free tier rate limit on ${modelName} (Attempt ${attempt}). Trying fallback...`);
            await new Promise(r => setTimeout(r, 2000));
          } else {
            addLog('WARNING', 'GEMINI', `[${company}] Model ${modelName} returned error: ${errStr.substring(0, 100)}`);
            break; // Try next model in list
          }
        }
      }
      if (response && response.text) break;
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
          await updateAnnouncementSummary(newsId, fallbackSummary);
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
        await updateAnnouncementSummary(newsId, summaryText);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    addLog('SUCCESS', 'GEMINI', `[${company}] AI summary created via ${successfulModel} in ${elapsed}s (${summaryText.length} chars)`);
    return summaryText;
  } catch (e: any) {
    const msg = e?.message || String(e);
    const shortMsg = msg.length > 150 ? msg.substring(0, 150) + "..." : msg;
    addLog('ERROR', 'GEMINI', `[${company}] Unhandled exception in summary generation: ${shortMsg}`);
    return "";
  }
  })();

  if (newsId) {
    activeSummaryRequests.set(newsId, executionPromise);
    executionPromise.finally(() => {
      activeSummaryRequests.delete(newsId);
    });
  }

  return executionPromise;
}

export async function askAppHelpAI(
  userQuestion: string, 
  history: Array<{ role: 'user' | 'model'; text: string }> = []
): Promise<string> {
  const ai = getAI();
  if (!ai) {
    return "Gemini AI is not configured yet. Please ensure the GEMINI_API_KEY environment secret is active in settings.";
  }

  const systemInstruction = `You are the official AI Assistant and Guide for **BSE Nexus** (Bombay Stock Exchange Live Disclosures & Regulatory Intelligence Terminal).
Your job is to guide users, explain all app features, and help them configure and use BSE Nexus effectively in clear, friendly, and structured language (reply in Hindi, Hinglish, or English matching the user's language).

### Comprehensive Knowledge Base about BSE Nexus:
1. **What is BSE Nexus?**
   - A real-time market terminal tracking all official corporate disclosures, board meetings, and financial filings from BSE India with sub-second latency.
   - Designed for active equity investors, traders, and fund managers.

2. **Watchlist & Priority Tiers (High / Medium / Low)**:
   - Users can create unlimited custom watchlists (e.g. "Core Port", "Defense", "PSU Banks", "EV & Auto").
   - Each stock can be assigned a Conviction Priority:
     - 🔴 **HIGH Priority**: High conviction core holdings (top alerts & Telegram push).
     - 🟡 **MEDIUM Priority**: Positional & momentum watchlist.
     - 🟢 **LOW Priority**: Passive observation.
   - **No Duplicate Overlaps**: If a stock exists in multiple lists with differing priorities, the system intelligently resolves to the highest conviction level (HIGH > MEDIUM > LOW) to ensure clean, accurate notifications without duplicates. Users can also sync a stock's priority across all lists in 1 click.

3. **Results & Earnings Calendar & Historical Results**:
   - Tracks board meetings scheduled for Quarterly Results, Dividends, Bonus, and Demergers.
   - Displays real-time status: "Upcoming", "Today - Awaiting Outcome", or "Outcome Declared".
   - **Previous Results History**: Selecting any stock shows its past quarterly results history, declaration dates, exact submission timestamps (IST), and direct BSE PDF attachments.

4. **AI Earnings Summaries (Gemini Engine)**:
   - Reads complex 50+ page BSE corporate PDFs in seconds.
   - Extracts YoY Revenue Growth, Net Profit (PAT) YoY, EBITDA Margin expansion/contraction, and Dividend details.

5. **Telegram Real-time Alerts Setup**:
   - Step 1: Open Telegram and search for bot **@userinfobot**, type /start to get your numerical Chat ID (e.g. 123456789).
   - Step 2: In BSE Nexus **Settings** -> **Telegram Configuration**, paste your Chat ID and click "Save & Test Alert".
   - Users receive instant alerts when their watchlist companies submit price-sensitive announcements.
   - Users can customize which categories (Results, Concalls, Dividends, Order Wins, Insider Trading) and stock priorities trigger Telegram messages.

6. **Free Tier vs Pro Membership**:
   - **Free Plan**: Track up to 5 stocks across watchlists with live BSE feed and standard tools.
   - **Pro Plan**: Unlimited stocks, unlimited custom watchlists, instant AI summaries, granular Telegram filter routing, and historical data archive.

7. **Storage Quota & Free Tier Optimizer (Automatic + Manual)**:
   - Automatically stores data in Firebase Firestore.
   - **Continuous Protection**: If Google Cloud free tier daily write limits are approached, the system automatically falls back to fast, secure Local JSON Storage without data loss.
   - **Manual Mode**: Admin can choose between Automatic Mode, Force Local Storage (zero cloud usage), or Force Firestore Mode in Storage Manager.

8. **Security & Noise Control**:
   - Set a Master Security PIN to lock Admin controls and Telegram settings.
   - Mute routine spam filings (loss of share certificates, trading window closures) via Noise Filter.

Provide direct, actionable, step-by-step guidance. Be polite, precise, and supportive.`;

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

    const helpModels = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let response: any = null;
    let lastErr: any = null;

    for (const mName of helpModels) {
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
      }
    }

    if (!response || !response.text) {
      throw lastErr || new Error("Failed to generate response");
    }

    return response.text.trim() || "I am sorry, I could not generate an answer right now. Please try again.";
  } catch (err: any) {
    addLog('ERROR', 'GEMINI', `Help AI Chat error: ${err.message}`);
    return `An error occurred while consulting the AI Assistant: ${err.message}`;
  }
}

export async function generateAndSendSummary(
  replyToMessageId: number, 
  company: string, 
  subject: string, 
  details: string, 
  category: string = 'OTHER', 
  pdfLink: string = '', 
  newsId?: string,
  customChatId?: string | null
) {
  const summaryText = await generateDirectSummary(company, subject, details, category, pdfLink, newsId);
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
