/**
 * Payment order ledger — the durable record of every Pro purchase attempt.
 *
 * Why this exists (27 Sep 2026): a ₹199 payment was captured by Cashfree
 * but the user's profile in Firestore never showed any payment fields.
 * The exact loss mechanism was never proven — one plausible mechanism is
 * that the Pro grant only reached ephemeral local JSON (Firestore was
 * unavailable at the time) and was wiped by the next republish. Treat that
 * as a hypothesis, not a proven root cause.
 *
 * Payment-isolation rule (30 Sep 2026): this ledger is Firestore-only.
 * Local JSON is never authoritative for payments because Cloud Run local
 * files are revision-local and can be empty after a republish. If Firestore
 * cannot confirm a payment write, the operation fails closed with
 * PaymentStoreUnavailableError; Cashfree remains the payment gateway of
 * record and the webhook/recovery flow can safely retry later.
 */
import { adminDb } from './firebase.js';
import {
  PaymentOrderOwnershipError,
  runPaymentStore,
} from './paymentStore.js';

export type PaymentOrderStatus = 'pending' | 'granting' | 'granted' | 'failed';

export interface PaymentOrder {
  orderId: string;
  uid: string;
  email: string;
  planId: string;
  amountPaise: number;
  currency: string;
  status: PaymentOrderStatus;
  createdAt: number;
  updatedAt: number;
  grantedAt?: number;
  paidAt?: number;
  proExpiresAt?: number;
  grantSource?: 'webhook' | 'verify' | 'recover' | 'claim';
  lastError?: string;
}

const COLLECTION = 'payment_orders';

function orderRef(orderId: string) {
  return adminDb.collection(COLLECTION).doc(orderId);
}

function normalizeOrder(orderId: string, raw: any): PaymentOrder | null {
  if (!raw) return null;
  return {
    orderId: String(raw.orderId || orderId),
    uid: String(raw.uid || ''),
    email: String(raw.email || ''),
    planId: String(raw.planId || ''),
    amountPaise: Number(raw.amountPaise || 0),
    currency: String(raw.currency || 'INR'),
    status: (raw.status || 'pending') as PaymentOrderStatus,
    createdAt: Number(raw.createdAt || 0),
    updatedAt: Number(raw.updatedAt || raw.createdAt || 0),
    grantedAt: raw.grantedAt ? Number(raw.grantedAt) : undefined,
    paidAt: raw.paidAt ? Number(raw.paidAt) : undefined,
    proExpiresAt: raw.proExpiresAt ? Number(raw.proExpiresAt) : undefined,
    grantSource: raw.grantSource,
    lastError: raw.lastError ? String(raw.lastError).slice(0, 300) : undefined,
  };
}

/**
 * Record a new order as pending in Firestore BEFORE Cashfree checkout.
 * If this write cannot be durably confirmed, checkout must not start;
 * otherwise a paid order could exist at Cashfree with no reconciliation
 * trail owned by this server.
 */
export async function recordPendingOrder(input: {
  orderId: string;
  uid: string;
  email: string;
  planId: string;
  amountPaise: number;
  currency: string;
}): Promise<void> {
  const now = Date.now();
  const order: PaymentOrder = {
    ...input,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await runPaymentStore(
    'record pending payment order',
    adminDb.runTransaction(async (tx: any) => {
      const ref = orderRef(order.orderId);
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, order);
        return;
      }

      const existing = normalizeOrder(order.orderId, snap.data());
      if (!existing) {
        tx.set(ref, order);
        return;
      }
      // Never resurrect or downgrade a resolved order. A duplicate create
      // attempt for the same durable order id is an idempotent no-op.
      if (existing.status === 'granted' || existing.status === 'granting') return;
      tx.set(
        ref,
        {
          ...order,
          createdAt: existing.createdAt || order.createdAt,
        },
        { merge: true },
      );
    }),
    12_000,
  );
}

/** Fetch one durable order by id. Absence means Firestore has no such order. */
export async function getPaymentOrder(orderId: string): Promise<PaymentOrder | null> {
  if (!orderId) return null;
  const snap = await runPaymentStore('read payment order', orderRef(orderId).get(), 10_000);
  return snap.exists ? normalizeOrder(orderId, snap.data()) : null;
}

