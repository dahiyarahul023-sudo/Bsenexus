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

/** After the Cashfree redirect, confirm the payment with OUR server. */
export async function verifyProPayment(orderId: string): Promise<{ paid: boolean; proExpiresAt?: number; error?: string }> {
  try {
    const res = await customFetch(`/api/payments/verify?order_id=${encodeURIComponent(orderId)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { paid: false, error: data?.error || 'Verification failed. Please try again.' };
    }
    return { paid: Boolean(data.paid), proExpiresAt: data.proExpiresAt };
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
