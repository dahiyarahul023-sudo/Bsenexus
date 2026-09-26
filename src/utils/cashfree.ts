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
 * Client-side display catalogue for the 4 sellable plans.
 * Prices/durations here are DISPLAY ONLY — the server (PRO_PLANS) decides
 * the real amount at create-order time. Keep in sync with server/api/payments.ts.
 */
export interface ProPlanDisplay {
  id: string;
  label: string;
  price: number; // ₹
  days: number;
  tag?: string; // small highlight under the price, e.g. "Most Popular"
  sub: string; // honest sub-line (real savings vs monthly, or trial note)
}

export const PRO_PLAN_LIST: ProPlanDisplay[] = [
  { id: 'pro_weekly', label: 'Pro Weekly', price: 59, days: 7, sub: '7 days · try Pro out' },
  { id: 'pro_monthly', label: 'Pro Monthly', price: 199, days: 30, tag: 'Most Popular', sub: 'Was ₹499 · 60% launch offer' },
  { id: 'pro_halfyearly', label: 'Pro 6-Month', price: 999, days: 180, sub: 'Save ₹195 vs monthly' },
  { id: 'pro_yearly', label: 'Pro Yearly', price: 1799, days: 365, sub: 'Save ₹589 vs monthly' },
];

export function getPlanDisplay(planId?: string | null): ProPlanDisplay {
  return PRO_PLAN_LIST.find((p) => p.id === planId) || PRO_PLAN_LIST[1];
}

export function isValidPlanId(planId?: string | null): boolean {
  return Boolean(planId && PRO_PLAN_LIST.some((p) => p.id === planId));
}

/** Derive the plan display from a server-generated order id (BN_<code>_...). */
const ORDER_CODE_TO_PLAN: Record<string, string> = {
  W: 'pro_weekly',
  M: 'pro_monthly',
  H: 'pro_halfyearly',
  Y: 'pro_yearly',
};

export function getPlanDisplayFromOrderId(orderId?: string | null): ProPlanDisplay {
  const m = /^BN_([WMHY])_/.exec(orderId || '');
  const pid = m ? ORDER_CODE_TO_PLAN[m[1]] : 'pro_monthly';
  return getPlanDisplay(pid);
}

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

export function getPendingOrderId(): string | null {
  try {
    return sessionStorage.getItem('cf_pending_order');
  } catch {
    return null;
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