async function getOrdersForUser(uid: string): Promise<PaymentOrder[]> {
  const snap = await runPaymentStore(
    'list payment orders for user',
    adminDb.collection(COLLECTION).where('uid', '==', uid).get(),
    12_000,
  );
  const orders: PaymentOrder[] = [];
  snap.forEach((doc: any) => {
    const order = normalizeOrder(doc.id, doc.data());
    if (order && order.uid === uid) orders.push(order);
  });
  return orders;
}

/**
 * All not-yet-resolved durable orders for a user (pending or mid-grant).
 * A stale `granting` state is included so a crashed/timed-out grant can
 * be safely taken over by login recovery or a webhook retry.
 */
export async function getPendingOrdersForUser(uid: string): Promise<PaymentOrder[]> {
  const orders = await getOrdersForUser(uid);
  return orders
    .filter((o) => o.status === 'pending' || o.status === 'granting')
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * All COMPLETED (paid) orders for a user, newest first.
 * Powers Payment History — only `granted` durable ledger orders appear,
 * so a mere checkout attempt can never masquerade as a payment receipt.
 */
export async function getGrantedOrdersForUser(uid: string): Promise<PaymentOrder[]> {
  const orders = await getOrdersForUser(uid);
  return orders
    .filter((o) => o.status === 'granted')
    .sort((a, b) => (b.grantedAt || b.updatedAt) - (a.grantedAt || a.updatedAt));
}

/**
 * Claim a durable order for a non-atomic caller. The production grant
 * path uses grantPaymentAtomically(), which claims and grants inside one
 * Firestore transaction. This helper remains Firestore-only and therefore
 * cannot "succeed" through ephemeral local storage.
 */
export async function tryClaimOrderForGrant(
  orderId: string,
  uid: string,
): Promise<{ ok: boolean; reason?: 'already-granted' }> {
  return runPaymentStore(
    'claim payment order for grant',
    adminDb.runTransaction(async (tx: any) => {
      const ref = orderRef(orderId);
      const snap = await tx.get(ref);
      const existing = snap.exists ? normalizeOrder(orderId, snap.data()) : null;

      if (existing?.uid && existing.uid !== uid) {
        throw new PaymentOrderOwnershipError(orderId);
      }
      if (existing?.status === 'granted') {
        return { ok: false as const, reason: 'already-granted' as const };
      }

      const now = Date.now();
      if (existing) {
        tx.set(ref, { status: 'granting', uid, updatedAt: now }, { merge: true });
      } else {
        // Order predates the durable ledger: create its reconciliation doc
        // in `granting` so concurrent grants serialize in Firestore.
        tx.set(ref, {
          orderId,
          uid,
          email: '',
          planId: '',
          amountPaise: 0,
          currency: 'INR',
          status: 'granting',
          createdAt: now,
          updatedAt: now,
        } satisfies PaymentOrder);
      }
      return { ok: true as const };
    }),
    12_000,
  );
}

/** Mark an order granted in Firestore only. */
export async function markOrderGranted(
  orderId: string,
  info: {
    uid: string;
    proExpiresAt: number;
    grantSource: PaymentOrder['grantSource'];
    email?: string;
    planId?: string;
    amountPaise?: number;
    paidAt?: number;
  },
): Promise<void> {
  const now = Date.now();
  const patch: Partial<PaymentOrder> = {
    status: 'granted',
    updatedAt: now,
    grantedAt: now,
    proExpiresAt: info.proExpiresAt,
    grantSource: info.grantSource,
    uid: info.uid,
  };
  if (info.email !== undefined) patch.email = info.email;
  if (info.planId !== undefined) patch.planId = info.planId;
  if (info.amountPaise !== undefined) patch.amountPaise = info.amountPaise;
  if (info.paidAt !== undefined) patch.paidAt = info.paidAt;

  await runPaymentStore('mark payment order granted', orderRef(orderId).set(patch, { merge: true }), 10_000);
}

/**
 * Mark an order failed (terminal non-paid state: expired / cancelled /
 * user-dropped). Login recovery will stop re-checking it with Cashfree.
 */
export async function markOrderFailed(orderId: string, lastError: string): Promise<void> {
  const patch: Partial<PaymentOrder> = {
    status: 'failed',
    updatedAt: Date.now(),
    lastError: lastError.slice(0, 300),
  };
  await runPaymentStore('mark payment order failed', orderRef(orderId).set(patch, { merge: true }), 10_000);
}
