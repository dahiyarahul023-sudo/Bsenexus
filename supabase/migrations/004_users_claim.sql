-- ============================================================
-- 004: users table — columns the DAO actually uses (missed in 001)
-- + atomic free-summary-demo claim
-- Run: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

alter table users add column if not exists username text;
alter table users add column if not exists mute_in_app_notifications boolean not null default false;

-- Usernames are unique case-insensitively (the DAO enforces this in code;
-- this is the DB-level backstop). Table is still empty pre-migration.
create unique index if not exists users_username_unique
  on users (lower(username)) where username is not null;

-- ---------- atomic one-time free AI summary demo claim ----------
-- INSERT-or-conditional-UPDATE in a single statement: exactly one caller
-- across all Cloud Run instances can win the claim.
-- Returns true if THIS call won (row inserted, or flipped false->true).
create or replace function claim_free_summary_demo(p_uid text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  insert into users (uid, free_summary_used, created_at, last_login_at)
  values (p_uid, true, v_now, v_now)
  on conflict (uid) do update
    set free_summary_used = true
    where users.free_summary_used = false;
  return found;
end $$;
