/**
 * Cashfree Payment Gateway integration — one-time Pro payments.
 *
 * Design notes (26 Sep 2026):
 * - Amount is ALWAYS decided server-side (PRO_PLANS). The client never sends a price.
 * - The payment Session ID goes to the client; the SECRET KEY never leaves the server.
 * - Source of truth = Cashfree Orders API (verify endpoint + webhook both re-fetch
 *   the order from Cashfree before granting Pro). Frontend callbacks are never trusted.
 * - Auto-renew / subscriptions are NOT built yet (needs RBI e-mandate approval) —
 *   the UI marks them "Coming soon". This module only sells one-time packs
 *   (7 / 30 / 180 / 365 days).
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
  pro_weekly: {
    id: 'pro_weekly',
    label: 'Pro Weekly',
    amountPaise: 5900, // ₹59
    currency: 'INR',
    validityDays: 7,
  },
  pro_monthly: {
    id: 'pro_monthly',
    label: 'Pro Monthly',
    amountPaise: 19900, // ₹199
    currency: 'INR',
    validityDays: 30,
  },
  pro_halfyearly: {
    id: 'pro_halfyearly',
    label: 'Pro 6-Month',
    amountPaise: 99900, // ₹999
    currency: 'INR',
    validityDays: 180,
  },
  pro_yearly: {
    id: 'pro_yearly',
    label: 'Pro Yearly',
    amountPaise: 179900, // ₹1,799
    currency: 'INR',
    validityDays: 365,
  },
} as const;

export type PlanId = keyof typeof PRO_PLANS;

/**
 * The selected plan is encoded in the order id (BN_<code>_...) so that
 * verify and the webhook can grant the correct validity WITHOUT trusting
 * any client-supplied plan. Orders created before plan codes existed
 * (BN_<cust>_<ts>) fall back to pro_monthly.
 */
const PLAN_CODES: Record<PlanId, string> = {
  pro_weekly: 'W',
  pro_monthly: 'M',
  pro_halfyearly: 'H',
  pro_yearly: 'Y',
};
const CODE_TO_PLAN: Record<string, PlanId> = {
  W: 'pro_weekly',
  M: 'pro_monthly',
  H: 'pro_halfyearly',
  Y: 'pro_yearly',
};

export function planIdFromOrderId(orderId: string): PlanId {
  const m = /^BN_([WMHY])_/.exec(orderId || '');
  const pid = m ? CODE_TO_PLAN[m[1]] : undefined;
  return pid && (PRO_PLANS as Record<string, unknown>)[pid] ? pid : 'pro_monthly';
}

/**
 * Best-effort human label for the instrument that paid
 * (e.g. "UPI", "Visa Credit Card", "HDFC Netbanking").
 * Display-only — never includes PII like card numbers or UPI ids.
 */
function describePaymentMethod(p: any): string {
  try {
    const pm = p?.payment_method || {};
    if (pm.upi) return 'UPI';
    const card = pm.card || {};
    if (card && (card.card_network || card.card_type)) {
      const net = String(card.card_network || '').trim();
      const t = String(card.card_type || '').toLowerCase();
      const kind = t.includes('credit') ? 'Credit Card' : t.includes('debit') ? 'Debit Card' : 'Card';
      return net ? `${net} ${kind}` : kind;
    }
    const nb = pm.netbanking || {};
    if (nb && Object.keys(nb).length) {
      const bank = String(nb.netbanking_bank_name || '').trim();
      return bank ? `${bank} Netbanking` : 'Netbanking';
    }
    if (pm.wallet) return 'Wallet';
    if (pm.emi) return 'EMI';
    if (pm.paylater) return 'Pay Later';
  } catch { /* ignore */ }
  return '';
}

interface CashfreeConfig {
  appId: string;
  secret: string;
  base: string;
  mode: 'sandbox' | 'production';
  apiVersion: string;
}

