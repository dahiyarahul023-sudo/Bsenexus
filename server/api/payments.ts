/**
 * Cashfree Payment Gateway integration — one-time Pro payments.
 *
 * Design notes (26 Sep 2026):
 * - Amount is ALWAYS decided server-side (PRO_PLANS). The client never sends a price.
 * - The payment Session ID goes to the client; the SECRET KEY never leaves the server.
 * - Source of truth = Cashfree Orders API (verify endpoint + webhook both re-fetch
 *   the order from Cashfree before granting Pro). Frontend callbacks are never trusted.
 * - Auto-renew / subscriptions are NOT built yet (needs RBI e-mandate approval) —
 *   the UI marks them "Coming soon". This module only sells 30-day one-time packs.
 */
import express from 'express';
import crypto from 'crypto';
import { requireAuth } from '../security/auth.js';
import { getUserProfile, saveUserProfile, invalidateUserProfileCache } from '../database/usersDao.js';
import { sanitizeUserId } from '../database/watchlistDao.js';

/** Extract the verified uid from the authenticated request (local copy — avoids a routes.ts import cycle). */
function getReqUserId(req: express.Request): string {
  const user = (req as any).user;
  if (user && user.uid && user.uid !== 'guest') {
    return sanitizeUserId(user.uid);
  }
  return 'guest';
}

