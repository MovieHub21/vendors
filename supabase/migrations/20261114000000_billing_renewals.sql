-- SellSharp · billing renewals
-- Paystack charges the vendor's card every month by itself. Each renewal reaches the webhook with a reference that
-- Paystack invents, so it has to be matched to the vendor through their Paystack customer. This migration adds:
--   * a link between each vendor and their Paystack customer / subscription
--   * apply_renewal_payment(): a successful renewal extends the subscription by one more month
--   * record_renewal_failure(): a failed renewal is flagged so the vendor sees it on their dashboard
--   * record_subscription_state(): auto-renew switched on / cancelled
-- No grace period: a vendor is live exactly while their paid period runs.
-- Safe to run more than once.

-- One billing period = one calendar month. Paystack's "monthly" plan charges on the same date every month, so a fixed
-- 30 days would end a day early in 31-day months and lock a vendor who has paid. (Change interval_months to alter it.)
alter table public.subscription_plans
  add column if not exists interval_months integer not null default 1 check (interval_months between 1 and 12);

alter table public.subscriptions
  add column if not exists auto_renew            boolean not null default false,
  add column if not exists renewal_failed_at     timestamptz,
  add column if not exists renewal_failure_reason text;

alter table public.payments add column if not exists kind text not null default 'checkout';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_kind_check') then
    alter table public.payments add constraint payments_kind_check check (kind in ('checkout', 'renewal'));
  end if;
end $$;

