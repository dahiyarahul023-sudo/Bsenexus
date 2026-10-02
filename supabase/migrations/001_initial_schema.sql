-- ============================================================
-- Bsenexus — Supabase initial schema (Phase 1: data layer)
-- Project: bsenexus / ap-south-1 (Mumbai)
-- Run: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run: all statements are IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ---------- users ----------
create table if not exists users (
  uid text primary key,                       -- Firebase UID (Phase 1: auth unchanged)
  email text,
  display_name text,
  photo_url text,
  tier text not null default 'free',
  pro_expires_at bigint,
  trial_used boolean not null default false,
  free_summary_used boolean not null default false,
  pro_plan_id text,
  last_payment_at bigint,
  last_order_id text,
  telegram_chat_id text,
  telegram_username text,
  notification_prefs jsonb not null default '{}',
  max_watchlist_stocks int not null default 25,
  created_at bigint not null,
  last_login_at bigint not null
);

-- ---------- user_watchlists ----------
create table if not exists user_watchlists (
  uid text primary key references users(uid) on delete cascade,
  lists jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ---------- announcements (filings) ----------
create table if not exists announcements (
  id text primary key,                        -- newsId
  scrip_code text not null,
  symbol text,
  company_name text not null,
  subject text not null,
  category text,
  filing_time timestamptz not null,
  pdf_url text,
  data jsonb not null default '{}'
);
create index if not exists announcements_scrip_time on announcements (scrip_code, filing_time desc);
create index if not exists announcements_time on announcements (filing_time desc);

-- ---------- results_calendar ----------
create table if not exists results_calendar (
  id text primary key,
  scrip_code text not null,
  symbol text,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create index if not exists results_calendar_scrip on results_calendar (scrip_code);

-- ---------- alert_rules ----------
create table if not exists alert_rules (
  id text primary key,
  user_id text not null references users(uid) on delete cascade,
  rule jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists alert_rules_user on alert_rules (user_id);

-- ---------- user_notes ----------
create table if not exists user_notes (
  id text primary key,
  user_id text not null references users(uid) on delete cascade,
  note jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists user_notes_user on user_notes (user_id);

-- ---------- payment_orders (durable ledger) ----------
create table if not exists payment_orders (
  order_id text primary key,
  uid text not null references users(uid),
  plan_id text not null,
  amount_paise int not null,
  currency text not null default 'INR',
  status text not null default 'PENDING',
  raw jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists payment_orders_uid on payment_orders (uid);

-- ---------- payment_entitlements (authoritative paid record) ----------
create table if not exists payment_entitlements (
  uid text primary key references users(uid),
  plan_id text not null,
  expires_at bigint not null,
  granted_at bigint not null,
  last_order_id text
);

-- ---------- sent_news_alerts ----------
create table if not exists sent_news_alerts (
  id text primary key,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- small system tables ----------
create table if not exists settings      (key text primary key, value jsonb not null);
create table if not exists system_config (key text primary key, value jsonb not null);
create table if not exists admins        (admin_id text primary key, data jsonb not null default '{}');
create table if not exists feedback      (id text primary key, data jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists logs          (id text primary key, data jsonb not null default '{}', created_at timestamptz not null default now());

-- ============================================================
-- RLS: server uses the service_role key, which bypasses RLS.
-- No permissive policies are created on purpose: the anon and
-- authenticated (browser) keys can read/write NOTHING.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','user_watchlists','announcements','results_calendar',
    'alert_rules','user_notes','payment_orders','payment_entitlements',
    'sent_news_alerts','settings','system_config','admins','feedback','logs'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ============================================================
-- Atomic payment grant (replaces the Firestore transaction).
-- Called from the server as: supabase.rpc('grant_payment_atomic', {...})
-- Farthest expiry wins; order row is idempotent on order_id.
-- ============================================================
create or replace function grant_payment_atomic(
  p_uid text, p_plan_id text, p_expires_at bigint,
  p_order_id text, p_amount_paise int
) returns jsonb
language plpgsql
security definer
as $$
declare v_current bigint;
begin
  select expires_at into v_current
  from payment_entitlements where uid = p_uid for update;

  if not found then
    insert into payment_entitlements (uid, plan_id, expires_at, granted_at, last_order_id)
    values (p_uid, p_plan_id, p_expires_at,
            (extract(epoch from now()) * 1000)::bigint, p_order_id);
  elsif p_expires_at > v_current then
    update payment_entitlements
    set plan_id = p_plan_id, expires_at = p_expires_at, last_order_id = p_order_id
    where uid = p_uid;
  end if;

  insert into payment_orders (order_id, uid, plan_id, amount_paise, status)
  values (p_order_id, p_uid, p_plan_id, p_amount_paise, 'PAID')
  on conflict (order_id) do update set status = 'PAID';

  return jsonb_build_object('ok', true);
end $$;
