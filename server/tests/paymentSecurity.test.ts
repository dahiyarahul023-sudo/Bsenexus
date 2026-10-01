import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  verifyCashfreeWebhookSignature,
  timingSafeStringEqual,
  isValidPaymentOrderId,
  isStalePendingOrder,
  WEBHOOK_MAX_AGE_MS,
  STALE_PENDING_ORDER_MAX_AGE_MS,
  PAYMENT_ORDER_ID_RE,
} from '../services/paymentSecurityLogic.js';

/**
 * Payment webhook & ledger hygiene security suite (1 Oct 2026).
 *
 * Pins the rules that keep money truth safe:
 *  - webhook signatures are verified in constant time (no `===`),
 *  - a validly-signed but OLD webhook is rejected (anti-replay),
 *  - malformed order ids never reach the gateway,
 *  - only abandoned `pending` checkouts are auto-expired — a crashed
 *    `granting` order and all terminal orders are never touched.
 */

const SECRET = 'test-cashfree-secret-key';
const NOW = 1_800_000_000_000; // fixed clock for deterministic tests

function sign(rawBody: string, timestampSec: number, secret: string = SECRET): string {
  return crypto.createHmac('sha256', secret).update(String(timestampSec) + rawBody).digest('base64');
}

describe('Webhook signature verification (timing-safe + freshness)', () => {
  const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'BN_M_user1_1800000000000' } } });
  const tsSec = Math.floor(NOW / 1000);

  test('accepts a valid base64 signature', () => {
    const v = verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: String(tsSec), rawBody: body, signature: sign(body, tsSec), nowMs: NOW });
    assert.deepStrictEqual(v, { ok: true });
  });

  test('accepts a valid hex signature', () => {
    const hex = crypto.createHmac('sha256', SECRET).update(String(tsSec) + body).digest('hex');
    const v = verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: String(tsSec), rawBody: body, signature: hex, nowMs: NOW });
    assert.deepStrictEqual(v, { ok: true });
  });

  test('rejects a signature made with the wrong secret', () => {
    const v = verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: String(tsSec), rawBody: body, signature: sign(body, tsSec, 'wrong-secret'), nowMs: NOW });
    assert.deepStrictEqual(v, { ok: false, reason: 'bad-signature' });
  });

  test('rejects a signature over a tampered body', () => {
    const v = verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: String(tsSec), rawBody: body + ' ', signature: sign(body, tsSec), nowMs: NOW });
    assert.deepStrictEqual(v, { ok: false, reason: 'bad-signature' });
  });

  test('rejects a REPLAYED webhook older than the freshness window', () => {
    const oldTsSec = Math.floor((NOW - WEBHOOK_MAX_AGE_MS - 60_000) / 1000);
    const v = verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: String(oldTsSec), rawBody: body, signature: sign(body, oldTsSec), nowMs: NOW });
    assert.deepStrictEqual(v, { ok: false, reason: 'stale-timestamp' });
  });

  test('rejects a webhook timestamped far in the future', () => {
    const futureTsSec = Math.floor((NOW + WEBHOOK_MAX_AGE_MS + 60_000) / 1000);
    const v = verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: String(futureTsSec), rawBody: body, signature: sign(body, futureTsSec), nowMs: NOW });
    assert.deepStrictEqual(v, { ok: false, reason: 'stale-timestamp' });
  });

  test('rejects missing headers and garbage timestamps', () => {
    assert.deepStrictEqual(
      verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: '', rawBody: body, signature: 'x', nowMs: NOW }),
      { ok: false, reason: 'missing-signature' },
    );
    assert.deepStrictEqual(
      verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: 'not-a-number', rawBody: body, signature: 'x', nowMs: NOW }),
      { ok: false, reason: 'bad-timestamp' },
    );
  });

  test('accepts a millisecond timestamp (proxy tolerance)', () => {
    const tsMs = NOW - 1000;
    const sig = crypto.createHmac('sha256', SECRET).update(String(tsMs) + body).digest('base64');
    const v = verifyCashfreeWebhookSignature({ secret: SECRET, timestamp: String(tsMs), rawBody: body, signature: sig, nowMs: NOW });
    assert.deepStrictEqual(v, { ok: true });
  });
});

describe('timingSafeStringEqual', () => {
  test('equal strings match, different strings and different lengths do not', () => {
    assert.strictEqual(timingSafeStringEqual('abc', 'abc'), true);
    assert.strictEqual(timingSafeStringEqual('abc', 'abd'), false);
    assert.strictEqual(timingSafeStringEqual('abc', 'abcd'), false);
    assert.strictEqual(timingSafeStringEqual('', ''), true);
    assert.strictEqual(timingSafeStringEqual('', 'a'), false);
  });
});

