/**
 * Payment security logic — pure, zero-dependency functions.
 *
 * Why this module exists (1 Oct 2026): the Cashfree webhook signature was
 * compared with `===`, which is a timing-attackable comparison, and the
 * webhook timestamp was never checked for freshness (replay window). This
 * module is the single, testable home for those rules so the HTTP layer
 * stays thin and the rules can be pinned by node:test without booting
 * Firebase or Express.
 *
 * Everything here is pure: no env reads, no I/O, no Firebase.
 */
import crypto from 'node:crypto';

/**
 * Webhooks older than this are rejected even with a valid signature.
 * Cashfree retries failed webhooks for ~24h, so a replayed (but validly
 * signed) payload is a real threat; 10 minutes comfortably covers clock
 * skew + delivery latency while making replays useless.
 */
export const WEBHOOK_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * A `pending` ledger order older than this is an abandoned checkout.
 * Cashfree orders themselves expire within hours, so 48h of no webhook /
 * no return-verify means it will never complete. The sweep marks it
 * `failed` so login recovery stops re-checking it with the gateway.
 *
 * A payment can never be lost by this sweep: even a `failed` ledger order
 * is still granted by webhook/verify/recover if Cashfree ever confirms it
 * PAID — the sweep only stops *proactive* re-checking.
 */
export const STALE_PENDING_ORDER_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Canonical order-id shape: BN_<planCode>_<customerFragment>_<epochMs>.
 * Shared by /claim and the webhook so both reject garbage before any
 * gateway call.
 */
export const PAYMENT_ORDER_ID_RE = /^BN_[WMHY]_[A-Za-z0-9_-]{1,45}_\d{10,}$/;

export function isValidPaymentOrderId(orderId: unknown): orderId is string {
  return typeof orderId === 'string' && PAYMENT_ORDER_ID_RE.test(orderId);
}

/** Constant-time string comparison that never throws on length mismatch. */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // Compare against self to keep the timing shape roughly constant even
    // on the mismatch path, then report unequal.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export type WebhookSignatureVerdict =
  | { ok: true }
  | { ok: false; reason: 'missing-signature' | 'stale-timestamp' | 'bad-timestamp' | 'bad-signature' };

/**
 * Verify a Cashfree webhook signature the safe way:
 *   HMAC-SHA256(timestamp + rawBody, secret) — accepted in base64 or hex —
 *   compared with crypto.timingSafeEqual, plus a freshness check on the
 *   timestamp header so captured payloads cannot be replayed later.
 *
 * Cashfree sends x-webhook-timestamp in epoch SECONDS; we tolerate
 * millisecond values too so tests and proxies do not break the check.
 */
export function verifyCashfreeWebhookSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
  nowMs?: number;
}): WebhookSignatureVerdict {
  const { secret, rawBody } = input;
  const signature = String(input.signature || '').trim();
  const timestamp = String(input.timestamp || '').trim();
  const nowMs = input.nowMs ?? Date.now();

  if (!signature || !timestamp || !secret) {
    return { ok: false, reason: 'missing-signature' };
  }

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || tsNum <= 0) {
    return { ok: false, reason: 'bad-timestamp' };
  }
  const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum; // seconds → ms
  const age = nowMs - tsMs;
  if (age > WEBHOOK_MAX_AGE_MS || age < -WEBHOOK_MAX_AGE_MS) {
    return { ok: false, reason: 'stale-timestamp' };
  }

  const digest = crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest();
  const expectedB64 = digest.toString('base64');
  const expectedHex = digest.toString('hex');

  if (timingSafeStringEqual(signature, expectedB64)) return { ok: true };
  if (timingSafeStringEqual(signature, expectedHex)) return { ok: true };
  return { ok: false, reason: 'bad-signature' };
}

/**
 * True when a durable ledger order is an abandoned checkout that should be
 * auto-expired by the housekeeping sweep. Only `pending` orders expire:
 *  - `granting`  → a grant crashed mid-flight; login recovery owns the
 *    takeover path and must keep re-checking it.
 *  - `granted` / `failed` → terminal states, never touched.
 */
export function isStalePendingOrder(
  order: { status: string; updatedAt?: number; createdAt?: number },
  nowMs: number = Date.now(),
  maxAgeMs: number = STALE_PENDING_ORDER_MAX_AGE_MS,
): boolean {
  if (order.status !== 'pending') return false;
  const lastActivity = Math.max(Number(order.updatedAt || 0), Number(order.createdAt || 0));
  if (!Number.isFinite(lastActivity) || lastActivity <= 0) return false;
  return nowMs - lastActivity > maxAgeMs;
}