/**
 * Race a promise against a timeout. A stalled Firestore read must never
 * leave the client hanging until Cloudflare returns an HTML 502 — the
 * caller gets null and can fall back / respond with controlled JSON.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export const paymentsRouter = express.Router();

// ---------------------------------------------------------------------------
// Plan catalogue — single source of truth for sellable plans.
// amountPaise is in the smallest currency unit. validityDays = Pro duration.
// ---------------------------------------------------------------------------
export const PRO_PLANS = {
  pro_monthly: {
    id: 'pro_monthly',
    label: 'Pro Monthly',
    amountPaise: 19900, // ₹199
    currency: 'INR',
    validityDays: 30,
  },
} as const;

export type PlanId = keyof typeof PRO_PLANS;

interface CashfreeConfig {
  appId: string;
  secret: string;
  base: string;
  mode: 'sandbox' | 'production';
}

function getCashfreeConfig(): CashfreeConfig {
  // Trim: copy-pasted keys often carry a trailing newline/space, which makes
  // Node's fetch throw on the x-client-* headers.
  const appId = (process.env.CASHFREE_APP_ID || '').trim();
  const secret = (process.env.CASHFREE_SECRET_KEY || '').trim();
  const env = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase().trim();
  const mode: 'sandbox' | 'production' = env === 'production' ? 'production' : 'sandbox';
  const base = mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  return { appId, secret, base, mode };
}

function isConfigured(): boolean {
  const c = getCashfreeConfig();
  return Boolean(c.appId && c.secret);
}

function siteUrl(req: express.Request): string {
  const envUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  if (envUrl) return envUrl;
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'bsenexus.in';
  return `${proto}://${host}`;
}

async function cashfreeFetch(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any; timedOut?: boolean }> {
  const cfg = getCashfreeConfig();
  // A hung gateway call must NEVER hang our request until the platform kills
  // it (that surfaces as a non-JSON 502 from the edge). Fail fast instead.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${cfg.base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-10-01',
        'x-client-id': cfg.appId,
        'x-client-secret': cfg.secret,
        ...(init.headers || {}),
      },
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, status: 0, data: null, timedOut: true };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the authoritative order state from Cashfree. Never trust client callbacks. */
async function fetchOrderFromCashfree(orderId: string): Promise<any | null> {
  try {
    const { ok, data } = await cashfreeFetch(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
    if (!ok || !data) return null;
    return data;
  } catch (err) {
    console.error('[Payments] Cashfree order fetch failed:', (err as Error)?.message || err);
    return null;
  }
}

/**
 * Grant (or extend) Pro on the user's server-side profile.
 * Idempotent per order: the same order_id never grants twice.
 *
 * The per-order in-memory lock serializes concurrent grants for the same
 * order (e.g. return-URL verify racing the Cashfree webhook) so a single
 * payment can never extend Pro twice on one instance.
 */
const grantLocks = new Map<string, Promise<{ proExpiresAt: number; alreadyGranted: boolean }>>();

async function grantProForOrder(
  uid: string,
  orderId: string,
  planId: PlanId,
): Promise<{ proExpiresAt: number; alreadyGranted: boolean }> {
  const inFlight = grantLocks.get(orderId);
  if (inFlight) {
    const r = await inFlight;
    return { proExpiresAt: r.proExpiresAt, alreadyGranted: true };
  }
  const p = doGrantProForOrder(uid, orderId, planId);
  grantLocks.set(orderId, p);
  try {
    return await p;
  } finally {
    grantLocks.delete(orderId);
  }
}

async function doGrantProForOrder(uid: string, orderId: string, planId: PlanId): Promise<{ proExpiresAt: number; alreadyGranted: boolean }> {
  const plan = PRO_PLANS[planId];
  const now = Date.now();
  const existing = await getUserProfile(uid);

  if (existing?.lastOrderId === orderId && existing?.tier === 'pro') {
    return { proExpiresAt: existing.proExpiresAt || now, alreadyGranted: true };
  }

  const base = Math.max(now, existing?.proExpiresAt || 0);
  const proExpiresAt = base + plan.validityDays * 24 * 60 * 60 * 1000;

  await saveUserProfile(uid, {
    tier: 'pro',
    proExpiresAt,
    maxWatchlistStocks: 9999,
    proPlanId: plan.id,
    lastPaymentAt: now,
    lastOrderId: orderId,
  } as any);
  invalidateUserProfileCache(uid);

  return { proExpiresAt, alreadyGranted: false };
}

// ---------------------------------------------------------------------------
// POST /api/payments/create-order — authenticated user starts a purchase.
// Body: { planId }. Returns a Cashfree payment_session_id for the JS checkout.
// ---------------------------------------------------------------------------
paymentsRouter.post('/create-order', requireAuth, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, error: 'Payments are not configured yet. Please try again later.' });
    }
    const uid = getReqUserId(req);
    const planId = (req.body?.planId || 'pro_monthly') as string;
    const plan = (PRO_PLANS as Record<string, (typeof PRO_PLANS)[PlanId]>)[planId];
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Unknown plan.' });
    }

    // Firestore can stall (quota / network) with no timeout of its own — never
    // let it hang the payment request into an HTML 502. Fall back to the
    // JWT email when the profile read times out.
    const profile = await withTimeout(getUserProfile(uid), 8000);
    const email = (req as any).user?.email || profile?.email || '';
    if (!email) {
      return res.status(400).json({ success: false, error: 'A verified email is required for payment receipts.' });
    }

    // Unique, traceable order id. customer_id carries the uid for webhook mapping.
    const orderId = `BN_${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}_${Date.now()}`;
    const base = siteUrl(req);

    const { ok, status, data, timedOut } = await cashfreeFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        order_amount: plan.amountPaise / 100,
        order_currency: plan.currency,
        customer_details: {
          customer_id: uid,
          customer_email: email,
        },
        order_meta: {
          // Cashfree returns here after payment. The React app boots on "/"
          // and verifies ?cf_order_id=... with our server (source of truth).
          return_url: `${base}/?cf_order_id=${orderId}`,
          notify_url: `${base}/api/payments/webhook`,
        },
        order_note: `${plan.label} — BSE Nexus`,
      }),
    });

    if (!ok || !data?.payment_session_id) {
      console.error('[Payments] create-order failed:', status, 'mode=', getCashfreeConfig().mode, JSON.stringify(data)?.slice(0, 500));
      if (timedOut) {
        return res.status(502).json({ success: false, error: 'Payment gateway is not responding. Please try again in a minute.' });
      }
      if (status === 401 || status === 403) {
        // Keys are set but Cashfree rejected them: wrong env (sandbox vs
        // production) or wrong/whitespace-padded key pair.
        return res.status(502).json({ success: false, error: 'Payment gateway rejected our credentials. The site owner needs to check the Cashfree keys.' });
      }
      return res.status(502).json({ success: false, error: 'Could not start the payment. Please try again.' });
    }

    res.json({
      success: true,
      orderId,
      paymentSessionId: data.payment_session_id,
      mode: getCashfreeConfig().mode,
      amount: plan.amountPaise / 100,
      currency: plan.currency,
    });
  } catch (err: any) {
    console.error('[Payments] create-order error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Could not start the payment. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/verify?order_id=... — after Cashfree redirects back.
// Re-checks the order with Cashfree (source of truth) and grants Pro if PAID.
// ---------------------------------------------------------------------------
paymentsRouter.get('/verify', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const orderId = String(req.query.order_id || '').trim();
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing order_id.' });
    }

    const order = await fetchOrderFromCashfree(orderId);
    if (!order) {
      return res.status(502).json({ success: false, paid: false, error: 'Could not confirm the payment status. Please try again.' });
    }

    // Security: the order must belong to this user. Strict: a missing
    // customer_id is treated as "not yours" — never as a pass.
    const orderCustomer = order?.customer_details?.customer_id || '';
    if (!orderCustomer || orderCustomer !== uid) {
      return res.status(403).json({ success: false, paid: false, error: 'Order does not belong to this account.' });
    }

    if (order.order_status === 'PAID') {
      const { proExpiresAt, alreadyGranted } = await grantProForOrder(uid, orderId, 'pro_monthly');
      // Receipt data for the success screen + "send receipt to email".
      // Amount/currency/date come from Cashfree (source of truth).
      const receipt = {
        orderId,
        amount: Number(order.order_amount ?? PRO_PLANS.pro_monthly.amountPaise / 100),
        currency: String(order.order_currency || PRO_PLANS.pro_monthly.currency),
        paidAt: String(order.created_at || new Date().toISOString()),
        email: String(order?.customer_details?.customer_email || ''),
        validUntil: proExpiresAt,
      };
      return res.json({ success: true, paid: true, alreadyGranted, proExpiresAt, orderId, receipt });
    }

    return res.json({ success: true, paid: false, orderStatus: order.order_status, orderId });
  } catch (err: any) {
    console.error('[Payments] verify error:', err?.message || err);
    res.status(500).json({ success: false, paid: false, error: 'Verification failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/status — Pro state + catalogue for the Settings UI.
// ---------------------------------------------------------------------------
paymentsRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const profile = await getUserProfile(uid);
    const now = Date.now();
    const proExpiresAt = profile?.proExpiresAt || 0;
    res.json({
      success: true,
      configured: isConfigured(),
      isPro: (profile?.tier === 'pro' || (profile as any)?.isAdmin) && proExpiresAt > now,
      proExpiresAt,
      plan: PRO_PLANS.pro_monthly,
      lastPaymentAt: (profile as any)?.lastPaymentAt || null,
      lastOrderId: (profile as any)?.lastOrderId || null,
      // Auto-renew needs RBI e-mandate approval — not available yet.
      autoRenew: 'coming_soon' as const,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Could not load subscription status.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/webhook — Cashfree server-to-server notification.
// NOTE: this route MUST receive the raw body (see server.ts) because the
// signature is computed over timestamp + raw JSON bytes.
// ---------------------------------------------------------------------------
paymentsRouter.post('/webhook', async (req, res) => {
  // Acknowledge fast; Cashfree retries on non-2xx.
  try {
    if (!isConfigured()) {
      return res.status(200).json({ ok: false, reason: 'not-configured' });
    }
    const cfg = getCashfreeConfig();
    const rawBody: string = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    const signature = String(req.headers['x-webhook-signature'] || '');
    const timestamp = String(req.headers['x-webhook-timestamp'] || '');

    if (!signature || !timestamp) {
      console.warn('[Payments] webhook missing signature headers');
      return res.status(200).json({ ok: false, reason: 'no-signature' });
    }

    const expectedBase64 = crypto.createHmac('sha256', cfg.secret).update(timestamp + rawBody).digest('base64');
    const expectedHex = crypto.createHmac('sha256', cfg.secret).update(timestamp + rawBody).digest('hex');
    const valid = signature === expectedBase64 || signature === expectedHex;
    if (!valid) {
      console.warn('[Payments] webhook signature mismatch');
      return res.status(200).json({ ok: false, reason: 'bad-signature' });
    }

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(200).json({ ok: false, reason: 'bad-json' });
    }

    const eventType = String(payload?.type || '');
    const orderId: string = payload?.data?.order?.order_id || '';
    const paymentStatus: string = payload?.data?.payment?.payment_status || '';
    if (!orderId) {
      return res.status(200).json({ ok: false, reason: 'no-order' });
    }

    // Only act on successful payments, and always re-confirm with Cashfree.
    // The uid comes ONLY from the re-fetched order (source of truth) —
    // never from the webhook payload — and is sanitized like every auth uid.
    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && paymentStatus === 'SUCCESS') {
      const order = await fetchOrderFromCashfree(orderId);
      const rawUid: string = order?.customer_details?.customer_id || '';
      if (order?.order_status === 'PAID' && rawUid) {
        const uid = sanitizeUserId(rawUid);
        const { alreadyGranted } = await grantProForOrder(uid, orderId, 'pro_monthly');
        console.log(`[Payments] webhook granted Pro: uid=${uid} order=${orderId} already=${alreadyGranted}`);
      } else {
        console.warn('[Payments] webhook skipped: order not PAID or no customer_id', orderId);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[Payments] webhook error:', err?.message || err);
    // Still 200 — Cashfree will retry; our grant is idempotent.
    return res.status(200).json({ ok: false, reason: 'error' });
  }
});

export default paymentsRouter;
