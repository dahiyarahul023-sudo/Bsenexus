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
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../security/auth.js';
import { getUserProfile, invalidateUserProfileCache } from '../database/usersDao.js';
import { sanitizeUserId } from '../database/watchlistDao.js';
import {
  recordPendingOrder,
  getPendingOrdersForUser,
  getGrantedOrdersForUser,
  markOrderFailed,
} from '../database/paymentOrdersDao.js';
import {
  grantPaymentAtomically,
  reconcilePaymentEntitlement,
} from '../database/paymentEntitlementsDao.js';
import {
  isPaymentOrderOwnershipError,
  isPaymentStoreUnavailable,
} from '../database/paymentStore.js';
import {
  isFirestoreQuotaExceeded,
  isAdminPermissionDenied,
} from '../database/localStore.js';

/** Extract the verified uid from the authenticated request (local copy — avoids a routes.ts import cycle). */
function getReqUserId(req: express.Request): string {
  const user = (req as any).user;
  if (user && user.uid && user.uid !== 'guest') {
    return sanitizeUserId(user.uid);
  }
  return 'guest';
}

export const paymentsRouter = express.Router();

// ---------------------------------------------------------------------------
// Strict rate limit for the recovery endpoints below (/recover, /claim).
// Each call fans out to the Cashfree Orders API, so abuse here would burn
// gateway quota. 10 attempts per minute per IP is plenty for genuine use.
// ---------------------------------------------------------------------------
const paymentRecoveryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false, default: true },
  message: { success: false, error: 'Too many recovery attempts. Please wait a minute and try again.' },
});

// Plan catalogue — moved to server/config/plans.ts (single source of truth
// for what is charged; zero imports so tests can import it safely).
import { PRO_PLANS, type PlanId } from '../config/plans.js';

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

