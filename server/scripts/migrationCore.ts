/**
 * Shared Firestore -> Supabase migration core.
 *
 * Used by BOTH:
 *  - server/scripts/migrateFirestoreToSupabase.ts (terminal CLI), and
 *  - server/api/adminMigrate.ts (temporary phone-friendly admin endpoint).
 *
 * Row shapes match the new Supabase DAOs in server/database/* exactly.
 * Every write is an UPSERT on the table's primary key -> re-runs are safe.
 * Nothing is ever deleted from either side.
 */
import { adminDb } from '../database/firebase.js';
import { getSupabase } from '../database/supabase.js';

const BATCH = 500;

export interface MigrationPlan {
  firestore: string;
  table: string;
  pk: string;
  note?: string;
  map: (docId: string, d: any) => Record<string, any> | null;
}

const s = (v: any, fb = ''): string => (v == null ? fb : String(v));
const n = (v: any, fb = 0): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fb;
};
const b = (v: any): boolean => !!v;

export const PLANS: MigrationPlan[] = [
  {
    firestore: 'users',
    table: 'users',
    pk: 'uid',
    map: (docId, d) => ({
      uid: s(d.uid || docId),
      email: d.email ?? null,
      display_name: d.displayName ?? null,
      username: d.username ?? null,
      photo_url: d.photoURL ?? null,
      tier: d.tier || 'free',
      pro_expires_at: d.proExpiresAt ?? null,
      trial_used: b(d.trialUsed),
      free_summary_used: b(d.freeSummaryUsed),
      pro_plan_id: d.proPlanId ?? null,
      last_payment_at: d.lastPaymentAt ?? null,
      last_order_id: d.lastOrderId ?? null,
      telegram_chat_id: d.telegramChatId ?? null,
      telegram_username: d.telegramUsername ?? null,
      mute_in_app_notifications: b(d.muteInAppNotifications),
      notification_prefs: d.notificationPreferences ?? {},
      created_at: n(d.createdAt, Date.now()),
      last_login_at: n(d.lastLoginAt, Date.now()),
      max_watchlist_stocks: n(d.maxWatchlistStocks, 25),
    }),
  },
  {
    firestore: 'payment_orders',
    table: 'payment_orders',
    pk: 'order_id',
    map: (docId, d) => ({
      order_id: s(d.orderId || docId),
      uid: s(d.uid),
      email: d.email || '',
      plan_id: d.planId || '',
      amount_paise: n(d.amountPaise),
      currency: d.currency || 'INR',
      status: ['pending', 'granting', 'granted', 'failed'].includes(d.status) ? d.status : 'pending',
      created_at: n(d.createdAt, Date.now()),
      updated_at: n(d.updatedAt, Date.now()),
      granted_at: d.grantedAt ?? null,
      paid_at: d.paidAt ?? null,
      pro_expires_at: d.proExpiresAt ?? null,
      grant_source: d.grantSource ?? null,
      last_error: d.lastError ?? null,
    }),
  },
  {
    firestore: 'payment_entitlements',
    table: 'payment_entitlements',
    pk: 'uid',
    map: (docId, d) => ({
      uid: s(d.uid || docId),
      pro_expires_at: n(d.proExpiresAt),
      pro_plan_id: d.proPlanId || 'pro_monthly',
      last_payment_at: n(d.lastPaymentAt),
      last_order_id: s(d.lastOrderId),
      granted_order_ids: Array.isArray(d.grantedOrderIds) ? d.grantedOrderIds : [],
      updated_at: n(d.updatedAt, Date.now()),
      source: d.source || 'grant',
    }),
  },
  {
    firestore: 'user_watchlists',
    table: 'user_watchlists',
    pk: 'uid',
    map: (docId, d) => ({
      uid: s(d.uid || docId),
      lists: Array.isArray(d.lists) ? d.lists : [],
      updated_at: new Date(n(d.updatedAt, Date.now())).toISOString(),
    }),
  },
  {
    firestore: 'user_notes',
    table: 'user_notes',
    pk: 'id',
    note: 'flat collection; doc carries userId',
    map: (docId, d) => {
      const id = s(d.id || docId);
      if (!id || !d.userId) return null;
      return { id, user_id: s(d.userId), note: d };
    },
  },
  {
    firestore: 'alert_rules',
    table: 'alert_rules',
    pk: 'id',
    map: (docId, d) => {
      const id = s(d.id || docId);
      if (!id) return null;
      return { id, user_id: s(d.userId || 'system'), rule: d };
    },
  },
  {
    firestore: 'announcements',
    table: 'announcements',
    pk: 'id',
    map: (docId, d) => ({
      id: s(docId),
      scrip_cd: s(d.scrip_cd ?? d.scripCode),
      fetched_at: n(d.fetched_at),
      data: d ?? {},
    }),
  },
  {
    firestore: 'notifications',
    table: 'notifications',
    pk: 'id',
    map: (docId, d) => {
      const id = s(d.id || docId);
      if (!id || !d.title || !d.message) return null;
      return {
        id,
        user_id: s(d.userId || 'system'),
        title: s(d.title),
        message: s(d.message),
        type: s(d.type, 'info'),
        priority: s(d.priority, 'normal'),
        symbol: d.symbol ?? null,
        scrip_code: d.scripCode ?? null,
        news_id: d.newsId ?? null,
        pdf_link: d.pdfLink ?? null,
        timestamp: n(d.timestamp, Date.now()),
        is_read: b(d.isRead),
        is_watchlist: b(d.isWatchlist),
        metadata: d.metadata || {},
      };
    },
  },
  {
    firestore: 'feedback',
    table: 'feedback',
    pk: 'id',
    map: (docId, d) => ({ id: s(d.id || docId), data: d ?? {} }),
  },
  {
    firestore: 'settings',
    table: 'settings',
    pk: 'key',
    note: "old Firestore 'settings' collection -> settings table keyed by doc id",
    map: (docId, d) => ({ key: s(docId), value: d ?? {} }),
  },
  {
    firestore: 'logs',
    table: 'logs',
    pk: 'id',
    map: (docId, d) => ({ id: s(d.id || docId), data: d ?? {} }),
  },
  {
    firestore: 'auth_account_limits',
    table: 'auth_account_limits',
    pk: 'id',
    map: (docId, d) => ({ id: s(docId), data: d ?? {} }),
  },
  {
    firestore: 'sent_news_alerts',
    table: 'sent_news_alerts',
    pk: 'id',
    map: (docId, d) => ({
      id: s(docId).replace(/[^a-zA-Z0-9_\-]/g, '_'),
      data: { targetId: d.targetId, newsId: d.newsId, sentAt: d.sentAt },
    }),
  },
  {
    firestore: 'results_calendar',
    table: 'results_calendar',
    pk: 'id',
    map: (docId, d) => {
      const id = s(d.id || docId);
      if (!id) return null;
      return {
        id,
        scrip_code: s(d.scripCode),
        symbol: s(d.symbol),
        data: d ?? {},
      };
    },
  },
];

