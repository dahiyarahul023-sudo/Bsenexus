import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  normalizePaymentEntitlement,
  deriveEntitlementFromOrders,
  deriveEntitlementFromProfile,
  mergePaymentEntitlementCandidates,
  paymentEntitlementEquals,
  calculateGrantExpiry,
  isPaymentEntitlementActive,
  type PaymentEntitlement,
} from '../services/paymentEntitlementLogic.js';

/**
 * Payment entitlement isolation (30 Sep 2026).
 *
 * Paid access, receipts and Payment History live in the durable
 * payment_entitlements / payment_orders layer, isolated from themes,
 * ordinary profile saves, republishes and Cloud Run restarts. These tests
 * pin the pure rules behind that isolation:
 *  - no durable evidence => null (never a manufactured Free/trial state);
 *  - a trial profile (proExpiresAt with no payment markers) must NEVER be
 *    mistaken for a paid entitlement;
 *  - the furthest durable expiry always wins (reconciliation can repair
 *    but can never shorten paid validity);
 *  - one order can never extend Pro twice.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('Payment entitlement: no evidence, no entitlement', () => {
  test('empty ledger after a republish yields null, not a guess', () => {
    assert.strictEqual(deriveEntitlementFromOrders('u1', [], NOW), null);
    assert.strictEqual(deriveEntitlementFromProfile('u1', null, NOW), null);
    assert.strictEqual(mergePaymentEntitlementCandidates('u1', [null, null], NOW), null);
  });

  test('pending / failed orders are not payment evidence', () => {
    const orders = [
      { orderId: 'BN_M_pending', status: 'pending', proExpiresAt: NOW + 30 * DAY },
      { orderId: 'BN_M_failed', status: 'failed', proExpiresAt: NOW + 30 * DAY },
      { orderId: 'BN_M_granting', status: 'granting', proExpiresAt: NOW + 30 * DAY },
    ];
    assert.strictEqual(deriveEntitlementFromOrders('u1', orders, NOW), null);
  });

  test('normalize rejects zero/missing expiry', () => {
    assert.strictEqual(normalizePaymentEntitlement('u1', null), null);
    assert.strictEqual(normalizePaymentEntitlement('u1', { proExpiresAt: 0 }), null);
    const ok = normalizePaymentEntitlement('u1', { proExpiresAt: NOW + DAY });
    assert.ok(ok);
    assert.strictEqual(ok!.source, 'grant');
  });
});

describe('Payment entitlement: a trial is never payment evidence', () => {
  test('trial profile (future expiry, no payment markers) derives nothing', () => {
    // This is exactly the state that used to relabel paid users — and the
    // inverse bug (trial user looking paid) is equally forbidden.
    const trialProfile = { proExpiresAt: NOW + 7 * DAY };
    assert.strictEqual(deriveEntitlementFromProfile('u1', trialProfile, NOW), null);
    assert.strictEqual(deriveEntitlementFromProfile('u1', { proExpiresAt: NOW + 7 * DAY, lastPaymentAt: null, proPlanId: null, lastOrderId: null }, NOW), null);
  });

  test('legacy paid profile bridges into an entitlement', () => {
    const e = deriveEntitlementFromProfile('u1', {
      proExpiresAt: NOW + 30 * DAY,
      proPlanId: 'pro_monthly',
      lastPaymentAt: NOW - DAY,
      lastOrderId: 'BN_M_abc',
    }, NOW);
    assert.ok(e);
    assert.strictEqual(e!.proExpiresAt, NOW + 30 * DAY);
    assert.strictEqual(e!.source, 'legacy-profile');
    assert.deepStrictEqual(e!.grantedOrderIds, ['BN_M_abc']);
  });

  test('isPaymentEntitlementActive requires a payment marker', () => {
    const trialLike: PaymentEntitlement = {
      uid: 'u1',
      proExpiresAt: NOW + 7 * DAY,
      proPlanId: '',
      lastPaymentAt: 0,
      lastOrderId: '',
      grantedOrderIds: [],
      updatedAt: NOW,
      source: 'legacy-profile',
    };
    assert.strictEqual(isPaymentEntitlementActive(trialLike, NOW), false);
  });
});

describe('Payment entitlement: furthest durable expiry wins', () => {
  test('granted orders derive entitlement; expiry is the max', () => {
    const e = deriveEntitlementFromOrders('u1', [
      { orderId: 'BN_M_1', planId: 'pro_monthly', status: 'granted', grantedAt: NOW - 10 * DAY, proExpiresAt: NOW + 20 * DAY },
      { orderId: 'BN_Y_2', planId: 'pro_yearly', status: 'granted', grantedAt: NOW - DAY, proExpiresAt: NOW + 300 * DAY },
    ], NOW);
    assert.ok(e);
    assert.strictEqual(e!.proExpiresAt, NOW + 300 * DAY);
    assert.strictEqual(e!.proPlanId, 'pro_yearly');
    assert.strictEqual(e!.lastOrderId, 'BN_Y_2');
    assert.deepStrictEqual(e!.grantedOrderIds, ['BN_M_1', 'BN_Y_2']);
  });

  test('merge never shortens paid validity', () => {
    const far: PaymentEntitlement = {
      uid: 'u1', proExpiresAt: NOW + 300 * DAY, proPlanId: 'pro_yearly',
      lastPaymentAt: NOW - 10 * DAY, lastOrderId: 'BN_Y_2',
      grantedOrderIds: ['BN_Y_2'], updatedAt: NOW, source: 'grant',
    };
    const near: PaymentEntitlement = {
      uid: 'u1', proExpiresAt: NOW + 20 * DAY, proPlanId: 'pro_monthly',
      lastPaymentAt: NOW - DAY, lastOrderId: 'BN_M_1',
      grantedOrderIds: ['BN_M_1'], updatedAt: NOW, source: 'ledger-repair',
    };
    const merged = mergePaymentEntitlementCandidates('u1', [near, far], NOW);
    assert.ok(merged);
    assert.strictEqual(merged!.proExpiresAt, far.proExpiresAt);
    assert.deepStrictEqual([...merged!.grantedOrderIds].sort(), ['BN_M_1', 'BN_Y_2']);
  });

  test('calculateGrantExpiry extends remaining paid time, never restarts it', () => {
    // Active subscription: redeeming a new plan stacks on the old expiry.
    assert.strictEqual(calculateGrantExpiry(NOW, NOW + 10 * DAY, 30), NOW + 40 * DAY);
    // Expired subscription: restarts from now.
    assert.strictEqual(calculateGrantExpiry(NOW, NOW - 10 * DAY, 30), NOW + 30 * DAY);
  });

  test('paymentEntitlementEquals ignores order-id ordering', () => {
    const a: PaymentEntitlement = {
      uid: 'u1', proExpiresAt: NOW + DAY, proPlanId: 'pro_monthly',
      lastPaymentAt: NOW, lastOrderId: 'BN_M_2', grantedOrderIds: ['BN_M_1', 'BN_M_2'],
      updatedAt: NOW, source: 'grant',
    };
    const b: PaymentEntitlement = { ...a, grantedOrderIds: ['BN_M_2', 'BN_M_1'], updatedAt: NOW + 1 };
    assert.strictEqual(paymentEntitlementEquals(a, b), true);
    assert.strictEqual(paymentEntitlementEquals(a, { ...b, proExpiresAt: NOW + 2 * DAY }), false);
  });
});

describe('Payment fail-closed wiring (source contracts)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  test('checkout writes the durable pending record before opening Cashfree', () => {
    const src = read('server/api/payments.ts');
    const pendingIdx = src.indexOf('await recordPendingOrder(');
    const cashfreeIdx = src.indexOf("cashfreeFetch('/orders'");
    assert.ok(pendingIdx >= 0, 'recordPendingOrder call missing');
    assert.ok(cashfreeIdx > pendingIdx, 'Cashfree order creation must come after the durable pending write');
  });

  test('every grant funnels through the atomic grant', () => {
    const src = read('server/api/payments.ts');
    assert.ok(src.includes('grantPaymentAtomically('), 'atomic grant missing');
    // One funnel: no route may update profile payment fields directly.
    assert.ok(!/saveUserProfile\([^)]*proExpiresAt/.test(src), 'payments must not patch profile expiry directly');
  });

  test('payment store has no local-JSON fallback', () => {
    const src = read('server/database/paymentStore.ts');
    assert.ok(!src.includes('readLocalJson'), 'payment store must never fall back to local JSON');
    assert.ok(!src.includes('writeLocalJson'), 'payment store must never fall back to local JSON');
  });

  test('client never fabricates a profile after a failed fetch', () => {
    const src = read('src/context/AuthContext.tsx');
    // Explicit unavailable state exists and is set on the failure path.
    assert.ok(src.includes('profileUnavailable'), 'profileUnavailable state missing');
    assert.ok(src.includes('setProfileUnavailable(true)'), 'failure path must set profileUnavailable');
    // The old fabrication block posted an invented profile to the server.
    assert.ok(!src.includes('Backend user profile save notice'), 'fabricated profile POST must stay removed');
    assert.ok(!src.includes('storedTrial'), 'localStorage trial invention must stay removed');
  });

  test('subscription card renders unavailable, never Free, on 503', () => {
    const src = read('src/components/SubscriptionCard.tsx');
    assert.ok(src.includes('res.status === 503'), 'status 503 handling missing');
    assert.ok(src.includes('Unavailable'), 'unavailable UI state missing');
  });
});
