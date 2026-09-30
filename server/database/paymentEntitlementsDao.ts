/**
 * Dedicated paid-entitlement store.
 *
 * Firestore collection: payment_entitlements/<uid>
 *
 * This is deliberately separate from the ordinary users/<uid> profile.
 * Theme choices, notification preferences, profile edits, and app
 * republishes must never be able to create, erase, shorten, or reinterpret
 * a paid subscription. The users document receives a read-model mirror
 * only after the payment entitlement itself is durable in Firestore.
 *
 * Fail-closed contract: every read/write here uses Firestore directly and
 * throws PaymentStoreUnavailableError if Firestore cannot confirm the
 * operation. There is NO local-JSON fallback for payment entitlement.
 */
import { adminDb } from './firebase.js';
import {
  PaymentOrderOwnershipError,
  runPaymentStore,
} from './paymentStore.js';
import {
  getGrantedOrdersForUser,
  type PaymentOrder,
} from './paymentOrdersDao.js';
import {
  getUserProfile,
  invalidateUserProfileCache,
  saveUserProfile,
} from './usersDao.js';
import {
  calculateGrantExpiry,
  deriveEntitlementFromOrders,
  deriveEntitlementFromProfile,
  mergePaymentEntitlementCandidates,
  normalizePaymentEntitlement,
  paymentEntitlementEquals,
  type PaymentEntitlement,
} from '../services/paymentEntitlementLogic.js';

export type { PaymentEntitlement } from '../services/paymentEntitlementLogic.js';
export {
  deriveEntitlementFromOrders,
  deriveEntitlementFromProfile,
  mergePaymentEntitlementCandidates,
} from '../services/paymentEntitlementLogic.js';

const COLLECTION = 'payment_entitlements';
const USERS_COLLECTION = 'users';
const ORDERS_COLLECTION = 'payment_orders';

function entitlementRef(uid: string) {
  return adminDb.collection(COLLECTION).doc(uid);
}

function userRef(uid: string) {
  return adminDb.collection(USERS_COLLECTION).doc(uid);
}

function orderRef(orderId: string) {
  return adminDb.collection(ORDERS_COLLECTION).doc(orderId);
}

export async function getPaymentEntitlement(uid: string): Promise<PaymentEntitlement | null> {
  if (!uid) return null;
  const snap = await runPaymentStore('read payment entitlement', entitlementRef(uid).get(), 10_000);
  if (!snap.exists) return null;
  return normalizePaymentEntitlement(uid, snap.data() as Partial<PaymentEntitlement>);
}

async function mirrorEntitlementToProfile(
  entitlement: PaymentEntitlement,
  knownProfile?: Awaited<ReturnType<typeof getUserProfile>>,
): Promise<boolean> {
  const profile = knownProfile ?? (await getUserProfile(entitlement.uid, { durable: true }).catch(() => null));
  const matches =
    profile &&
    Number(profile.proExpiresAt || 0) === entitlement.proExpiresAt &&
    String(profile.proPlanId || '') === entitlement.proPlanId &&
    Number(profile.lastPaymentAt || 0) === entitlement.lastPaymentAt &&
    String(profile.lastOrderId || '') === entitlement.lastOrderId &&
    (profile.tier === 'admin' || profile.tier === 'pro');

  if (matches) return false;

  const patch: Record<string, unknown> = {
    proExpiresAt: entitlement.proExpiresAt,
    proPlanId: entitlement.proPlanId,
    lastPaymentAt: entitlement.lastPaymentAt,
    lastOrderId: entitlement.lastOrderId,
    maxWatchlistStocks: 9999,
  };
  // Never demote an admin/owner account while mirroring payment data.
  if (profile?.tier !== 'admin') patch.tier = 'pro';

  await saveUserProfile(entitlement.uid, patch as any, true, { durable: true });
  invalidateUserProfileCache(entitlement.uid);
  return true;
}

/**
 * Reconcile the dedicated entitlement from every durable source:
 *   1. payment_entitlements/<uid>
 *   2. granted payment_orders for this uid
 *   3. legacy paid fields on users/<uid> (bridge for pre-isolation users)
 *
 * The furthest expiry wins. Any missing dedicated record or stale profile
 * mirror is repaired in Firestore. Local JSON is never consulted.
 */
export async function reconcilePaymentEntitlement(uid: string): Promise<{
  entitlement: PaymentEntitlement | null;
  repaired: boolean;
}> {
  const [existing, grantedOrders, profile] = await Promise.all([
    getPaymentEntitlement(uid),
    getGrantedOrdersForUser(uid),
    getUserProfile(uid, { durable: true }).catch(() => null),
  ]);

  const merged = mergePaymentEntitlementCandidates(uid, [
    existing,
    deriveEntitlementFromOrders(uid, grantedOrders),
    deriveEntitlementFromProfile(uid, profile),
  ]);

  if (!merged) return { entitlement: null, repaired: false };

  let repaired = false;
  if (!existing || !paymentEntitlementEquals(existing, merged)) {
    const durable: PaymentEntitlement = {
      ...merged,
      // Preserve the stronger original provenance when the fields already
      // came from an atomic grant.
      source: existing && paymentEntitlementEquals(existing, merged) ? existing.source : merged.source,
      updatedAt: Date.now(),
    };
    await runPaymentStore(
      'repair payment entitlement',
      entitlementRef(uid).set(durable, { merge: true }),
      12_000,
    );
    repaired = true;
    const profileRepaired = await mirrorEntitlementToProfile(durable, profile);
    return { entitlement: durable, repaired: repaired || profileRepaired };
  }

  const profileRepaired = await mirrorEntitlementToProfile(existing, profile);
  return { entitlement: existing, repaired: profileRepaired };
}

