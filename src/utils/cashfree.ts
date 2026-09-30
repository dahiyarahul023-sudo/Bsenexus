/**
 * Cashfree PG checkout helpers (client side).
 *
 * Security: the client only ever handles the payment_session_id returned by
 * OUR server (/api/payments/create-order). Amounts, signatures and the secret
 * key never touch this code.
 */
import { customFetch } from '../api';

const SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';
let sdkPromise: Promise<any> | null = null;

function loadSdk(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const w = window as any;
  if (w.Cashfree) return Promise.resolve(w.Cashfree);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => (w.Cashfree ? resolve(w.Cashfree) : reject(new Error('Cashfree SDK failed to initialise')));
      script.onerror = () => reject(new Error('Could not load the payment gateway. Check your connection and retry.'));
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

export interface StartPaymentResult {
  ok: boolean;
  error?: string;
}

/**
 * Plan display catalogue — moved to src/config/plans.ts (single source of
 * truth, zero imports). Re-exported here so existing imports keep working.
 */
export {
  PRO_PLAN_LIST,
  getPlanDisplay,
  getLowestPlanPrice,
  isValidPlanId,
  getPlanDisplayFromOrderId,
  type ProPlanDisplay,
} from '../config/plans';

/**
 * Create a Cashfree order on our server, then open the Cashfree checkout.
 * On completion Cashfree redirects back to /?cf_order_id=... where the
 * app verifies the payment with our server (source of truth).
 */
export async function startProPayment(planId: string = 'pro_monthly'): Promise<StartPaymentResult> {
  try {
    const res = await customFetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || !data?.paymentSessionId) {
      return { ok: false, error: data?.error || 'Could not start the payment. Please try again.' };
    }

    try {
      sessionStorage.setItem('cf_pending_order', String(data.orderId));
    } catch { /* non-fatal */ }

    const Cashfree = await loadSdk();
    const cf = Cashfree({ mode: data.mode === 'production' ? 'production' : 'sandbox' });
    await cf.checkout({
      paymentSessionId: data.paymentSessionId,
      redirectTarget: '_self', // Cashfree returns to /?cf_order_id=...
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Payment could not be started. Please try again.' };
  }
}

/** Receipt data for the payment-success screen (from our server's verify). */
export interface PaymentReceipt {
  orderId: string;
  amount: number;
  currency: string;
  paidAt: string; // ISO date from Cashfree
  email: string;
  validUntil: number; // proExpiresAt timestamp
  planId?: string;
  planLabel?: string; // e.g. "Pro Yearly"
  validityDays?: number; // e.g. 365
  paymentMethod?: string; // e.g. "UPI", "Visa Credit Card" (display-only, no PII)
}

export function formatReceiptDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  } catch {
    return iso;
  }
}

/**
 * Build a "send receipt by email" link. There is no server mailer in this
 * project, so this opens the user's own mail app with the receipt prefilled,
 * addressed to whatever email they typed. Nothing is sent without their tap.
 */
export function buildReceiptMailto(r: PaymentReceipt, toEmail: string): string {
  const planLine = r.planLabel
    ? `1x ${r.planLabel}${r.validityDays ? ` (${r.validityDays} days)` : ''}`
    : '1x Pro Monthly (30 days)';
  const lines = [
    'BSE Nexus — Invoice',
    '--------------------------------',
    `Invoice No.: ${r.orderId}`,
    `Issued Date: ${formatReceiptDate(r.paidAt)}`,
    `Valid Until: ${formatReceiptDate(new Date(r.validUntil).toISOString())}`,
    'From: BSE Nexus (bsenexus.in)',
    `To: ${toEmail.trim()}`,
    '--------------------------------',
    `Item: ${planLine}`,
    `Total: \u20B9${Number(r.amount).toFixed(2)} ${r.currency} (PAID via Cashfree)`,
    ...(r.paymentMethod ? [`Paid via: ${r.paymentMethod}`] : []),
    '--------------------------------',
    'Note: one-time payment, no auto-renewal.',
    'Thank you for going Pro!',
    'bsenexus.in',
  ];
  const subject = `BSE Nexus invoice — ${r.orderId}`;
  return `mailto:${encodeURIComponent(toEmail.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

/** After the Cashfree redirect, confirm the payment with OUR server. */
export async function verifyProPayment(orderId: string): Promise<{ paid: boolean; proExpiresAt?: number; receipt?: PaymentReceipt; error?: string }> {
  try {
    const res = await customFetch(`/api/payments/verify?order_id=${encodeURIComponent(orderId)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { paid: false, error: data?.error || 'Verification failed. Please try again.' };
    }
    return { paid: Boolean(data.paid), proExpiresAt: data.proExpiresAt, receipt: data.receipt || undefined };
  } catch {
    return { paid: false, error: 'Verification failed. Please try again.' };
  }
}