/** Parse Cashfree's order creation timestamp for receipt/history display. */
function paidAtFromCashfree(order: any): number {
  const parsed = Date.parse(String(order?.created_at || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/**
 * True successful-payment time from Cashfree's order payments API.
 * Prefers the SUCCESS payment's payment_completion_time (per official
 * Cashfree docs), falls back to payment_time, then to the order's
 * created_at (checkout creation — not the payment moment).
 */
async function fetchSuccessfulPaymentTime(orderId: string, order: any): Promise<number> {
  try {
    const payRes = await cashfreeFetch(`/orders/${encodeURIComponent(orderId)}/payments`);
    const list = Array.isArray(payRes?.data) ? payRes.data : [];
    const okPay = list.find((p: any) => String(p?.payment_status || '').toUpperCase() === 'SUCCESS') || list[0];
    const ts = String(okPay?.payment_completion_time || okPay?.payment_time || '');
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) return parsed;
  } catch {
    // fall through to order created_at
  }
  return paidAtFromCashfree(order);
}

/**
 * Grant Pro through the dedicated payment-entitlement transaction.
 *
 * Every grant path — webhook, return-URL verify, login recovery, manual
 * claim — funnels through grantPaymentAtomically(), which commits the
 * ledger order, payment_entitlements/<uid>, and the users/<uid> mirror in
 * ONE Firestore transaction. There is no local-JSON payment fallback: if
 * Firestore cannot confirm the grant, this throws and the caller returns
 * a retriable unavailable state instead of a false "granted" response.
 */
async function grantWithLedger(
  uid: string,
  orderId: string,
  planId: PlanId,
  source: 'webhook' | 'verify' | 'recover' | 'claim',
  orderMeta?: { email?: string; amountPaise?: number; currency?: string; paidAt?: number },
): Promise<{ proExpiresAt: number; alreadyGranted: boolean }> {
  const plan = PRO_PLANS[planId];
  const r = await grantPaymentAtomically({
    orderId,
    uid,
    email: orderMeta?.email || '',
    planId,
    validityDays: plan.validityDays,
    amountPaise: orderMeta?.amountPaise ?? plan.amountPaise,
    currency: orderMeta?.currency || plan.currency,
    paidAt: orderMeta?.paidAt,
    grantSource: source,
  });
  invalidateUserProfileCache(uid);
  console.log(
    `[Payments] payment grant ${r.alreadyGranted ? 'already-granted' : 'granted'}: uid=${uid} order=${orderId} plan=${planId} source=${source} proExpiresAt=${r.proExpiresAt}`,
  );
  return { proExpiresAt: r.proExpiresAt, alreadyGranted: r.alreadyGranted };
}

function paymentUnavailable(res: express.Response, message: string) {
  return res.status(503).json({
    success: false,
    unavailable: true,
    error: message,
  });
}

/** Build the invoice payload shared by verify and claim responses.
 *  The receipt date must be the actual payment moment (Cashfree
 *  `payment_completion_time`), not the checkout/order `created_at`. The
 *  caller resolves the real paid time via fetchSuccessfulPaymentTime(). */
function buildReceipt(order: any, orderId: string, plan: (typeof PRO_PLANS)[PlanId], proExpiresAt: number, paymentMethod: string, paidAtMs?: number) {
  return {
    orderId,
    amount: Number(order.order_amount),
    currency: String(order.order_currency || plan.currency),
    paidAt: typeof paidAtMs === 'number' && paidAtMs > 0 ? new Date(paidAtMs).toISOString() : String(order.created_at || new Date().toISOString()),
    email: String(order?.customer_details?.customer_email || ''),
    validUntil: proExpiresAt,
    planId: plan.id,
    planLabel: plan.label,
    validityDays: plan.validityDays,
    paymentMethod,
  };
}

/** Best-effort lookup of the successful payment's instrument (UPI/card/netbanking). Display-only. */
async function describeSuccessfulPayment(orderId: string): Promise<string> {
  try {
    const payRes = await cashfreeFetch(`/orders/${encodeURIComponent(orderId)}/payments`);
    const list = Array.isArray(payRes?.data) ? payRes.data : [];
    const okPay =
      list.find((p: any) => String(p?.payment_status || '').toUpperCase() === 'SUCCESS') ||
      list[0];
    return describePaymentMethod(okPay);
  } catch {
    return '';
  }
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

    // Checkout only starts when the durable profile/payment path is
    // readable. If storage is unavailable, create no Cashfree order at all.
    const profile = await getUserProfile(uid, { durable: true });
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

    if (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) {
      return paymentUnavailable(
        res,
        'Secure payment setup is temporarily unavailable. Please try again in a moment.',
      );
    }

    // Payment isolation: the durable Firestore reconciliation record must
    // exist BEFORE Cashfree checkout starts. If it cannot be confirmed,
    // do not take the user to payment — otherwise a paid gateway order
    // could exist with no server-owned trail to recover it automatically.
    try {
      await recordPendingOrder({
        orderId,
        uid,
        email,
        planId: plan.id,
        amountPaise: plan.amountPaise,
        currency: plan.currency,
      });
    } catch (ledgerErr: any) {
      console.error('[Payments] durable pending-order write failed; checkout blocked:', ledgerErr?.message || ledgerErr);
      return paymentUnavailable(
        res,
        'Secure payment setup is temporarily unavailable. Please try again in a moment.',
      );
    }

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
      await markOrderFailed(orderId, `create-order failed (${status || 'gateway error'})`).catch((e: any) => console.warn('[Payments] markOrderFailed failed:', orderId, e?.message || e));
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
    if (isPaymentStoreUnavailable(err)) {
      console.warn('[Payments] create-order: payment store unavailable:', err?.message || err);
      return paymentUnavailable(
        res,
        'Payments are temporarily unavailable. Please retry in a moment; no payment was started.',
      );
    }
    console.error('[Payments] create-order error:', err?.message || err);
    return res.status(200).json({ success: false, error: 'Could not start payment: ' + (err?.message || 'unexpected error') });
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
      // BUGFIX (1 Oct 2026 audit LOGIC-026 + LOGIC-027): Amount comparison was
      // using float arithmetic (Number(amount) !== paise/100) which can fail for
      // non-integer rupees due to IEEE 754 representation. Currency comparison
      // was case-sensitive with no trim — 'inr' or ' INR ' would fail. Now:
      // (a) amount compared in integer paise, (b) currency trimmed + uppercased.
      const paidAmountPaise = Math.round(Number(order.order_amount) * 100);
      const paidCurrency = String(order.order_currency || '').trim().toUpperCase();
      if (paidAmountPaise !== plan.amountPaise || paidCurrency !== plan.currency.toUpperCase()) {
        console.warn('[Payments] verify amount mismatch:', orderId, paidAmountPaise, paidCurrency, 'expected', plan.id);
        return res.status(200).json({ success: false, paid: false, error: 'Payment amount does not match the selected plan.' });
      }
      const paidAtMs = await fetchSuccessfulPaymentTime(orderId, order);
      const { proExpiresAt, alreadyGranted } = await grantWithLedger(uid, orderId, planId, 'verify', {
        email: String(order?.customer_details?.customer_email || ''),
        amountPaise: plan.amountPaise,
        currency: paidCurrency,
        paidAt: paidAtMs,
      });
      const paymentMethod = await describeSuccessfulPayment(orderId);
      const receipt = buildReceipt(order, orderId, plan, proExpiresAt, paymentMethod, paidAtMs);
      return res.json({ success: true, paid: true, alreadyGranted, proExpiresAt, orderId, receipt });
    }

    return res.json({ success: true, paid: false, orderStatus: order.order_status, orderId });
  } catch (err: any) {
    console.error('[Payments] verify error:', err?.message || err);
    if (isPaymentStoreUnavailable(err)) {
      return res.status(503).json({
        success: false,
        paid: true,
        unavailable: true,
        error: 'Payment confirmed by Cashfree, but Pro activation is temporarily delayed. Do not pay again. It will be checked automatically on your next visit.',
      });
    }
    if (isPaymentOrderOwnershipError(err)) {
      return res.status(200).json({ success: false, paid: false, error: 'This order does not appear to belong to your account.' });
    }
    return res.status(200).json({ success: false, paid: false, error: 'Verification error: ' + (err?.message || 'unknown') });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/status — Pro state + catalogue for the Settings UI.
// ---------------------------------------------------------------------------
// GET /api/payments/status — Pro state + catalogue for the Settings UI.
//
// The dedicated payment_entitlements record is authoritative for PAID
// state. The ordinary profile is only a compatibility mirror and a source
// for the separate free trial. If the payment store cannot be read, this
// endpoint fails closed with 503 instead of falsely reporting Free.
// ---------------------------------------------------------------------------
paymentsRouter.get('/status', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const isAdmin = Boolean((req as any).user?.isAdmin || (req as any).user?.isOwner);
    // Checkout only starts when the durable profile/payment path is
    // readable. If storage is unavailable, create no Cashfree order at all.
    const profile = await getUserProfile(uid, { durable: true });
    const now = Date.now();

    let entitlement = null;
    let repaired = false;
    if (!isFirestoreQuotaExceeded() && !isAdminPermissionDenied()) {
      try {
        const reconciled = await reconcilePaymentEntitlement(uid);
        entitlement = reconciled.entitlement;
        repaired = reconciled.repaired;
      } catch (err) {
        if (!isAdmin && !isPaymentStoreUnavailable(err)) throw err;
        console.warn('[Payments] status: payment entitlement unavailable for fallback:', (err as Error)?.message || err);
      }
    } else if (isAdmin) {
      console.warn('[Payments] status: storage quota exceeded or local mode; bypassing entitlement check for admin');
    } else {
      console.warn('[Payments] status: storage quota exceeded or local mode; falling back to durable profile');
    }

    const paidExpiresAt = Number(entitlement?.proExpiresAt || 0);
    const isPaidPro = Boolean(
      entitlement && (entitlement.lastPaymentAt || entitlement.lastOrderId || entitlement.grantedOrderIds?.length),
    );
    const paidActive = isPaidPro && paidExpiresAt > now;
    const profilePlanId = (profile as any)?.proPlanId as PlanId | undefined;
    const entitlementPlanId = entitlement?.proPlanId as PlanId | undefined;
    const planId = (isPaidPro ? entitlementPlanId : profilePlanId) || profilePlanId || entitlementPlanId;
    const plan = (planId && (PRO_PLANS as Record<string, (typeof PRO_PLANS)[PlanId]>)[planId]) || PRO_PLANS.pro_monthly;

    // Paid expiry always wins over a trial/profile expiry. A missing paid
    // entitlement is the only case where the profile can describe a trial.
    const proExpiresAt = isPaidPro ? paidExpiresAt : Number(profile?.proExpiresAt || 0);
    const isPro = isAdmin || paidActive || (!isPaidPro && proExpiresAt > now && (profile?.tier === 'pro' || profile?.tier === 'admin'));

    return res.json({
      success: true,
      configured: isConfigured(),
      isPro,
      isPaidPro,
      paidActive,
      entitlementSource: entitlement?.source || null,
      repairedEntitlement: repaired,
      store: 'firestore' as const,
      proExpiresAt,
      plan,
      plans: Object.values(PRO_PLANS),
      lastPaymentAt: isPaidPro ? (entitlement?.lastPaymentAt || null) : ((profile as any)?.lastPaymentAt || null),
      lastOrderId: isPaidPro ? (entitlement?.lastOrderId || null) : ((profile as any)?.lastOrderId || null),
      // Auto-renew needs RBI e-mandate approval — not available yet.
      autoRenew: 'coming_soon' as const,
    });
  } catch (err: any) {
    if (isPaymentStoreUnavailable(err)) {
      console.warn('[Payments] status: payment store unavailable:', err?.message || err);
      return paymentUnavailable(
        res,
        'Subscription status is temporarily unavailable. Your payment record is not lost; please retry in a moment.',
      );
    }
    console.error('[Payments] status error:', err?.message || err);
    return res.status(503).json({ success: false, error: 'Could not load subscription status.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/recover — login-time pending-order recovery (27 Sep 2026).
//
// Finds this user's unresolved orders in the ledger, re-checks each one with
// Cashfree (source of truth) and grants Pro for the ones that are PAID.
// This is the safety net for a missed webhook / return-verify: even if the
// browser never came back, the next login repairs the entitlement.
//
// Only PAID orders grant. Dropped / failed / expired orders are marked
// `failed` in the ledger so they are never re-checked.
// ---------------------------------------------------------------------------
// POST /api/payments/recover — automatic payment reconciliation.
//
// Three durable repair sources run without asking the user for an Order ID:
//   1. payment_entitlements vs granted ledger/profile mirrors;
//   2. unresolved pending/granting ledger orders re-checked with Cashfree;
//   3. the profile's lastOrderId for older grants that predate the ledger.
//
// Only Cashfree-confirmed PAID orders grant. Ownership, exact amount and
// exact currency are mandatory. Dropped / failed / expired orders become
// `failed` so recovery does not re-check them forever.
// ---------------------------------------------------------------------------
paymentsRouter.post('/recover', requireAuth, paymentRecoveryLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    if (!isConfigured()) {
      return res.status(200).json({ success: false, error: 'Payment gateway not configured.' });
    }

    // Repair the dedicated entitlement first. This fixes the exact reported
    // failure class: durable payment evidence exists, but the user is being
    // shown as Free because one mirror/revision lost it.
    const reconciled = await reconcilePaymentEntitlement(uid);
    const entitlement = reconciled.entitlement;
    const recovered: Array<{ orderId: string; planId: string; proExpiresAt: number }> = [];
    const recoveredIds = new Set<string>();

    if (reconciled.repaired && entitlement?.lastOrderId && entitlement.proExpiresAt > Date.now()) {
      recovered.push({
        orderId: entitlement.lastOrderId,
        planId: entitlement.proPlanId,
        proExpiresAt: entitlement.proExpiresAt,
      });
      recoveredIds.add(entitlement.lastOrderId);
    }

    const cleanUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 45);
    const candidates = new Map<string, { orderId: string; email?: string }>();

    for (const o of await getPendingOrdersForUser(uid)) {
      candidates.set(o.orderId, { orderId: o.orderId, email: o.email });
    }

    // Older paid users may have only users/<uid>.lastOrderId as evidence.
    // Do not ask them to paste it manually: safely re-check that exact order
    // here, provided Cashfree proves ownership + PAID + exact amount.
    // Checkout only starts when the durable profile/payment path is
    // readable. If storage is unavailable, create no Cashfree order at all.
    const profile = await getUserProfile(uid, { durable: true });
    const legacyOrderId = String((profile as any)?.lastOrderId || '').trim();
    if (
      legacyOrderId &&
      !recoveredIds.has(legacyOrderId) &&
      !entitlement?.grantedOrderIds?.includes(legacyOrderId)
    ) {
      candidates.set(legacyOrderId, { orderId: legacyOrderId, email: profile?.email || '' });
    }

    for (const candidate of candidates.values()) {
      try {
        const order = await fetchOrderFromCashfree(candidate.orderId);
        if (!order) continue;
        const status = String(order.order_status || '').toUpperCase();
        if (status === 'PAID') {
          // Ownership MUST match the signed-in user — fail closed.
          const orderCustomer = String(order?.customer_details?.customer_id || '');
          if (!orderCustomer || (orderCustomer !== cleanUid && orderCustomer !== uid)) {
            if (candidate.orderId !== legacyOrderId) {
              await markOrderFailed(candidate.orderId, 'recover: customer mismatch').catch((e: any) => console.warn('[Payments] markOrderFailed failed:', candidate.orderId, e?.message || e));
            }
            continue;
          }
          const planId = planIdFromOrderId(candidate.orderId);
          const plan = PRO_PLANS[planId];
          if (Math.round(Number(order.order_amount) * 100) !== plan.amountPaise || String(order.order_currency || '').trim().toUpperCase() !== plan.currency.toUpperCase()) {
            if (candidate.orderId !== legacyOrderId) {
              await markOrderFailed(candidate.orderId, 'recover: amount/currency mismatch').catch((e: any) => console.warn('[Payments] markOrderFailed failed:', candidate.orderId, e?.message || e));
            }
            continue;
          }
          const r = await grantWithLedger(uid, candidate.orderId, planId, 'recover', {
            email: String(order?.customer_details?.customer_email || candidate.email || ''),
            amountPaise: plan.amountPaise,
            currency: String(order.order_currency || plan.currency),
            paidAt: await fetchSuccessfulPaymentTime(candidate.orderId, order),
          });
          if (!recoveredIds.has(candidate.orderId)) {
            recovered.push({ orderId: candidate.orderId, planId, proExpiresAt: r.proExpiresAt });
            recoveredIds.add(candidate.orderId);
          }
        } else if (status && status !== 'ACTIVE' && candidate.orderId !== legacyOrderId) {
          // Terminal non-paid state (EXPIRED / CANCELLED / ...): stop re-checking.
          await markOrderFailed(candidate.orderId, `recover: order ${status}`).catch((e: any) => console.warn('[Payments] markOrderFailed failed:', candidate.orderId, e?.message || e));
        }
        // ACTIVE = user may still be paying; leave it pending.
      } catch (oneErr: any) {
        if (isPaymentStoreUnavailable(oneErr)) throw oneErr;
        console.warn('[Payments] recover: order check failed:', candidate.orderId, oneErr?.message || oneErr);
      }
    }

    return res.json({
      success: true,
      recovered,
      recoveredCount: recovered.length,
      repairedEntitlement: reconciled.repaired,
    });
  } catch (err: any) {
    console.error('[Payments] recover error:', err?.message || err);
    if (isPaymentStoreUnavailable(err)) {
      return paymentUnavailable(
        res,
        'Payment recovery is temporarily unavailable. Do not pay again; your payment will be checked automatically.',
      );
    }
    return res.status(503).json({ success: false, error: 'Recovery check failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/claim — "Maine payment kar diya hai" (27 Sep 2026).
//
// The user pastes their BN_... order id (from the Cashfree receipt). The
// server re-fetches the order from Cashfree and grants Pro iff:
//   - the order is PAID,
//   - the order's customer_id matches the signed-in user (ownership),
//   - amount + currency match the plan encoded in the order id.
// Works even for orders that predate the ledger.
// ---------------------------------------------------------------------------
const ORDER_ID_RE = /^BN_[WMHY]_[A-Za-z0-9_-]{1,45}_\d{10,}$/;

paymentsRouter.post('/claim', requireAuth, paymentRecoveryLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    if (!isConfigured()) {
      return res.status(200).json({ success: false, error: 'Payment gateway not configured.' });
    }
    const orderId = String(req.body?.orderId || '').trim();
    if (!ORDER_ID_RE.test(orderId)) {
      return res.status(200).json({
        success: false,
        error: 'Enter the Order ID in the correct format — it starts with BN_ and is printed on your receipt.',
      });
    }

    const order = await fetchOrderFromCashfree(orderId);
    if (!order) {
      return res.status(200).json({ success: false, error: 'This order was not found on the gateway. Please check the Order ID and try again.' });
    }

    // Ownership: the Cashfree customer_id must be this signed-in user. Fail closed.
    const orderCustomer = String(order?.customer_details?.customer_id || '');
    const cleanUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 45);
    if (!orderCustomer || (orderCustomer !== cleanUid && orderCustomer !== uid)) {
      console.warn('[Payments] claim ownership mismatch:', orderId, 'uid=', uid);
      return res.status(200).json({ success: false, error: 'This order does not appear to belong to your account.' });
    }

    if (String(order.order_status || '').toUpperCase() !== 'PAID') {
      return res.status(200).json({
        success: false,
        error: `This order's status is ${order.order_status || 'unknown'}. Pro is granted only for PAID orders.`,
      });
    }

    const planId = planIdFromOrderId(orderId);
    const plan = PRO_PLANS[planId];
    if (Math.round(Number(order.order_amount) * 100) !== plan.amountPaise || String(order.order_currency || '').trim().toUpperCase() !== plan.currency.toUpperCase()) {
      console.warn('[Payments] claim amount mismatch:', orderId);
      return res.status(200).json({ success: false, error: 'The payment amount does not match the selected plan.' });
    }

    const paidAtMs = await fetchSuccessfulPaymentTime(orderId, order);
    const { proExpiresAt, alreadyGranted } = await grantWithLedger(uid, orderId, planId, 'claim', {
      email: String(order?.customer_details?.customer_email || ''),
      amountPaise: plan.amountPaise,
      currency: String(order.order_currency || plan.currency),
      paidAt: paidAtMs,
    });
    const paymentMethod = await describeSuccessfulPayment(orderId);
    const receipt = buildReceipt(order, orderId, plan, proExpiresAt, paymentMethod, paidAtMs);
    console.log(`[Payments] claim granted Pro: uid=${uid} order=${orderId} plan=${planId} already=${alreadyGranted}`);
    return res.json({ success: true, alreadyGranted, proExpiresAt, orderId, receipt });
  } catch (err: any) {
    console.error('[Payments] claim error:', err?.message || err);
    if (isPaymentStoreUnavailable(err)) {
      return paymentUnavailable(
        res,
        'Your payment was confirmed, but Pro activation is temporarily delayed. Do not pay again; it will be checked automatically.',
      );
    }
    if (isPaymentOrderOwnershipError(err)) {
      return res.status(200).json({ success: false, error: 'This order does not appear to belong to your account.' });
    }
    return res.status(200).json({ success: false, error: 'Claim failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/history — the signed-in user's COMPLETED payments,
// newest first. Powers the "Payment History" section where the user can
// re-open the payment slip (receipt) for any past payment.
//
// Only `granted` ledger orders are returned — a mere payment attempt can
// never appear here. Each entry belongs to the caller (uid from JWT).
// ---------------------------------------------------------------------------
paymentsRouter.get('/history', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Not signed in.' });
    }
    const orders = await getGrantedOrdersForUser(uid);
    const payments = orders.map((o) => {
      const plan = (PRO_PLANS as Record<string, { id: string; label: string; amountPaise: number; currency: string; validityDays: number }>)[o.planId];
      return {
        orderId: o.orderId,
        planId: o.planId || null,
        planLabel: plan ? plan.label : 'Pro',
        validityDays: plan ? plan.validityDays : null,
        amountPaise: o.amountPaise,
        currency: o.currency || 'INR',
        paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : o.grantedAt ? new Date(o.grantedAt).toISOString() : new Date(o.updatedAt).toISOString(),
        validUntil: o.proExpiresAt || null,
        grantSource: o.grantSource || null,
      };
    });
    return res.json({ success: true, payments });
  } catch (err: any) {
    console.error('[Payments] history error:', err?.message || err);
    if (isPaymentStoreUnavailable(err)) {
      return paymentUnavailable(
        res,
        'Payment history is temporarily unavailable. Your receipts are not lost; please retry in a moment.',
      );
    }
    return res.status(503).json({ success: false, error: 'Could not load payment history.' });
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
      if (!order) {
        // Ask Cashfree to retry: do not acknowledge a success webhook we
        // could not independently confirm with the gateway.
        return res.status(503).json({ ok: false, reason: 'cashfree-check-failed' });
      }
      const rawUid: string = order?.customer_details?.customer_id || '';
      const planId = planIdFromOrderId(orderId);
      const plan = PRO_PLANS[planId];
      // BUGFIX (1 Oct 2026 audit LOGIC-026 + LOGIC-027): Integer paise comparison + case-insensitive currency.
      const amountOk = Math.round(Number(order?.order_amount || 0) * 100) === plan.amountPaise;
      const currencyOk = String(order?.order_currency || '').trim().toUpperCase() === plan.currency.toUpperCase();
      if (order?.order_status === 'PAID' && rawUid && amountOk && currencyOk) {
        const uid = sanitizeUserId(rawUid);
        const { alreadyGranted } = await grantWithLedger(uid, orderId, planId, 'webhook', {
          email: String(order?.customer_details?.customer_email || ''),
          amountPaise: plan.amountPaise,
          currency: String(order?.order_currency || plan.currency),
          paidAt: await fetchSuccessfulPaymentTime(orderId, order),
        });
        console.log(`[Payments] webhook granted Pro: uid=${uid} order=${orderId} plan=${planId} already=${alreadyGranted}`);
      } else {
        console.warn('[Payments] webhook skipped: order not PAID / amount mismatch / no customer_id', orderId);
        return res.status(200).json({ ok: false, reason: 'order-not-grantable' });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[Payments] webhook error:', err?.message || err);
    if (isPaymentStoreUnavailable(err)) {
      // Non-2xx asks Cashfree to retry after the durable payment store is
      // back. The atomic grant is idempotent, so a retry cannot double-grant.
      return res.status(503).json({ ok: false, reason: 'payment-store-unavailable' });
    }
    // Non-2xx asks Cashfree to retry after the durable payment store is
    // back. The atomic grant is idempotent, so a retry cannot double-grant.
    // Unexpected errors also retry: the grant is idempotent, and losing a
    // success notification without retry is worse than a duplicate delivery.
    return res.status(503).json({ ok: false, reason: 'error-retry' });
  }
});

export default paymentsRouter;
