/**
 * Payment order ledger — the durable record of every Pro purchase attempt.
 *
 * Why this exists (27 Sep 2026): a ₹199 payment was captured by Cashfree but
 * the Pro grant only reached the ephemeral local JSON (Firestore was
 * unavailable at the time) and was wiped by the next republish. The user's
 * profile in Firestore never showed any payment fields.
 *
 * Rules:
 * - Every order is recorded as `pending` at creation time (BEFORE payment).
 * - The grant paths (webhook / verify / recover / claim) move it to
 *   `granting` (atomic, cross-instance) and then `granted`.
 * - Orders that end in a terminal non-paid state become `failed` so login
 *   recovery stops re-checking them.
 * - Firestore is the durable store; the local JSON file is a best-effort
 *   fallback (same pattern as usersDao). Nothing here trusts the client.
 */
import { adminDb } from './firebase.js';
import {
  readLocalJson,
  writeLocalJson,
  isFirestoreQuotaExceeded,
  setFirestoreQuotaExceeded,
  isQuotaError,
  isPermissionDeniedError,
  setAdminPermissionDenied,
  isAdminPermissionDenied,
} from './localStore.js';

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
  proExpiresAt?: number;
  grantSource?: 'webhook' | 'verify' | 'recover' | 'claim';
  lastError?: string;
}

const ORDERS_FILE = 'payment_orders.json';
const COLLECTION = 'payment_orders';

function firestoreUsable(): boolean {
  return !isFirestoreQuotaExceeded() && !isAdminPermissionDenied();
}

function noteFirestoreError(err: any, context: string): void {
  if (isQuotaError(err)) {
    setFirestoreQuotaExceeded(true);
    console.warn(`[PaymentOrders] Firestore quota exceeded during ${context}. Using local fallback.`);
  } else if (isPermissionDeniedError(err)) {
    setAdminPermissionDenied(true);
    console.warn(`[PaymentOrders] Firestore permission denied during ${context}. Using local fallback.`);
  } else {
    console.warn(`[PaymentOrders] Firestore error during ${context}:`, err?.message || err);
  }
}

/** Race a promise against a timeout so a stalled Firestore read never hangs the caller. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

function readLocalOrders(): Record<string, PaymentOrder> {
  try {
    return readLocalJson<Record<string, PaymentOrder>>(ORDERS_FILE, {});
  } catch {
    return {};
  }
}

function writeLocalOrder(order: PaymentOrder): void {
  try {
    const map = readLocalOrders();
    map[order.orderId] = order;
    writeLocalJson(ORDERS_FILE, map);
  } catch (err) {
    console.warn('[PaymentOrders] local write failed:', (err as Error)?.message || err);
  }
}

/**
 * Record a new order as pending. Best-effort: the Cashfree order creation
 * must never fail just because the ledger write failed.
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
  // Local first — always available.
  writeLocalOrder(order);
  if (!firestoreUsable()) return;
  try {
    await withTimeout(
      adminDb.collection(COLLECTION).doc(order.orderId).set(order, { merge: true }),
      8000,
    );
  } catch (err: any) {
    noteFirestoreError(err, 'recordPendingOrder');
  }
}

/** Fetch one order by id — Firestore first, local fallback. */
export async function getPaymentOrder(orderId: string): Promise<PaymentOrder | null> {
  if (!orderId) return null;
  if (firestoreUsable()) {
    try {
      const snap = await withTimeout(adminDb.collection(COLLECTION).doc(orderId).get(), 8000);
      if (snap && snap.exists) {
        return snap.data() as PaymentOrder;
      }
    } catch (err: any) {
      noteFirestoreError(err, 'getPaymentOrder');
    }
  }
  return readLocalOrders()[orderId] || null;
}

/**
 * All not-yet-resolved orders for a user (pending or mid-grant).
 * Used by login-time recovery. Firestore is queried by uid only (no
 * composite index needed) and status is filtered in code; local orders
 * are merged in so nothing is missed in local-fallback mode.
 */