function getCashfreeConfig(): CashfreeConfig {
  const appId = (
    process.env.CASHFREE_APP_ID ||
    process.env.CASHFREE_CLIENT_ID ||
    process.env.CASHFREE_KEY_ID ||
    process.env.CASHFREE_API_KEY ||
    process.env.CASHFREE_KEY ||
    process.env.CASHFREE_APPID ||
    process.env.CASHFREE_ID ||
    process.env.CASHFREE_SANDBOX_APP_ID ||
    process.env.CASHFREE_PROD_APP_ID ||
    process.env.CASHFREE_APP ||
    ''
  ).trim();

  const secret = (
    process.env.CASHFREE_SECRET_KEY ||
    process.env.CASHFREE_CLIENT_SECRET ||
    process.env.CASHFREE_KEY_SECRET ||
    process.env.CASHFREE_API_SECRET ||
    process.env.CASHFREE_SECRET ||
    process.env.CASHFREE_SECRETKEY ||
    process.env.CASHFREE_SANDBOX_SECRET_KEY ||
    process.env.CASHFREE_PROD_SECRET_KEY ||
    ''
  ).trim();

  const envRaw = (
    process.env.CASHFREE_ENV ||
    process.env.CASHFREE_ENVIRONMENT ||
    process.env.CASHFREE_MODE ||
    ''
  ).toLowerCase().trim();

  const apiVersion = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();

  let mode: 'sandbox' | 'production' = 'sandbox';
  if (envRaw === 'production' || envRaw === 'prod' || envRaw === 'live') {
    mode = 'production';
  } else if (envRaw === 'sandbox' || envRaw === 'test' || envRaw === 'dev') {
    mode = 'sandbox';
  } else if (appId.toUpperCase().startsWith('TEST')) {
    mode = 'sandbox';
  } else if (appId.length > 5 && !appId.toUpperCase().startsWith('TEST')) {
    mode = 'production';
  }

  const base = mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  return { appId, secret, base, mode, apiVersion };
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${cfg.base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': cfg.apiVersion,
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
    console.error('[Payments] Cashfree network error:', err?.message || err);
    return { ok: false, status: 0, data: { message: err?.message || 'Network connection to payment gateway failed' } };
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
    const cfg = getCashfreeConfig();
    if (!isConfigured()) {
      const hasApp = Boolean(cfg.appId);
      const hasSecret = Boolean(cfg.secret);
      return res.status(200).json({
        success: false,
        error: `Cashfree credentials missing in Secrets (App ID: ${hasApp ? 'Found' : 'Missing'}, Secret Key: ${hasSecret ? 'Found' : 'Missing'}). Please ensure secret names match CASHFREE_APP_ID and CASHFREE_SECRET_KEY.`,
      });
    }
    const uid = getReqUserId(req);
    const planId = (req.body?.planId || 'pro_monthly') as string;
    const plan = (PRO_PLANS as Record<string, (typeof PRO_PLANS)[PlanId]>)[planId];
    if (!plan) {
      return res.status(200).json({ success: false, error: 'Unknown plan selected.' });
    }

    const profile = await withTimeout(getUserProfile(uid), 8000);
    const email = (req as any).user?.email || profile?.email || '';
    if (!email) {
      return res.status(200).json({ success: false, error: 'A verified email is required for payment receipts. Please check your account.' });
    }

    // Cashfree customer_id: alphanumeric, min 3 chars, max 50 chars
    const cleanCustomerId = (uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 45) || 'usr_' + Date.now());

    // Cashfree customer_phone: 10 digits required by Cashfree PG
    const rawPhone = String(req.body?.phone || (profile as any)?.phone || '9876543210').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '9876543210';

    // Unique, traceable order id — the plan code lets verify/webhook
    // grant the right validity without trusting the client.
    const orderId = `BN_${PLAN_CODES[plan.id as PlanId]}_${cleanCustomerId.slice(0, 10)}_${Date.now()}`;
    const base = siteUrl(req);

    const { ok, status, data, timedOut } = await cashfreeFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        order_amount: plan.amountPaise / 100,
        order_currency: plan.currency,
        customer_details: {
          customer_id: cleanCustomerId,
          customer_email: email,
          customer_phone: cleanPhone,
        },
        order_meta: {
          return_url: `${base}/?cf_order_id=${orderId}`,
          notify_url: `${base}/api/payments/webhook`,
        },
        order_note: `${plan.label} — BSE Nexus`,
      }),
    });

    if (!ok || !data?.payment_session_id) {
      console.error('[Payments] create-order failed:', status, 'mode=', cfg.mode, JSON.stringify(data)?.slice(0, 500));
      if (timedOut) {
        return res.status(200).json({ success: false, error: 'Payment gateway timed out. Please try again.' });
      }

      const cfMessage = data?.message || data?.error_description || data?.description || data?.error;
      if (status === 401 || status === 403) {
        return res.status(200).json({
          success: false,
          error: `Cashfree authentication failed (mode: ${cfg.mode}). Please verify your App ID & Secret Key in Cashfree Dashboard.`,
        });
      }

      if (cfMessage) {
        return res.status(200).json({
          success: false,
          error: `Cashfree: ${cfMessage}`,
        });
      }

      return res.status(200).json({
        success: false,
        error: `Could not initiate payment (${status || 'gateway error'}). Please check Cashfree API settings.`,
      });
    }

    res.json({
      success: true,
      orderId,
      paymentSessionId: data.payment_session_id,
      mode: cfg.mode,
      amount: plan.amountPaise / 100,
      currency: plan.currency,
    });
  } catch (err: any) {
    console.error('[Payments] create-order error:', err?.message || err);
    res.status(200).json({ success: false, error: 'Could not start payment: ' + (err?.message || 'unexpected error') });
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
      return res.status(200).json({ success: false, error: 'Missing order_id.' });
    }

    const order = await fetchOrderFromCashfree(orderId);
    if (!order) {
      return res.status(200).json({ success: false, paid: false, error: 'Could not confirm payment status from gateway.' });
    }

    const orderCustomer = order?.customer_details?.customer_id || '';
    const cleanCustomerId = (uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 45));
    if (orderCustomer && orderCustomer !== cleanCustomerId && orderCustomer !== uid) {
      return res.status(200).json({ success: false, paid: false, error: 'Order does not match this account session.' });
    }

    if (order.order_status === 'PAID') {
      // The plan comes from the order id WE generated (never the client).
      // The paid amount + currency must match that plan exactly, else fail closed.
      const planId = planIdFromOrderId(orderId);
      const plan = PRO_PLANS[planId];
      const paidAmount = Number(order.order_amount);
      const paidCurrency = String(order.order_currency || '');
      if (paidAmount !== plan.amountPaise / 100 || paidCurrency !== plan.currency) {
        console.warn('[Payments] verify amount mismatch:', orderId, paidAmount, paidCurrency, 'expected', plan.id);
        return res.status(200).json({ success: false, paid: false, error: 'Payment amount does not match the selected plan.' });
      }
      const { proExpiresAt, alreadyGranted } = await grantProForOrder(uid, orderId, planId);
      // Best-effort: which instrument paid (UPI / card / netbanking) for the
      // invoice. Display-only, never PII — and never fails the verify.
      let paymentMethod = '';
      try {
        const payRes = await cashfreeFetch(`/orders/${encodeURIComponent(orderId)}/payments`);
        const list = Array.isArray(payRes?.data) ? payRes.data : [];
        const okPay =
          list.find((p: any) => String(p?.payment_status || '').toUpperCase() === 'SUCCESS') ||
          list[0];
        paymentMethod = describePaymentMethod(okPay);
      } catch { /* ignore — receipt works without it */ }
      const receipt = {
        orderId,
        amount: paidAmount,
        currency: paidCurrency,
        paidAt: String(order.created_at || new Date().toISOString()),
        email: String(order?.customer_details?.customer_email || ''),
        validUntil: proExpiresAt,
        planId: plan.id,
        planLabel: plan.label,
        validityDays: plan.validityDays,
        paymentMethod,
      };
      return res.json({ success: true, paid: true, alreadyGranted, proExpiresAt, orderId, receipt });
    }

    return res.json({ success: true, paid: false, orderStatus: order.order_status, orderId });
  } catch (err: any) {
    console.error('[Payments] verify error:', err?.message || err);
    res.status(200).json({ success: false, paid: false, error: 'Verification error: ' + (err?.message || 'unknown') });
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
      plans: Object.values(PRO_PLANS),
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
      const planId = planIdFromOrderId(orderId);
      const plan = PRO_PLANS[planId];
      const amountOk = Number(order?.order_amount) === plan.amountPaise / 100;
      const currencyOk = String(order?.order_currency || '') === plan.currency;
      if (order?.order_status === 'PAID' && rawUid && amountOk && currencyOk) {
        const uid = sanitizeUserId(rawUid);
        const { alreadyGranted } = await grantProForOrder(uid, orderId, planId);
        console.log(`[Payments] webhook granted Pro: uid=${uid} order=${orderId} plan=${planId} already=${alreadyGranted}`);
      } else {
        console.warn('[Payments] webhook skipped: order not PAID / amount mismatch / no customer_id', orderId);
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
