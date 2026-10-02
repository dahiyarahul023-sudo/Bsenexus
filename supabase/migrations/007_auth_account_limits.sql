-- ============================================================
-- 007: auth_account_limits — distributed brute-force lockout state
-- (replaces the Firestore collection of the same name)
-- Run: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

create table if not exists auth_account_limits (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table auth_account_limits enable row level security;
-- No permissive policies: only service_role (server) bypasses RLS.
