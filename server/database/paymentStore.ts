/**
 * Payment-store failure contract.
 *
 * Payment records are intentionally NOT part of the app's general
 * local-JSON fallback system. Cloud Run files are revision-local, so a
 * payment written only there can disappear on the next republish.
 * Every payment-critical Supabase operation therefore either succeeds
 * in Supabase or fails closed with PaymentStoreUnavailableError. The
 * caller can then tell the user to retry / let Cashfree retry the
 * webhook instead of pretending that a local-only payment is durable.
 */

export class PaymentStoreUnavailableError extends Error {
  readonly code = 'PAYMENT_STORE_UNAVAILABLE';
  readonly operation: string;
  readonly cause?: unknown;

  constructor(operation: string, cause?: unknown) {
    super(`Payment store unavailable during ${operation}.`);
    this.name = 'PaymentStoreUnavailableError';
    this.operation = operation;
    this.cause = cause;
  }
}

export class PaymentOrderOwnershipError extends Error {
  readonly code = 'PAYMENT_ORDER_OWNERSHIP_MISMATCH';

  constructor(orderId: string) {
    super(`Payment order ${orderId} belongs to a different account.`);
    this.name = 'PaymentOrderOwnershipError';
  }
}

export function isPaymentStoreUnavailable(error: unknown): boolean {
  return (
    error instanceof PaymentStoreUnavailableError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'PAYMENT_STORE_UNAVAILABLE')
  );
}

export function isPaymentOrderOwnershipError(error: unknown): boolean {
  return (
    error instanceof PaymentOrderOwnershipError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'PAYMENT_ORDER_OWNERSHIP_MISMATCH')
  );
}

import { isSupabaseConfigured } from './supabase.js';

/**
 * Run one Supabase payment operation with a hard timeout. Any Supabase
 * error (network, timeout, missing configuration) is normalized to
 * PaymentStoreUnavailableError so payment code never falls through to
 * ephemeral local storage by accident. PaymentOrderOwnershipError passes
 * through untouched — it is a caller bug, not a store outage.
 */
export async function runPaymentStore<T>(
  operation: string,
  promise: Promise<T>,
  timeoutMs = 10_000,
): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new PaymentStoreUnavailableError(operation, new Error('Supabase not configured'));
  }

  const TIMEOUT = Symbol('payment-store-timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      promise,
      new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
      }),
    ]);

    if (result === TIMEOUT) {
      throw new PaymentStoreUnavailableError(operation, new Error(`Timed out after ${timeoutMs}ms`));
    }
    return result;
  } catch (error) {
    if (error instanceof PaymentStoreUnavailableError || isPaymentOrderOwnershipError(error)) {
      throw error;
    }
    throw new PaymentStoreUnavailableError(operation, error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
