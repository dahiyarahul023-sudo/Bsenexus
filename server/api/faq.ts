import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { findBankAnswer, faqBankSize } from '../services/faqBank.js';
import { askPublicFaq } from '../services/gemini.js';
import { readLocalJson, writeLocalJson } from '../database/localStore.js';
import { getSanitizedClientIp } from '../security/accountRateLimiter.js';

/**
 * Public AI FAQ endpoint — POST /api/faq/ask
 *
 * Abuse defence layers (attacker-expensive, us-cheap):
 *  Layer 0 (blunt): express-rate-limit 20 req/min/IP — stops naive floods.
 *  Layer 1 (bank):  curated Q&A bank answers instantly with ZERO Gemini cost
 *                   and WITHOUT consuming the visitor's AI quota.
 *  Layer 2 (AI):    unmatched questions go to Gemini single-shot, guarded by
 *                   a SERVER-SIDE daily quota: 4/day per anonymous IP-hash,
 *                   4/day per logged-in account. Client-side counters are
 *                   bypassable (incognito) and are display-only.
 *  Layer 3 (login): anonymous quota exhausted → 429 with loginRequired:true,
 *                   pushing the visitor to sign in (abuse becomes account-
 *                   bound and ban-able).
 *  Layer 4 (learn): anonymized questions are logged (no IP, no uid) so
 *                   frequent real questions can be promoted into the bank,
 *                   shrinking AI spend over time.
 *
 * Quota store: local JSON (same pattern as aiQuotaService). Counters reset
 * at 00:00 IST. Admins are exempt.
 */

export const faqRouter = express.Router();

const FAQ_USAGE_FILE = 'faq_usage.json';
const FAQ_QUESTIONS_FILE = 'faq_questions.json';
const FAQ_AI_DAILY_LIMIT = 4;
const MAX_QUESTION_LEN = 200;
const MAX_LOG_ENTRIES = 500;

// Blunt anti-flood per IP. Bank answers are cheap, but a scripted flood still
// wastes CPU — this keeps it at a dull roar while Layer 2 does the real work.
const faqFloodLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false, default: true },
  message: { success: false, error: 'Too many questions. Please wait a minute and try again.' },
});

function todayKeyIST(): string {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface QuotaIdentity {
  key: string; // storage key prefix: "uid:<uid>" or "ip:<hash>"
  kind: 'uid' | 'ip';
  isAdmin: boolean;
}

function quotaIdentityFor(req: express.Request): QuotaIdentity {
  const u = (req as any).user;
  const isAdmin = !!u && (u.uid === 'admin' || u.isAdmin === true);
  if (u && typeof u.uid === 'string' && u.uid && u.uid !== 'guest' && u.isAnonymous !== true) {
    // Never put raw uid quirks into a filename-safe key — hash it.
    const uidHash = crypto.createHash('sha256').update(u.uid).digest('hex').slice(0, 16);
    return { key: `uid:${uidHash}`, kind: 'uid', isAdmin };
  }
  // Anonymous: hash the IP — never store or log the raw IP.
  const ip = getSanitizedClientIp(req);
  const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
  return { key: `ip:${ipHash}`, kind: 'ip', isAdmin };
}

function readUsage(): Record<string, number> {
  return readLocalJson<Record<string, number>>(FAQ_USAGE_FILE, {});
}

function remainingFor(ident: QuotaIdentity): number {
  if (ident.isAdmin) return FAQ_AI_DAILY_LIMIT;
  const usage = readUsage();
  const used = usage[`${ident.key}:${todayKeyIST()}`] || 0;
  return Math.max(0, FAQ_AI_DAILY_LIMIT - used);
}

function consumeQuota(ident: QuotaIdentity): number {
  if (ident.isAdmin) return FAQ_AI_DAILY_LIMIT;
  const usage = readUsage();
  const k = `${ident.key}:${todayKeyIST()}`;
  usage[k] = (usage[k] || 0) + 1;
  // Prune keys older than 2 days so the file can't grow unbounded.
  const today = todayKeyIST();
  for (const key of Object.keys(usage)) {
    const datePart = key.slice(-10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && datePart < today) {
      // keep yesterday (midnight-boundary races), drop anything older
      const d = new Date(datePart + 'T00:00:00+05:30').getTime();
      if (Date.now() - d > 2 * 24 * 3600 * 1000) delete usage[key];
    }
  }
  writeLocalJson(FAQ_USAGE_FILE, usage);
  return Math.max(0, FAQ_AI_DAILY_LIMIT - usage[k]);
}

interface FaqQuestionLog {
  q: string; // truncated question, no PII beyond what the visitor typed
  source: 'bank' | 'ai';
  ts: number;
}

/** Anonymized log — no IP, no uid — for promoting real questions into the bank. */
function logQuestion(q: string, source: 'bank' | 'ai'): void {
  try {
    const log = readLocalJson<FaqQuestionLog[]>(FAQ_QUESTIONS_FILE, []);
    log.push({ q: q.slice(0, MAX_QUESTION_LEN), source, ts: Date.now() });
    while (log.length > MAX_LOG_ENTRIES) log.shift();
    writeLocalJson(FAQ_QUESTIONS_FILE, log);
  } catch {
    // Logging must never break answering.
  }
}

faqRouter.post('/ask', faqFloodLimiter, async (req, res) => {
  try {
    const raw = (req.body as any)?.question;
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      return res.status(400).json({ success: false, error: 'Question cannot be empty.' });
    }
    const question = raw.trim().slice(0, MAX_QUESTION_LEN);
    if (question.length < 3) {
      return res.status(400).json({ success: false, error: 'Please ask a slightly longer question.' });
    }

    const ident = quotaIdentityFor(req);
    const remaining = remainingFor(ident);

    // Layer 1: curated bank — zero AI cost, quota untouched.
    const bankHit = findBankAnswer(question);
    if (bankHit) {
      logQuestion(question, 'bank');
      return res.json({
        success: true,
        answer: bankHit.answer,
        source: 'bank' as const,
        remaining,
        dailyLimit: FAQ_AI_DAILY_LIMIT,
      });
    }

    // Layer 2+3: AI fallback behind the server-side daily quota.
    if (remaining <= 0) {
      const loginRequired = ident.kind === 'ip';
      return res.status(429).json({
        success: false,
        error: loginRequired
          ? 'You have used today\u2019s free questions. Log in to ask more.'
          : 'You have used today\u2019s free questions. Please come back tomorrow.',
        loginRequired,
        remaining: 0,
        dailyLimit: FAQ_AI_DAILY_LIMIT,
      });
    }

    try {
      const answer = await askPublicFaq(question);
      const left = consumeQuota(ident);
      logQuestion(question, 'ai');
      return res.json({
        success: true,
        answer,
        source: 'ai' as const,
        remaining: left,
        dailyLimit: FAQ_AI_DAILY_LIMIT,
      });
    } catch {
      // Upstream failure: friendly 503, quota NOT consumed — the visitor
      // shouldn't lose a question because our AI provider hiccuped.
      return res.status(503).json({
        success: false,
        error: 'The AI is busy right now. Please try again in a few moments.',
        remaining,
        dailyLimit: FAQ_AI_DAILY_LIMIT,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

/** Lets the client render "N of 4 left" before the first question. */
faqRouter.get('/status', faqFloodLimiter, (req, res) => {
  const ident = quotaIdentityFor(req);
  res.json({
    success: true,
    remaining: remainingFor(ident),
    dailyLimit: FAQ_AI_DAILY_LIMIT,
    bankSize: faqBankSize(),
  });
});