export interface AtomicPaymentGrantInput {
  orderId: string;
  uid: string;
  email: string;
  planId: string;
  validityDays: number;
  amountPaise: number;
  currency: string;
  paidAt?: number;
  grantSource: NonNullable<PaymentOrder['grantSource']>;
}

export interface AtomicPaymentGrantResult {
  proExpiresAt: number;
  alreadyGranted: boolean;
  entitlement: PaymentEntitlement;
}

/**
 * Grant Pro atomically in ONE Firestore transaction:
 *   - payment_orders/<orderId> claim + granted state
 *   - payment_entitlements/<uid> durable entitlement
 *   - users/<uid> compatibility mirror
 *
 * Concurrent webhook/verify/recover/claim calls for the same order see
 * status=granted and return the same expiry without extending twice.
 * A previous attempt left in `granting` by a crash is safely taken over.
 * If Firestore cannot commit all three writes, none is reported as done.
 */
export async function grantPaymentAtomically(
  input: AtomicPaymentGrantInput,
): Promise<AtomicPaymentGrantResult> {
  const result = await runPaymentStore(
    'grant payment entitlement',
    adminDb.runTransaction(async (tx: any) => {
      const oRef = orderRef(input.orderId);
      const eRef = entitlementRef(input.uid);
      const uRef = userRef(input.uid);

      const [orderSnap, entitlementSnap, userSnap] = await Promise.all([
        tx.get(oRef),
        tx.get(eRef),
        tx.get(uRef),
      ]);

      const order = orderSnap.exists ? (orderSnap.data() as PaymentOrder) : null;
      if (order?.uid && order.uid !== input.uid) {
        throw new PaymentOrderOwnershipError(input.orderId);
      }

      const existingEntitlement = entitlementSnap.exists
        ? normalizePaymentEntitlement(input.uid, entitlementSnap.data() as Partial<PaymentEntitlement>)
        : null;
      const user = userSnap.exists ? (userSnap.data() as any) : null;
      const now = Date.now();
      const paidAt = Number(input.paidAt || order?.paidAt || now);

      const buildEntitlement = (
        proExpiresAt: number,
        source: PaymentEntitlement['source'],
      ): PaymentEntitlement => ({
        uid: input.uid,
        proExpiresAt,
        proPlanId: input.planId,
        lastPaymentAt: paidAt,
        lastOrderId: input.orderId,
        grantedOrderIds: [
          ...new Set([
            ...((existingEntitlement?.grantedOrderIds || []) as string[]),
            ...(order?.status === 'granted' ? [input.orderId] : []),
            input.orderId,
          ]),
        ].slice(-200),
        updatedAt: now,
        source,
      });

      const mirrorUser = (entitlement: PaymentEntitlement) => {
        const patch: Record<string, unknown> = {
          uid: input.uid,
          proExpiresAt: entitlement.proExpiresAt,
          proPlanId: entitlement.proPlanId,
          lastPaymentAt: entitlement.lastPaymentAt,
          lastOrderId: entitlement.lastOrderId,
          maxWatchlistStocks: 9999,
        };
        if (user?.tier !== 'admin') patch.tier = 'pro';
        tx.set(uRef, patch, { merge: true });
      };

      if (order?.status === 'granted') {
        const expiry = Number(
          order.proExpiresAt || existingEntitlement?.proExpiresAt || user?.proExpiresAt || now,
        );
        const entitlement: PaymentEntitlement = existingEntitlement
          ? {
              ...existingEntitlement,
              proExpiresAt: Math.max(Number(existingEntitlement.proExpiresAt || 0), expiry),
              grantedOrderIds: [
                ...new Set([
                  ...((existingEntitlement.grantedOrderIds || []) as string[]),
                  input.orderId,
                ]),
              ].slice(-200),
              updatedAt: now,
            }
          : buildEntitlement(expiry, 'ledger-repair');

        tx.set(eRef, entitlement, { merge: true });
        mirrorUser(entitlement);
        return {
          proExpiresAt: entitlement.proExpiresAt,
          alreadyGranted: true,
          entitlement,
        } satisfies AtomicPaymentGrantResult;
      }

      // Once a dedicated entitlement exists, trial/profile expiry must not
      // become an accidental second paid balance. For a first-ever grant,
      // the profile expiry preserves the existing rule that an active trial
      // is extended rather than discarded.
      const currentPaidExpiry = existingEntitlement
        ? Number(existingEntitlement.proExpiresAt || 0)
        : Number(user?.proExpiresAt || 0);
      const proExpiresAt = calculateGrantExpiry(now, currentPaidExpiry, input.validityDays);
      const entitlement = buildEntitlement(proExpiresAt, 'grant');

      const orderPatch: Partial<PaymentOrder> = {
        orderId: input.orderId,
        uid: input.uid,
        email: input.email || order?.email || user?.email || '',
        planId: input.planId,
        amountPaise: input.amountPaise,
        currency: input.currency,
        status: 'granted',
        createdAt: Number(order?.createdAt || now),
        updatedAt: now,
        grantedAt: Number(order?.grantedAt || now),
        paidAt,
        proExpiresAt,
        grantSource: input.grantSource,
      };

      tx.set(oRef, orderPatch, { merge: true });
      tx.set(eRef, entitlement, { merge: true });
      mirrorUser(entitlement);

      return {
        proExpiresAt,
        alreadyGranted: false,
        entitlement,
      } satisfies AtomicPaymentGrantResult;
    }),
    15_000,
  );

  invalidateUserProfileCache(input.uid);
  return result;
}
