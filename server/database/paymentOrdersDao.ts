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
 * Payment-isolation rule (30 Sep 2026, kept for Supabase): this ledger is
 * durable-store-only. Local JSON is never authoritative for payments
 * because Cloud Run local files are revision-local and can be empty after
 * a republish. If Supabase cannot confirm a payment write, the operation
 * fails closed with PaymentStoreUnavailableError; Cashfree remains the
 * payment gateway of record and the webhook/recovery flow can safely
 * retry later.
 */
import { getSupabase } from './supabase.js';
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

const ORDERS_TABLE = 'payment_orders';

// --- Row mapping: camelCase app shape <-> snake_case Postgres columns ---
function toRow(o: PaymentOrder): Record<string, any> {
  return {
    order_id: o.orderId,
    uid: o.uid,
    email: o.email || '',
    plan_id: o.planId || '',
    amount_paise: o.amountPaise || 0,
    currency: o.currency || 'INR',
    status: o.status,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    granted_at: o.grantedAt ?? null,
    paid_at: o.paidAt ?? null,
    pro_expires_at: o.proExpiresAt ?? null,
    grant_source: o.grantSource ?? null,
    last_error: o.lastError ?? null,
  };
}

function fromRow(orderId: string, r: any): PaymentOrder | null {
  if (!r) return null;
  return {
    orderId: String(r.order_id || orderId),
    uid: String(r.uid || ''),
    email: String(r.email || ''),
    planId: String(r.plan_id || ''),
    amountPaise: Number(r.amount_paise || 0),
    currency: String(r.currency || 'INR'),
    status: (r.status || 'pending') as PaymentOrderStatus,
    createdAt: Number(r.created_at || 0),
    updatedAt: Number(r.updated_at || r.created_at || 0),
    grantedAt: r.granted_at != null ? Number(r.granted_at) : undefined,
    paidAt: r.paid_at != null ? Number(r.paid_at) : undefined,
    proExpiresAt: r.pro_expires_at != null ? Number(r.pro_expires_at) : undefined,
    grantSource: r.grant_source || undefined,
    lastError: r.last_error ? String(r.last_error).slice(0, 300) : undefined,
  };
}

/**
 * Call a Postgres function through the payment store. A Postgres
 * OWNERSHIP exception becomes PaymentOrderOwnershipError (a caller bug,
 * not a store outage) so runPaymentStore passes it through untouched.
 */
async function callPaymentRpc<T>(operation: string, fn: string, args: Record<string, any>, timeoutMs = 12_000): Promise<T> {
  return runPaymentStore(
    operation,
    (async () => {
      const { data, error } = await getSupabase().rpc(fn, args);
      if (error) {
        if (String(error.message || '').includes('OWNERSHIP:')) {
          throw new PaymentOrderOwnershipError(String(args.p_order_id || ''));
        }
        throw error;
      }
      return data as T;
    })(),
    timeoutMs,
  );
}

/**
 * Record a new order as pending in Supabase BEFORE Cashfree checkout.
 * If this write cannot be durably confirmed, checkout must not start;
 * otherwise a paid order could exist at Cashfree with no reconciliation
 * trail owned by this server. Atomic via record_pending_order_atomic:
 * a duplicate create for the same order id is an idempotent no-op and a
 * resolved order is never resurrected or downgraded.
 */
export async function recordPendingOrder(input: {
  orderId: string;
  uid: string;
  email: string;
  planId: string;
  amountPaise: number;
  currency: string;
}): Promise<void> {
  await callPaymentRpc('record pending payment order', 'record_pending_order_atomic', {
    p_order_id: input.orderId,
    p_uid: input.uid,
    p_email: input.email,
    p_plan_id: input.planId,
    p_amount_paise: input.amountPaise,
    p_currency: input.currency,
  });
}

/** Fetch one durable order by id. Absence means the store has no such order. */
export async function getPaymentOrder(orderId: string): Promise<PaymentOrder | null> {
  if (!orderId) return null;
  return runPaymentStore(
    'read payment order',
    (async () => {
      const { data, error } = await getSupabase()
        .from(ORDERS_TABLE)
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) throw error;
      return fromRow(orderId, data);
    })(),
    10_000,
  );
}

async function getOrdersForUser(uid: string): Promise<PaymentOrder[]> {
  const rows = await runPaymentStore(
    'list payment orders for user',
    (async () => {
      const { data, error } = await getSupabase()
        .from(ORDERS_TABLE)
        .select('*')
        .eq('uid', uid);
      if (error) throw error;
      return data || [];
    })(),
    12_000,
  );
  const orders: PaymentOrder[] = [];
  for (const row of rows) {
    const order = fromRow(row.order_id, row);
    if (order && order.uid === uid) orders.push(order);
  }
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
 * Postgres function. This helper remains durable-store-only and therefore
 * cannot "succeed" through ephemeral local storage. The claim serializes
 * on the order row lock inside claim_order_for_grant.
 */
export async function tryClaimOrderForGrant(
  orderId: string,
  uid: string,
): Promise<{ ok: boolean; reason?: 'already-granted' }> {
  const result = await callPaymentRpc<{ ok: boolean; reason?: 'already-granted' }>(
    'claim payment order for grant',
    'claim_order_for_grant',
    { p_order_id: orderId, p_uid: uid },
  );
  return { ok: !!result?.ok, reason: result?.reason };
}

/** Mark an order granted in the durable store only. */
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
  const patch: Record<string, any> = {
    status: 'granted',
    updated_at: now,
    granted_at: now,
    pro_expires_at: info.proExpiresAt,
    grant_source: info.grantSource,
    uid: info.uid,
  };
  if (info.email !== undefined) patch.email = info.email;
  if (info.planId !== undefined) patch.plan_id = info.planId;
  if (info.amountPaise !== undefined) patch.amount_paise = info.amountPaise;
  if (info.paidAt !== undefined) patch.paid_at = info.paidAt;

  await runPaymentStore(
    'mark payment order granted',
    (async () => {
      const { error } = await getSupabase().from(ORDERS_TABLE).update(patch).eq('order_id', orderId);
      if (error) throw error;
    })(),
    10_000,
  );
}

/**
 * Mark an order failed (terminal non-paid state: expired / cancelled /
 * user-dropped). Login recovery will stop re-checking it with Cashfree.
 */
export async function markOrderFailed(orderId: string, lastError: string): Promise<void> {
  const patch: Record<string, any> = {
    status: 'failed',
    updated_at: Date.now(),
    last_error: lastError.slice(0, 300),
  };
  await runPaymentStore(
    'mark payment order failed',
    (async () => {
      const { error } = await getSupabase().from(ORDERS_TABLE).update(patch).eq('order_id', orderId);
      if (error) throw error;
    })(),
    10_000,
  );
}
