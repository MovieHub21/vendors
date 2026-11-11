-- SellSharp · 0400 · plans, subscriptions, payments (Paystack)
-- Money is always integer kobo (₦1 = 100 kobo).

create table if not exists public.subscription_plans (
  code          text primary key,
  name          text not null,
  price_kobo    integer not null check (price_kobo > 0),
  currency      text not null default 'NGN' check (currency = 'NGN'),
  interval_days integer not null check (interval_days > 0),
  is_active     boolean not null default true
);

insert into public.subscription_plans (code, name, price_kobo, interval_days)
values ('monthly', 'SellSharp Monthly', 300000, 30)
on conflict (code) do update
  set name = excluded.name, price_kobo = excluded.price_kobo, interval_days = excluded.interval_days;

create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null unique references auth.users (id) on delete cascade,
  plan_code            text not null references public.subscription_plans (code),
  status               text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  current_period_start timestamptz not null,
  current_period_end   timestamptz not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.payments (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references auth.users (id) on delete cascade,
  plan_code               text not null references public.subscription_plans (code),
  reference               text not null unique,
  amount_kobo             integer not null check (amount_kobo > 0),
  currency                text not null default 'NGN' check (currency = 'NGN'),
  status                  text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  paystack_transaction_id bigint,
  channel                 text,
  paid_at                 timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists payments_owner_id_idx on public.payments (owner_id, created_at desc);

-- Every webhook delivery is logged once (Paystack retries), which makes processing idempotent and auditable.
create table if not exists public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event        text not null,
  reference    text,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event, reference)
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Row level security: vendors may read their own billing rows; nothing is writable from the browser.
alter table public.subscription_plans enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.payments           enable row level security;
alter table public.webhook_events     enable row level security;

drop policy if exists "plans: anyone reads active" on public.subscription_plans;
create policy "plans: anyone reads active" on public.subscription_plans
  for select to anon, authenticated using (is_active);

drop policy if exists "subscriptions: owner reads own" on public.subscriptions;
create policy "subscriptions: owner reads own" on public.subscriptions
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "payments: owner reads own" on public.payments;
create policy "payments: owner reads own" on public.payments
  for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.subscription_plans, public.subscriptions, public.payments, public.webhook_events
  from anon, authenticated;
grant select on public.subscription_plans to anon, authenticated;
grant select on public.subscriptions, public.payments to authenticated;

-- Records a verified successful payment in ONE transaction: marks the payment paid, extends the subscription,
-- and puts the vendor's store live. Safe to call twice for the same reference (Paystack webhook + browser verify).
-- Raises 'payment_not_found' or 'payment_mismatch' instead of trusting the caller.
create or replace function public.apply_successful_payment(
  p_reference      text,
  p_amount_kobo    integer,
  p_currency       text,
  p_transaction_id bigint,
  p_channel        text,
  p_paid_at        timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay  public.payments;
  plan public.subscription_plans;
  base timestamptz;
  sub  public.subscriptions;
begin
  select * into pay from public.payments where reference = p_reference for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if pay.status = 'success' then
    return jsonb_build_object('already_applied', true, 'owner_id', pay.owner_id);
  end if;

  select * into plan from public.subscription_plans where code = pay.plan_code;
  if pay.amount_kobo <> p_amount_kobo or pay.currency <> p_currency or p_amount_kobo <> plan.price_kobo then
    raise exception 'payment_mismatch' using errcode = '22023';
  end if;

  update public.payments
     set status = 'success',
         paystack_transaction_id = p_transaction_id,
         channel = p_channel,
         paid_at = coalesce(p_paid_at, now())
   where id = pay.id;

  -- Extend from the end of the current period if it is still running, otherwise from now.
  select * into sub from public.subscriptions where owner_id = pay.owner_id for update;
  base := case when found and sub.current_period_end > now() then sub.current_period_end else now() end;

  insert into public.subscriptions (owner_id, plan_code, status, current_period_start, current_period_end)
  values (pay.owner_id, plan.code, 'active',
          case when base > now() then coalesce(sub.current_period_start, now()) else now() end,
          base + make_interval(days => plan.interval_days))
  on conflict (owner_id) do update
    set plan_code = excluded.plan_code,
        status = 'active',
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end
  returning * into sub;

  update public.stores set is_published = true where owner_id = pay.owner_id and status = 'active';

  return jsonb_build_object(
    'already_applied', false,
    'owner_id', pay.owner_id,
    'current_period_end', sub.current_period_end
  );
end;
$$;

revoke all on function public.apply_successful_payment(text, integer, text, bigint, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_successful_payment(text, integer, text, bigint, text, timestamptz)
  to service_role;

-- Run daily: lapsed subscriptions become 'expired' and their stores go offline.
-- Returns how many subscriptions were expired.
create or replace function public.expire_lapsed_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with lapsed as (
    update public.subscriptions
       set status = 'expired'
     where status = 'active' and current_period_end <= now()
    returning owner_id
  ), hidden as (
    update public.stores s set is_published = false
      from lapsed l where s.owner_id = l.owner_id
    returning s.id
  )
  select count(*) into n from lapsed;
  return n;
end;
$$;

revoke all on function public.expire_lapsed_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_lapsed_subscriptions() to service_role;

-- Optional: schedule it with pg_cron (Database → Extensions → enable "pg_cron", then run this once):
-- select cron.schedule('expire-lapsed-subscriptions', '15 0 * * *', $$ select public.expire_lapsed_subscriptions(); $$);