export async function getPendingOrdersForUser(uid: string): Promise<PaymentOrder[]> {
  const byId = new Map<string, PaymentOrder>();
  // Local first — always available.
  for (const o of Object.values(readLocalOrders())) {
    if (o.uid === uid && (o.status === 'pending' || o.status === 'granting')) {
      byId.set(o.orderId, o);
    }
  }
  if (firestoreUsable()) {
    try {
      const snap = await withTimeout(
        adminDb.collection(COLLECTION).where('uid', '==', uid).get(),
        8000,
      );
      if (snap) {
        snap.forEach((doc: any) => {
          const o = doc.data() as PaymentOrder;
          if (o && (o.status === 'pending' || o.status === 'granting')) {
            byId.set(o.orderId, o);
          } else if (o && byId.has(o.orderId)) {
            // Firestore has the final word: a resolved order is not pending.
            byId.delete(o.orderId);
          }
        });
      }
    } catch (err: any) {
      noteFirestoreError(err, 'getPendingOrdersForUser');
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Atomically claim an order for granting (pending -> granting).
 * Cross-instance safe via a Firestore transaction; falls back to a
 * local check-and-set when Firestore is unavailable (single instance).
 *
 * Returns { ok: true } when this caller won the claim, or
 * { ok: false, reason: 'already-granted' } when the order resolved already.
 */
export async function tryClaimOrderForGrant(
  orderId: string,
  uid: string,
): Promise<{ ok: boolean; reason?: 'already-granted' }> {
  if (firestoreUsable()) {
    try {
      const result = await withTimeout(
        adminDb.runTransaction(async (tx: any) => {
          const ref = adminDb.collection(COLLECTION).doc(orderId);
          const snap = await tx.get(ref);
          const existing = snap.exists ? (snap.data() as PaymentOrder) : null;
          if (existing?.status === 'granted') {
            return { ok: false as const, reason: 'already-granted' as const };
          }
          const now = Date.now();
          if (existing) {
            tx.set(ref, { status: 'granting', updatedAt: now }, { merge: true });
          } else {
            // Order predates the ledger (e.g. created before this shipped):
            // create the doc in `granting` so concurrent grants serialize.
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
            } as PaymentOrder);
          }
          return { ok: true as const };
        }),
        10000,
      );
      if (result) {
        if (result.ok) {
          // Best-effort local marker so single-instance mode also serializes.
          const prev = readLocalOrders()[orderId];
          writeLocalOrder({
            orderId,
            uid,
            email: prev?.email || '',
            planId: prev?.planId || '',
            amountPaise: prev?.amountPaise || 0,
            currency: prev?.currency || 'INR',
            status: 'granting',
            createdAt: prev?.createdAt || Date.now(),
            updatedAt: Date.now(),
          });
        }
        return result;
      }
      // Timed out — fall through to local claim.
    } catch (err: any) {
      noteFirestoreError(err, 'tryClaimOrderForGrant');
    }
  }
  // Local fallback (single instance): serialize via the in-memory grant lock
  // in payments.ts; this is only a best-effort marker.
  const local = readLocalOrders()[orderId];
  if (local?.status === 'granted') {
    return { ok: false, reason: 'already-granted' };
  }
  writeLocalOrder({
    orderId,
    uid,
    email: local?.email || '',
    planId: local?.planId || '',
    amountPaise: local?.amountPaise || 0,
    currency: local?.currency || 'INR',
    status: 'granting',
    createdAt: local?.createdAt || Date.now(),
    updatedAt: Date.now(),
  });
  return { ok: true };
}

/** Mark an order granted (durable). Called AFTER the profile grant succeeds. */
export async function markOrderGranted(
  orderId: string,
  info: { uid: string; proExpiresAt: number; grantSource: PaymentOrder['grantSource']; email?: string; planId?: string; amountPaise?: number },
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

  const local = readLocalOrders()[orderId];
  writeLocalOrder({ ...(local || { orderId, createdAt: now, currency: 'INR' } as PaymentOrder), ...patch } as PaymentOrder);

  if (!firestoreUsable()) return;
  try {
    await withTimeout(
      adminDb.collection(COLLECTION).doc(orderId).set(patch, { merge: true }),
      8000,
    );
  } catch (err: any) {
    noteFirestoreError(err, 'markOrderGranted');
  }
}

/**
 * Mark an order failed (terminal non-paid state: expired / cancelled /
 * user-dropped). Login recovery will stop re-checking it with Cashfree.
 */
export async function markOrderFailed(orderId: string, lastError: string): Promise<void> {
  const now = Date.now();
  const patch: Partial<PaymentOrder> = { status: 'failed', updatedAt: now, lastError: lastError.slice(0, 300) };
  const local = readLocalOrders()[orderId];
  writeLocalOrder({ ...(local || { orderId, createdAt: now, currency: 'INR' } as PaymentOrder), ...patch } as PaymentOrder);
  if (!firestoreUsable()) return;
  try {
    await withTimeout(
      adminDb.collection(COLLECTION).doc(orderId).set(patch, { merge: true }),
      8000,
    );
  } catch (err: any) {
    noteFirestoreError(err, 'markOrderFailed');
  }
}