-- Which Paystack customer / subscription belongs to which vendor. Private: only the edge functions read it.
create table if not exists public.billing_accounts (
  owner_id                   uuid primary key references auth.users (id) on delete cascade,
  paystack_customer_code     text not null unique,
  paystack_subscription_code text unique,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

drop trigger if exists billing_accounts_set_updated_at on public.billing_accounts;
create trigger billing_accounts_set_updated_at before update on public.billing_accounts
  for each row execute function public.set_updated_at();

alter table public.billing_accounts enable row level security;
revoke all on public.billing_accounts from anon, authenticated;

-- ---------------------------------------------------------------- finding the vendor behind a Paystack customer
-- Customer code first. Only when the caller has confirmed the charge belongs to OUR plan may it fall back to the
-- vendor's login email (this covers a renewal that arrives before the customer has been linked).
create or replace function public.billing_resolve_owner(p_customer_code text, p_email text, p_allow_email boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if coalesce(p_customer_code, '') <> '' then
    select owner_id into v_owner from public.billing_accounts where paystack_customer_code = p_customer_code;
    if v_owner is not null then
      return v_owner;
    end if;
  end if;

  if p_allow_email and coalesce(p_customer_code, '') <> '' and coalesce(p_email, '') <> '' then
    select u.id into v_owner
      from auth.users u
     where lower(u.email) = lower(p_email)
       and exists (select 1 from public.stores s where s.owner_id = u.id)
     limit 1;
    if v_owner is not null then
      insert into public.billing_accounts (owner_id, paystack_customer_code)
      values (v_owner, p_customer_code)
      on conflict (owner_id) do update set paystack_customer_code = excluded.paystack_customer_code;
      return v_owner;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.link_billing_account(p_owner uuid, p_customer_code text, p_subscription_code text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(p_customer_code, '') = '' then
    return;
  end if;
  insert into public.billing_accounts (owner_id, paystack_customer_code, paystack_subscription_code)
  values (p_owner, p_customer_code, nullif(p_subscription_code, ''))
  on conflict (owner_id) do update
    set paystack_customer_code = excluded.paystack_customer_code,
        paystack_subscription_code = coalesce(excluded.paystack_subscription_code, public.billing_accounts.paystack_subscription_code);
end;
$$;

-- ---------------------------------------------------------------- the first payment (re-issued: one month, clears failures)
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
          base + make_interval(months => plan.interval_months))
  on conflict (owner_id) do update
    set plan_code = excluded.plan_code,
        status = 'active',
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        renewal_failed_at = null,
        renewal_failure_reason = null
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
grant execute on function public.apply_successful_payment(text, integer, text, bigint, text, timestamptz) to service_role;

-- ---------------------------------------------------------------- a successful automatic renewal
-- Raises 'billing_account_not_found' (vendor unknown) or 'payment_mismatch' (amount/currency is not the plan price).
-- Safe to call twice for the same reference.
create or replace function public.apply_renewal_payment(
  p_customer_code  text,
  p_email          text,
  p_allow_email    boolean,
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
  v_owner uuid;
  v_paid  timestamptz := coalesce(p_paid_at, now());
  sub     public.subscriptions;
  v_has   boolean;
  plan    public.subscription_plans;
  pay     public.payments;
  v_base  timestamptz;
  v_start timestamptz;
begin
  v_owner := public.billing_resolve_owner(p_customer_code, p_email, p_allow_email);
  if v_owner is null then
    raise exception 'billing_account_not_found' using errcode = 'P0002';
  end if;

  select * into sub from public.subscriptions where owner_id = v_owner for update;
  v_has := found;

  select * into plan from public.subscription_plans where code = case when v_has then sub.plan_code else 'monthly' end;
  if plan.code is null or p_amount_kobo <> plan.price_kobo or p_currency <> plan.currency then
    raise exception 'payment_mismatch' using errcode = '22023';
  end if;

  select * into pay from public.payments where reference = p_reference for update;
  if found then
    if pay.owner_id <> v_owner then
      raise exception 'payment_mismatch' using errcode = '22023';
    end if;
    if pay.status = 'success' then
      return jsonb_build_object('already_applied', true, 'owner_id', v_owner);
    end if;
    update public.payments
       set status = 'success', paystack_transaction_id = p_transaction_id, channel = p_channel, paid_at = v_paid
     where id = pay.id;
  else
    insert into public.payments (owner_id, plan_code, reference, amount_kobo, currency, status,
                                 paystack_transaction_id, channel, paid_at, kind)
    values (v_owner, plan.code, p_reference, p_amount_kobo, p_currency, 'success',
            p_transaction_id, p_channel, v_paid, 'renewal');
  end if;

  -- One more period, counted from the end of the current one (or from the payment if it had already ended).
  if v_has and sub.current_period_end > v_paid then
    v_base := sub.current_period_end;
    v_start := sub.current_period_start;
  else
    v_base := v_paid;
    v_start := v_paid;
  end if;

  insert into public.subscriptions (owner_id, plan_code, status, current_period_start, current_period_end, auto_renew)
  values (v_owner, plan.code, 'active', v_start, v_base + make_interval(months => plan.interval_months), true)
  on conflict (owner_id) do update
    set status = 'active',
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        auto_renew = true,
        renewal_failed_at = null,
        renewal_failure_reason = null
  returning * into sub;

  update public.stores set is_published = true where owner_id = v_owner and status = 'active';

  return jsonb_build_object('already_applied', false, 'owner_id', v_owner, 'current_period_end', sub.current_period_end);
end;
$$;

-- ---------------------------------------------------------------- a failed automatic renewal
create or replace function public.record_renewal_failure(
  p_customer_code text,
  p_email         text,
  p_allow_email   boolean,
  p_reference     text,
  p_reason        text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  sub     public.subscriptions;
  plan    public.subscription_plans;
begin
  v_owner := public.billing_resolve_owner(p_customer_code, p_email, p_allow_email);
  if v_owner is null then
    raise exception 'billing_account_not_found' using errcode = 'P0002';
  end if;

  update public.subscriptions
     set renewal_failed_at = now(),
         renewal_failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'The payment was declined.'), 200)
   where owner_id = v_owner
  returning * into sub;

  -- No subscription row means this vendor never completed a payment: nothing to warn them about.
  if not found then
    return jsonb_build_object('owner_id', v_owner, 'flagged', false);
  end if;

  if coalesce(p_reference, '') <> '' and not exists (select 1 from public.payments where reference = p_reference) then
    select * into plan from public.subscription_plans where code = sub.plan_code;
    insert into public.payments (owner_id, plan_code, reference, amount_kobo, currency, status, kind)
    values (v_owner, plan.code, p_reference, plan.price_kobo, plan.currency, 'failed', 'renewal');
  end if;

  return jsonb_build_object('owner_id', v_owner, 'flagged', true);
end;
$$;

-- ---------------------------------------------------------------- auto-renew turned on / cancelled
create or replace function public.record_subscription_state(
  p_customer_code     text,
  p_email             text,
  p_allow_email       boolean,
  p_state             text,
  p_subscription_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if p_state not in ('created', 'not_renew', 'disabled') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;

  v_owner := public.billing_resolve_owner(p_customer_code, p_email, p_allow_email);
  if v_owner is null then
    raise exception 'billing_account_not_found' using errcode = 'P0002';
  end if;

  perform public.link_billing_account(v_owner, p_customer_code, p_subscription_code);
  update public.subscriptions set auto_renew = (p_state = 'created') where owner_id = v_owner;

  return jsonb_build_object('owner_id', v_owner, 'auto_renew', p_state = 'created');
end;
$$;

-- Only the edge functions (service role) may call any of these.
revoke all on function public.billing_resolve_owner(text, text, boolean) from public, anon, authenticated;
revoke all on function public.link_billing_account(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_renewal_payment(text, text, boolean, text, integer, text, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_renewal_failure(text, text, boolean, text, text) from public, anon, authenticated;
revoke all on function public.record_subscription_state(text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.billing_resolve_owner(text, text, boolean) to service_role;
grant execute on function public.link_billing_account(uuid, text, text) to service_role;
grant execute on function public.apply_renewal_payment(text, text, boolean, text, integer, text, bigint, text, timestamptz) to service_role;
grant execute on function public.record_renewal_failure(text, text, boolean, text, text) to service_role;
grant execute on function public.record_subscription_state(text, text, boolean, text, text) to service_role;