export interface CollectionResult {
  firestore: string;
  table: string;
  read: number;
  mapped: number;
  skipped: number;
  error?: string;
}

export interface ProgressEvent {
  type: 'collection' | 'batch' | 'done' | 'error';
  plan?: MigrationPlan;
  result?: CollectionResult;
  written?: number;
  total?: number;
  message?: string;
}

async function readAll(collection: string): Promise<{ id: string; data: any }[]> {
  const snap = await adminDb.collection(collection).get();
  const out: { id: string; data: any }[] = [];
  snap.forEach((doc: any) => out.push({ id: doc.id, data: doc.data() }));
  return out;
}

async function upsertBatch(
  table: string,
  pk: string,
  rows: Record<string, any>[],
  onBatch?: (written: number, total: number) => void,
) {
  const sb = getSupabase();
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await sb.from(table).upsert(chunk, { onConflict: pk });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
    onBatch?.(Math.min(i + BATCH, rows.length), rows.length);
  }
}

/** Read-only: count Firestore docs per collection and how many would map. */
export async function dryRunMigration(
  onEvent?: (e: ProgressEvent) => void,
): Promise<CollectionResult[]> {
  const results: CollectionResult[] = [];
  for (const plan of PLANS) {
    try {
      const docs = await readAll(plan.firestore);
      let mapped = 0;
      let skipped = 0;
      for (const { id, data } of docs) {
        try {
          if (plan.map(id, data)) mapped++;
          else skipped++;
        } catch {
          skipped++;
        }
      }
      const r = { firestore: plan.firestore, table: plan.table, read: docs.length, mapped, skipped };
      results.push(r);
      onEvent?.({ type: 'collection', plan, result: r });
    } catch (e: any) {
      const r = {
        firestore: plan.firestore,
        table: plan.table,
        read: 0,
        mapped: 0,
        skipped: 0,
        error: e?.message || String(e),
      };
      results.push(r);
      onEvent?.({ type: 'error', plan, result: r, message: r.error });
    }
  }
  onEvent?.({ type: 'done' });
  return results;
}

/** Full migration: read Firestore, upsert into Supabase. Idempotent. */
export async function runMigration(
  onEvent?: (e: ProgressEvent) => void,
): Promise<CollectionResult[]> {
  const results: CollectionResult[] = [];
  for (const plan of PLANS) {
    try {
      const docs = await readAll(plan.firestore);
      const rows: Record<string, any>[] = [];
      let skipped = 0;
      for (const { id, data } of docs) {
        try {
          const row = plan.map(id, data);
          if (row) rows.push(row);
          else skipped++;
        } catch {
          skipped++;
        }
      }
      if (rows.length > 0) {
        await upsertBatch(plan.table, plan.pk, rows, (written, total) =>
          onEvent?.({ type: 'batch', plan, written, total }),
        );
      }
      const r = { firestore: plan.firestore, table: plan.table, read: docs.length, mapped: rows.length, skipped };
      results.push(r);
      onEvent?.({ type: 'collection', plan, result: r });
    } catch (e: any) {
      const r = {
        firestore: plan.firestore,
        table: plan.table,
        read: 0,
        mapped: 0,
        skipped: 0,
        error: e?.message || String(e),
      };
      results.push(r);
      onEvent?.({ type: 'error', plan, result: r, message: r.error });
    }
  }
  onEvent?.({ type: 'done' });
  return results;
}

/** Count rows currently in each Supabase table. */
export async function getSupabaseCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const plan of PLANS) {
    try {
      const { count, error } = await getSupabase().from(plan.table).select('*', { count: 'exact', head: true });
      out[plan.table] = error ? -1 : (count ?? 0);
    } catch {
      out[plan.table] = -1;
    }
  }
  return out;
}
