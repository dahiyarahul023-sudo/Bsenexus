-- ============================================================
-- 002: notifications table (missed in 001 audit)
-- Run: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

create table if not exists notifications (
  id text primary key,
  user_id text not null default 'system',
  title text not null,
  message text not null,
  type text not null,
  priority text not null,
  symbol text,
  scrip_code text,
  news_id text,
  pdf_link text,
  timestamp bigint not null,
  is_read boolean not null default false,
  is_watchlist boolean not null default false,
  metadata jsonb not null default '{}'
);
create index if not exists notifications_user_time on notifications (user_id, timestamp desc);

alter table notifications enable row level security;
-- No permissive policies on purpose: anon/authenticated browser keys can
-- read/write NOTHING; only the service_role key (server) bypasses RLS.
