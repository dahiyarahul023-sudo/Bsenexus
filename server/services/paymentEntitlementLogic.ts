/**
 * Pure payment-entitlement rules.
 *
 * Kept dependency-free so the money logic can be regression-tested
 * without Firestore, Cashfree, Express, or the user-profile system.
 * The Firestore DAO uses these helpers; UI/theme/profile code never
 * calculates a paid entitlement on its own.
 */

export type PaymentEntitlementSource = 'grant' | 'ledger-repair' | 'legacy-profile';

export interface PaymentEntitlement {
  uid: string;
  proExpiresAt: number;
  proPlanId: string;
  lastPaymentAt: number;
  lastOrderId: string;
  grantedOrderIds: string[];
  updatedAt: number;
  source: PaymentEntitlementSource;
}

export interface GrantedPaymentOrderLike {
  orderId: string;
  planId?: string;
  status?: string;
  grantedAt?: number;
  updatedAt?: number;
  proExpiresAt?: number;
}

export interface LegacyPaidProfileLike {
  proExpiresAt?: number | null;
  proPlanId?: string | null;
  lastPaymentAt?: number | null;
  lastOrderId?: string | null;
}

const MAX_GRANTED_ORDER_IDS = 200;

function cleanOrderIds(ids: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    const clean = String(id || '').trim();
    if (clean) seen.add(clean);
  }
  return [...seen].slice(-MAX_GRANTED_ORDER_IDS);
}

export function normalizePaymentEntitlement(
  uid: string,
  raw: Partial<PaymentEntitlement> | null | undefined,
): PaymentEntitlement | null {
  if (!raw || !Number(raw.proExpiresAt || 0)) return null;
  return {
    uid,
    proExpiresAt: Number(raw.proExpiresAt || 0),
    proPlanId: String(raw.proPlanId || 'pro_monthly'),
    lastPaymentAt: Number(raw.lastPaymentAt || 0),
    lastOrderId: String(raw.lastOrderId || ''),
    grantedOrderIds: cleanOrderIds(Array.isArray(raw.grantedOrderIds) ? raw.grantedOrderIds : []),
    updatedAt: Number(raw.updatedAt || 0),
    source:
      raw.source === 'ledger-repair' || raw.source === 'legacy-profile'
        ? raw.source
        : 'grant',
  };
}

/** Derive the entitlement proved by already-granted durable ledger orders. */
export function deriveEntitlementFromOrders(
  uid: string,
  orders: GrantedPaymentOrderLike[],
  now = Date.now(),
): PaymentEntitlement | null {
  const granted = orders
    .filter((o) => o && o.orderId && (!o.status || o.status === 'granted') && Number(o.proExpiresAt || 0) > 0)
    .sort((a, b) => Number(a.grantedAt || a.updatedAt || 0) - Number(b.grantedAt || b.updatedAt || 0));

  if (!granted.length) return null;

  const latest = granted[granted.length - 1];
  const proExpiresAt = Math.max(...granted.map((o) => Number(o.proExpiresAt || 0)));
  // If a later purchase was somehow granted with a shorter absolute expiry,
  // the latest order owns the displayed plan/order fields, while the expiry
  // remains the furthest durable expiry ever granted.
  const expiryOwner = [...granted].sort((a, b) => Number(b.proExpiresAt || 0) - Number(a.proExpiresAt || 0))[0];

  return {
    uid,
    proExpiresAt,
    proPlanId: String(expiryOwner.planId || latest.planId || 'pro_monthly'),
    lastPaymentAt: Number(latest.grantedAt || latest.updatedAt || 0),
    lastOrderId: String(latest.orderId),
    grantedOrderIds: cleanOrderIds(granted.map((o) => o.orderId)),
    updatedAt: now,
    source: 'ledger-repair',
  };
}

/**
 * Legacy paid profiles created before the dedicated entitlement collection
 * remain valid evidence for status/repair. They are only a bridge: the DAO
 * copies the result into payment_entitlements, after which the profile is
 * no longer the source of truth.
 */
export function deriveEntitlementFromProfile(
  uid: string,
  profile: LegacyPaidProfileLike | null | undefined,
  now = Date.now(),
): PaymentEntitlement | null {
  if (!profile || !Number(profile.proExpiresAt || 0)) return null;
  if (!profile.lastPaymentAt && !profile.proPlanId && !profile.lastOrderId) return null;

  const lastOrderId = String(profile.lastOrderId || '');
  return {
    uid,
    proExpiresAt: Number(profile.proExpiresAt || 0),
    proPlanId: String(profile.proPlanId || 'pro_monthly'),
    lastPaymentAt: Number(profile.lastPaymentAt || 0),
    lastOrderId,
    grantedOrderIds: cleanOrderIds(lastOrderId ? [lastOrderId] : []),
    updatedAt: now,
    source: 'legacy-profile',
  };
}

/**
 * Merge entitlement candidates without ever shortening paid validity.
 * The furthest expiry wins; order ids from every durable source are kept
 * for idempotency.
 */
export function mergePaymentEntitlementCandidates(
  uid: string,
  candidates: Array<PaymentEntitlement | null | undefined>,
  now = Date.now(),
): PaymentEntitlement | null {
  const valid = candidates.filter(
    (c): c is PaymentEntitlement => Boolean(c && Number(c.proExpiresAt || 0) > 0),
  );
  if (!valid.length) return null;

  const primary = [...valid].sort((a, b) => {
    const expiryDiff = Number(b.proExpiresAt || 0) - Number(a.proExpiresAt || 0);
    if (expiryDiff) return expiryDiff;
    return Number(b.lastPaymentAt || 0) - Number(a.lastPaymentAt || 0);
  })[0];

  const latestByPayment = [...valid].sort(
    (a, b) => Number(b.lastPaymentAt || 0) - Number(a.lastPaymentAt || 0),
  )[0];

  return {
    uid,
    proExpiresAt: Number(primary.proExpiresAt || 0),
    proPlanId: String(primary.proPlanId || latestByPayment.proPlanId || 'pro_monthly'),
    lastPaymentAt: Number(latestByPayment.lastPaymentAt || 0),
    lastOrderId: String(latestByPayment.lastOrderId || primary.lastOrderId || ''),
    grantedOrderIds: cleanOrderIds(valid.flatMap((c) => c.grantedOrderIds || [])),
    updatedAt: now,
    source: primary.source || 'grant',
  };
}

export function paymentEntitlementEquals(
  a: PaymentEntitlement | null | undefined,
  b: PaymentEntitlement | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  const aIds = [...(a.grantedOrderIds || [])].sort();
  const bIds = [...(b.grantedOrderIds || [])].sort();
  return (
    a.proExpiresAt === b.proExpiresAt &&
    a.proPlanId === b.proPlanId &&
    a.lastPaymentAt === b.lastPaymentAt &&
    a.lastOrderId === b.lastOrderId &&
    aIds.length === bIds.length &&
    aIds.every((id, i) => id === bIds[i])
  );
}

/** Paid grants extend from the later of now and the current paid expiry. */
export function calculateGrantExpiry(now: number, currentExpiresAt: number, validityDays: number): number {
  return Math.max(now, Number(currentExpiresAt || 0)) + validityDays * 24 * 60 * 60 * 1000;
}

export function isPaymentEntitlementActive(
  entitlement: PaymentEntitlement | null | undefined,
  now = Date.now(),
): boolean {
  return Boolean(
    entitlement &&
      Number(entitlement.proExpiresAt || 0) > now &&
      (entitlement.lastPaymentAt || entitlement.lastOrderId || entitlement.grantedOrderIds?.length),
  );
}
