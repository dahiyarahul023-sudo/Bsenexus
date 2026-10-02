/**
 * Firestore -> Supabase one-time data migration (Phase 1).
 *
 * Reads every Firestore collection the old server code used and upserts the
 * documents into the matching Supabase Postgres tables (same row shapes the
 * new DAOs in server/database/* expect).
 *
 * WHERE IT RUNS: this script needs BOTH
 *   1. Firebase Admin credentials (the AI Studio preview / Cloud Run env where
 *      the app already talks to Firestore), AND
 *   2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
 * Run it from the repo root in that environment:
 *   npx tsx server/scripts/migrateFirestoreToSupabase.ts --dry-run   # counts only
 *   npx tsx server/scripts/migrateFirestoreToSupabase.ts --apply     # migrates
 *   npx tsx server/scripts/migrateFirestoreToSupabase.ts --verify    # recount Supabase
 *
 * SAFETY:
 * - Every write is an UPSERT on the table's primary key -> re-running is safe
 *   and never duplicates rows.
 * - The script NEVER deletes anything from Supabase or Firestore.
 * - Payment tables are migrated as plain rows; the atomic grant functions
 *   already exist in the DB, so post-migration grants stay idempotent.
 */
import { adminDb } from '../database/firebase.js';
import { getSupabase, isSupabaseConfigured } from '../database/supabase.js';

const BATCH = 500;

interface Plan {
  firestore: string;
  table: string;
  pk: string;
  map: (docId: string, d: any) => Record<string, any> | null;
  note?: string;
}

const s = (v: any, fb = ''): string => (v == null ? fb : String(v));
const n = (v: any, fb = 0): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fb;
};
const b = (v: any): boolean => !!v;

const PLANS: Plan[] = [
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

async function readAll(collection: string): Promise<{ id: string; data: any }[]> {
  const snap = await adminDb.collection(collection).get();
  const out: { id: string; data: any }[] = [];
  snap.forEach((doc: any) => out.push({ id: doc.id, data: doc.data() }));
  return out;
}

async function upsertBatch(table: string, pk: string, rows: Record<string, any>[]) {
  const sb = getSupabase();
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await sb.from(table).upsert(chunk, { onConflict: pk });
    if (error) throw new Error(`upsert ${table} batch ${i / BATCH + 1}: ${error.message}`);
    console.log(`  ... ${Math.min(i + BATCH, rows.length)}/${rows.length} rows -> ${table}`);
  }
}

async function countSupabase(table: string): Promise<number> {
  const { count, error } = await getSupabase().from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const verifyOnly = args.includes('--verify');

  if (!isSupabaseConfigured()) {
    console.error('MISSING: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars not set. Set them first, then re-run.');
    process.exit(2);
  }

  if (verifyOnly) {
    console.log('== Supabase row counts ==');
    for (const p of PLANS) console.log(`  ${p.table}: ${await countSupabase(p.table)}`);
    return;
  }

  console.log(dryRun ? '== DRY RUN (counts only, nothing written) ==' : '== APPLY (upserting into Supabase) ==');

  const summary: { plan: Plan; read: number; mapped: number; skipped: number }[] = [];
  for (const plan of PLANS) {
    let docs: { id: string; data: any }[] = [];
    try {
      docs = await readAll(plan.firestore);
    } catch (e: any) {
      console.log(`- ${plan.firestore}: READ FAILED (${e?.message || e}) — skipped`);
      summary.push({ plan, read: 0, mapped: 0, skipped: 0 });
      continue;
    }
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
    console.log(`- ${plan.firestore}: read ${docs.length}, mapped ${rows.length}, skipped ${skipped} -> ${plan.table}`);
    if (!dryRun && rows.length > 0) await upsertBatch(plan.table, plan.pk, rows);
    summary.push({ plan, read: docs.length, mapped: rows.length, skipped });
  }

  if (!dryRun) {
    console.log('\n== Verify: Supabase row counts ==');
    for (const { plan, mapped } of summary) {
      const c = await countSupabase(plan.table);
      const mark = c >= mapped ? 'OK ' : 'LOW';
      console.log(`  [${mark}] ${plan.table}: ${c} rows (migrated ${mapped})`);
    }
  } else {
    console.log('\nDry run done. Re-run with --apply to migrate.');
  }
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e?.message || e);
  process.exit(1);
});
