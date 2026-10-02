-- ============================================================
-- 003: payment tables reshaped to the app's real record shapes
-- (001's simplified columns did not match PaymentOrder/PaymentEntitlement)
-- Tables are still EMPTY (no app data migrated yet) → safe to recreate.
-- Run: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

-- ---------- payment_orders: full ledger shape ----------
drop table if exists payment_orders;

create table payment_orders (
  order_id text primary key,
  uid text not null references users(uid) on delete cascade,
  email text not null default '',
  plan_id text not null default '',
  amount_paise bigint not null default 0,
  currency text not null default 'INR',
  status text not null default 'pending'
    check (status in ('pending', 'granting', 'granted', 'failed')),
  created_at bigint not null,
  updated_at bigint not null,
  granted_at bigint,
  paid_at bigint,
  pro_expires_at bigint,
  grant_source text,
  last_error text
);
create index payment_orders_uid_idx on payment_orders (uid);

-- ---------- payment_entitlements: authoritative paid record ----------
drop table if exists payment_entitlements;

create table payment_entitlements (
  uid text primary key references users(uid) on delete cascade,
  pro_expires_at bigint not null,
  pro_plan_id text not null default 'pro_monthly',
  last_payment_at bigint not null default 0,
  last_order_id text not null default '',
  granted_order_ids jsonb not null default '[]',
  updated_at bigint not null,
  source text not null default 'grant'
);
-- NOTE: the old 001 grant_payment_atomic (simplified, wrong columns) is
-- replaced below by the full version.

alter table payment_orders enable row level security;
alter table payment_entitlements enable row level security;
-- No permissive policies: only service_role (server) bypasses RLS.

-- ---------- helper: make sure a users row exists (skeleton) ----------
create or replace function ensure_user_skeleton(p_uid text, p_now bigint)
returns void
language plpgsql
security definer
as $$
begin
  insert into users (uid, tier, created_at, last_login_at)
  values (p_uid, 'free', p_now, p_now)
  on conflict (uid) do nothing;
end $$;

-- ---------- atomic grant: order claim + entitlement + user mirror ----------
-- Faithful port of the old Firestore transaction in
-- server/database/paymentEntitlementsDao.ts grantPaymentAtomically().
-- Concurrent webhook/verify/recover/claim calls for the same order see
-- status='granted' and return the same expiry without extending twice.
create or replace function grant_payment_atomic(
  p_order_id text, p_uid text, p_email text, p_plan_id text,
  p_validity_days int, p_amount_paise bigint, p_currency text,
  p_paid_at bigint, p_grant_source text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_order payment_orders%rowtype;
  v_ent payment_entitlements%rowtype;
  v_user_tier text;
  v_user_pro_expires bigint;
  v_paid_at bigint;
  v_current_paid_expiry bigint;
  v_pro_expires_at bigint;
  v_already_granted boolean := false;
  v_source text := 'grant';
  v_order_ids jsonb;
begin
  perform ensure_user_skeleton(p_uid, v_now);

  -- Lock the order row; create the reconciliation skeleton if it predates
  -- the durable ledger (mirrors the old tx.set(..., 'granting') path).
  select * into v_order from payment_orders where order_id = p_order_id for update;
  if not found then
    insert into payment_orders
      (order_id, uid, email, plan_id, amount_paise, currency, status, created_at, updated_at)
    values
      (p_order_id, p_uid, coalesce(p_email, ''), coalesce(p_plan_id, ''),
       coalesce(p_amount_paise, 0), coalesce(p_currency, 'INR'),
       'granting', v_now, v_now)
    returning * into v_order;
  end if;

  if v_order.uid <> p_uid then
    raise exception 'OWNERSHIP:%', p_order_id;
  end if;

  select * into v_ent from payment_entitlements where uid = p_uid for update;
  select tier, pro_expires_at into v_user_tier, v_user_pro_expires
    from users where uid = p_uid;

  v_paid_at := coalesce(nullif(p_paid_at, 0), v_order.paid_at, v_now);

  if v_order.status = 'granted' then
    -- Idempotent re-grant: same expiry, never extended twice.
    v_already_granted := true;
    v_pro_expires_at := greatest(
      coalesce(v_order.pro_expires_at, 0),
      coalesce(v_ent.pro_expires_at, 0),
      coalesce(v_user_pro_expires, 0),
      v_now
    );
    if v_ent.uid is not null then
      v_order_ids := coalesce(v_ent.granted_order_ids, '[]'::jsonb);
      if not (v_order_ids ? p_order_id) then
        v_order_ids := v_order_ids || to_jsonb(p_order_id);
      end if;
      -- keep the last 200 order ids, like the old code
      if jsonb_array_length(v_order_ids) > 200 then
        v_order_ids := (
          select jsonb_agg(x) from (
            select x from jsonb_array_elements_text(v_order_ids) as x
            order by 1 desc limit 200
          ) s
        );
      end if;
      update payment_entitlements set
        pro_expires_at = greatest(v_ent.pro_expires_at, v_pro_expires_at),
        granted_order_ids = v_order_ids,
        updated_at = v_now
      where uid = p_uid
      returning * into v_ent;
      v_pro_expires_at := v_ent.pro_expires_at;
    else
      insert into payment_entitlements
        (uid, pro_expires_at, pro_plan_id, last_payment_at, last_order_id,
         granted_order_ids, updated_at, source)
      values
        (p_uid, v_pro_expires_at, p_plan_id, v_paid_at, p_order_id,
         jsonb_build_array(p_order_id), v_now, 'ledger-repair')
      returning * into v_ent;
    end if;
  else
    -- Fresh grant. Once a dedicated entitlement exists, trial/profile
    -- expiry must not become an accidental second paid balance.
    v_current_paid_expiry := coalesce(v_ent.pro_expires_at, v_user_pro_expires, 0);
    v_pro_expires_at :=
      greatest(v_now, v_current_paid_expiry) + (p_validity_days::bigint * 86400000);

    v_order_ids := coalesce(v_ent.granted_order_ids, '[]'::jsonb);
    if not (v_order_ids ? p_order_id) then
      v_order_ids := v_order_ids || to_jsonb(p_order_id);
    end if;
    if jsonb_array_length(v_order_ids) > 200 then
      v_order_ids := (
        select jsonb_agg(x) from (
          select x from jsonb_array_elements_text(v_order_ids) as x
          order by 1 desc limit 200
        ) s
      );
    end if;

    update payment_orders set
      uid = p_uid,
      email = coalesce(nullif(p_email, ''), email),
      plan_id = p_plan_id,
      amount_paise = p_amount_paise,
      currency = p_currency,
      status = 'granted',
      updated_at = v_now,
      granted_at = coalesce(granted_at, v_now),
      paid_at = v_paid_at,
      pro_expires_at = v_pro_expires_at,
      grant_source = p_grant_source
    where order_id = p_order_id;

    insert into payment_entitlements
      (uid, pro_expires_at, pro_plan_id, last_payment_at, last_order_id,
       granted_order_ids, updated_at, source)
    values
      (p_uid, v_pro_expires_at, p_plan_id, v_paid_at, p_order_id,
       v_order_ids, v_now, 'grant')
    on conflict (uid) do update set
      pro_expires_at = excluded.pro_expires_at,
      pro_plan_id = excluded.pro_plan_id,
      last_payment_at = excluded.last_payment_at,
      last_order_id = excluded.last_order_id,
      granted_order_ids = excluded.granted_order_ids,
      updated_at = excluded.updated_at,
      source = excluded.source
    returning * into v_ent;
  end if;

  -- users/<uid> compatibility mirror (never demote an admin).
  update users set
    pro_expires_at = v_ent.pro_expires_at,
    pro_plan_id = v_ent.pro_plan_id,
    last_payment_at = v_ent.last_payment_at,
    last_order_id = v_ent.last_order_id,
    max_watchlist_stocks = 9999,
    tier = case when tier = 'admin' then 'admin' else 'pro' end
  where uid = p_uid;

  return jsonb_build_object(
    'pro_expires_at', v_ent.pro_expires_at,
    'already_granted', v_already_granted,
    'entitlement', jsonb_build_object(
      'uid', v_ent.uid,
      'proExpiresAt', v_ent.pro_expires_at,
      'proPlanId', v_ent.pro_plan_id,
      'lastPaymentAt', v_ent.last_payment_at,
      'lastOrderId', v_ent.last_order_id,
      'grantedOrderIds', v_ent.granted_order_ids,
      'updatedAt', v_ent.updated_at,
      'source', v_ent.source
    )
  );
end $$;

-- ---------- record a pending order (idempotent, never resurrects) ----------
create or replace function record_pending_order_atomic(
  p_order_id text, p_uid text, p_email text, p_plan_id text,
  p_amount_paise bigint, p_currency text
) returns void
language plpgsql
security definer
as $$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  perform ensure_user_skeleton(p_uid, v_now);
  insert into payment_orders
    (order_id, uid, email, plan_id, amount_paise, currency,
     status, created_at, updated_at)
  values
    (p_order_id, p_uid, p_email, p_plan_id, p_amount_paise,
     coalesce(p_currency, 'INR'), 'pending', v_now, v_now)
  on conflict (order_id) do update set
    uid = excluded.uid,
    email = excluded.email,
    plan_id = excluded.plan_id,
    amount_paise = excluded.amount_paise,
    currency = excluded.currency,
    status = 'pending',
    updated_at = excluded.updated_at
  -- Never resurrect or downgrade a resolved/in-flight order.
  where payment_orders.status not in ('granted', 'granting');
end $$;

-- ---------- claim an order for grant (non-atomic callers) ----------
create or replace function claim_order_for_grant(
  p_order_id text, p_uid text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_order payment_orders%rowtype;
begin
  perform ensure_user_skeleton(p_uid, v_now);

  select * into v_order from payment_orders where order_id = p_order_id for update;

  if found then
    if v_order.uid <> p_uid then
      raise exception 'OWNERSHIP:%', p_order_id;
    end if;
    if v_order.status = 'granted' then
      return jsonb_build_object('ok', false, 'reason', 'already-granted');
    end if;
    update payment_orders
    set status = 'granting', uid = p_uid, updated_at = v_now
    where order_id = p_order_id;
  else
    -- Order predates the durable ledger: create its reconciliation row in
    -- `granting` so concurrent grants serialize on the row lock.
    insert into payment_orders
      (order_id, uid, email, plan_id, amount_paise, currency,
       status, created_at, updated_at)
    values
      (p_order_id, p_uid, '', '', 0, 'INR', 'granting', v_now, v_now);
  end if;

  return jsonb_build_object('ok', true);
end $$;