/**
 * Login-time recovery: ask OUR server to re-check any unresolved orders in
 * the ledger and grant Pro for the ones Cashfree confirms as PAID.
 * Silent best-effort — never throws, never blocks the UI.
 */
export async function recoverPendingPayments(): Promise<{ recoveredCount: number; recovered: Array<{ orderId: string; planId: string; proExpiresAt: number }>; unavailable?: boolean }> {
  try {
    const res = await customFetch('/api/payments/recover', { method: 'POST' });
    const data = await res.json().catch(() => null);
    if (res.status === 503 || (data as any)?.profileUnavailable) {
      return { recoveredCount: 0, recovered: [], unavailable: true };
    }
    if (!res.ok || !data?.success) return { recoveredCount: 0, recovered: [] };
    return { recoveredCount: Number(data.recoveredCount || 0), recovered: Array.isArray(data.recovered) ? data.recovered : [] };
  } catch {
    return { recoveredCount: 0, recovered: [] };
  }
}

/**
 * "Maine payment kar diya hai" — the user pastes their BN_... order id from
 * the Cashfree receipt; OUR server verifies ownership + PAID status with
 * Cashfree and grants Pro. Never trusts the client.
 */
export async function claimProPayment(orderId: string): Promise<{ ok: boolean; alreadyGranted?: boolean; proExpiresAt?: number; receipt?: PaymentReceipt; error?: string }> {
  try {
    const res = await customFetch('/api/payments/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderId.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || 'Claim failed. Please try again.' };
    }
    return { ok: true, alreadyGranted: Boolean(data.alreadyGranted), proExpiresAt: data.proExpiresAt, receipt: data.receipt || undefined };
  } catch {
    return { ok: false, error: 'Claim failed. Please try again.' };
  }
}

export function getPendingOrderId(): string | null {
  try {
    return sessionStorage.getItem('cf_pending_order');
  } catch {
    return null;
  }
}

/** One completed payment from /api/payments/history (granted ledger orders only). */
export interface PaymentHistoryEntry {
  orderId: string;
  planId: string | null;
  planLabel: string;
  validityDays: number | null;
  amountPaise: number;
  currency: string;
  paidAt: string; // ISO
  validUntil: number | null; // timestamp
  grantSource: string | null;
}

/**
 * Fetch the signed-in user's completed payments (newest first).
 * Only PAID-and-granted orders are returned by the server — attempts
 * never appear here.
 */
export async function fetchPaymentHistory(): Promise<{ ok: boolean; payments: PaymentHistoryEntry[]; error?: string }> {
  try {
    const res = await customFetch('/api/payments/history');
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      // 503 storage outage: explicit "unavailable" wording so an empty
      // history is never confused with "no payments".
      if (res.status === 503 || (data as any)?.profileUnavailable) {
        return { ok: false, payments: [], error: 'Payment history is temporarily unavailable. Nothing was deleted — please try again.' };
      }
      return { ok: false, payments: [], error: data?.error || 'Could not load payment history.' };
    }
    return { ok: true, payments: Array.isArray(data.payments) ? data.payments : [] };
  } catch {
    return { ok: false, payments: [], error: 'Could not load payment history.' };
  }
}

export function clearPendingOrderId(): void {
  try {
    sessionStorage.removeItem('cf_pending_order');
  } catch { /* ignore */ }
}

/** Has this browser consumed the 7-day free trial for this uid? (trial itself stays local-only) */
export function hasUsedTrial(uid?: string | null): boolean {
  if (!uid || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`bse_trial_used_${uid}`) === '1';
  } catch {
    return false;
  }
}
