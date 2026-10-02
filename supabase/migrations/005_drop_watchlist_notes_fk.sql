-- ============================================================
-- 005: drop FKs that assume every uid has a users row.
-- user_watchlists is also written for the synthetic 'guest' uid, which
-- intentionally has no users row. user_notes is written for real
-- authenticated uids, but the app (like Firestore before it) manages
-- referential integrity in code. Payment tables keep their FKs because
-- their RPCs create skeleton user rows internally.
-- Run: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'user_watchlists_uid_fkey') then
    alter table user_watchlists drop constraint user_watchlists_uid_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'user_notes_user_id_fkey') then
    alter table user_notes drop constraint user_notes_user_id_fkey;
  end if;
end $$;