describe('Payment order id validation', () => {
  test('accepts genuine BSE Nexus order ids for every plan code', () => {
    for (const code of ['W', 'M', 'H', 'Y']) {
      assert.strictEqual(isValidPaymentOrderId(`BN_${code}_abc123XYZ_1800000000000`), true);
    }
  });

  test('rejects garbage, injection attempts and foreign formats', () => {
    assert.strictEqual(isValidPaymentOrderId(''), false);
    assert.strictEqual(isValidPaymentOrderId('BN_X_abc_1800000000000'), false); // bad plan code
    assert.strictEqual(isValidPaymentOrderId('BN_M_abc_123'), false);           // timestamp too short
    assert.strictEqual(isValidPaymentOrderId("BN_M_abc_1800000000000' OR 1=1--"), false);
    assert.strictEqual(isValidPaymentOrderId('../../etc/passwd'), false);
    assert.strictEqual(isValidPaymentOrderId('order_123456'), false);
    assert.strictEqual(isValidPaymentOrderId(null), false);
    assert.strictEqual(isValidPaymentOrderId(undefined), false);
    assert.strictEqual(isValidPaymentOrderId(42), false);
  });

  test('the shared regex is the one used by the HTTP layer', () => {
    assert.strictEqual(PAYMENT_ORDER_ID_RE.test('BN_M_user1_1800000000000'), true);
  });
});

describe('Stale pending order sweep rules', () => {
  test('a pending order older than 48h is expired', () => {
    const order = { status: 'pending', createdAt: NOW - STALE_PENDING_ORDER_MAX_AGE_MS - 1, updatedAt: NOW - STALE_PENDING_ORDER_MAX_AGE_MS - 1 };
    assert.strictEqual(isStalePendingOrder(order, NOW), true);
  });

  test('a fresh pending order is NOT expired', () => {
    const order = { status: 'pending', createdAt: NOW - 60_000, updatedAt: NOW - 60_000 };
    assert.strictEqual(isStalePendingOrder(order, NOW), false);
  });

  test('a crashed `granting` order is NEVER expired — login recovery owns it', () => {
    const order = { status: 'granting', createdAt: NOW - 30 * 24 * 60 * 60 * 1000, updatedAt: NOW - 30 * 24 * 60 * 60 * 1000 };
    assert.strictEqual(isStalePendingOrder(order, NOW), false);
  });

  test('terminal orders (granted / failed) are NEVER expired', () => {
    const ancient = NOW - 365 * 24 * 60 * 60 * 1000;
    assert.strictEqual(isStalePendingOrder({ status: 'granted', createdAt: ancient, updatedAt: ancient }, NOW), false);
    assert.strictEqual(isStalePendingOrder({ status: 'failed', createdAt: ancient, updatedAt: ancient }, NOW), false);
  });

  test('a pending order with no usable timestamps is left alone (fail safe)', () => {
    assert.strictEqual(isStalePendingOrder({ status: 'pending' }, NOW), false);
    assert.strictEqual(isStalePendingOrder({ status: 'pending', createdAt: 0, updatedAt: 0 }, NOW), false);
  });
});

describe('Source audit: payments.ts must use the hardened path', () => {
  const paymentsPath = path.resolve(process.cwd(), 'server/api/payments.ts');
  const src = fs.readFileSync(paymentsPath, 'utf8');

  test('webhook signature verification goes through paymentSecurityLogic', () => {
    assert.ok(src.includes('verifyCashfreeWebhookSignature'), 'payments.ts must call verifyCashfreeWebhookSignature');
    assert.ok(src.includes("from '../services/paymentSecurityLogic.js'"), 'payments.ts must import the security module');
  });

  test('no raw `signature ===` string comparison remains (timing attack)', () => {
    assert.ok(!/signature\s*===\s*expected/.test(src), 'webhook signature must never be compared with ===');
    assert.ok(!src.includes('timingSafeStringEqual(signature, expectedB64)'), 'comparison lives in the pure module, not the router');
  });

  test('webhook rejects malformed order ids before the gateway call', () => {
    assert.ok(src.includes('isValidPaymentOrderId(orderId)'), 'webhook must validate order id format');
  });

  test('create-order and verify are rate limited', () => {
    assert.ok(src.includes("'/create-order', requireAuth, createOrderLimiter"), 'create-order must be rate limited');
    assert.ok(src.includes("'/verify', requireAuth, paymentStatusLimiter"), 'verify must be rate limited');
  });

  test('admin reconcile-all endpoint exists and is admin-gated', () => {
    assert.ok(src.includes("'/admin/reconcile-all', requireAuth, requireAdmin"), 'reconcile-all must require admin');
    assert.ok(src.includes('expireStalePendingOrders'), 'reconcile-all must run the stale sweep');
  });
});
