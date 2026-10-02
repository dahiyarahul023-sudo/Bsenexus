-- ============================================================
-- 006: announcements — whole-doc shape the DAO actually uses.
-- (001's guessed flat columns didn't match: the DAO filters on
-- fetched_at and scrip_cd and otherwise treats each filing as one
-- document.) Table is still EMPTY → safe to recreate.
-- Run: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

drop table if exists announcements;

create table announcements (
  id text primary key,          -- newsId
  scrip_cd text not null default '',
  fetched_at bigint not null default 0,
  data jsonb not null default '{}'
);
create index announcements_fetched_idx on announcements (fetched_at desc);
create index announcements_scrip_idx on announcements (scrip_cd);

alter table announcements enable row level security;
-- No permissive policies: only service_role (server) bypasses RLS.
