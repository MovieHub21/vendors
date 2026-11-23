-- SellSharp · seven-day vendor trial
-- A trial starts only after the vendor has verified their account and completed store setup.

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check check (status in ('trialing', 'active', 'expired', 'cancelled'));
alter table public.subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

create or replace function public.start_store_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (owner_id, plan_code, status, current_period_start, current_period_end, trial_started_at, trial_ends_at)
  values (new.owner_id, 'monthly', 'trialing', now(), now() + interval '7 days', now(), now() + interval '7 days')
  on conflict (owner_id) do nothing;

  update public.stores set is_published = true where id = new.id;
  return new;
end;
$$;

drop trigger if exists stores_start_trial on public.stores;
create trigger stores_start_trial
  after insert on public.stores
  for each row execute function public.start_store_trial();

-- Also enroll vendors who created their store before this migration was installed.
-- A prior successful payment excludes the account, so this cannot grant an old subscriber a second trial.
insert into public.subscriptions (
  owner_id, plan_code, status, current_period_start, current_period_end, trial_started_at, trial_ends_at
)
select s.owner_id, 'monthly', 'trialing', now(), now() + interval '7 days', now(), now() + interval '7 days'
from public.stores s
where s.status = 'active'
  and not exists (
    select 1 from public.subscriptions sub where sub.owner_id = s.owner_id
  )
  and not exists (
    select 1 from public.payments p where p.owner_id = s.owner_id and p.status = 'success'
  )
on conflict (owner_id) do nothing;

update public.stores s
   set is_published = true
 where s.status = 'active'
   and exists (
     select 1 from public.subscriptions sub
      where sub.owner_id = s.owner_id and sub.status = 'trialing' and sub.current_period_end > now()
   );

-- A checkout made during a trial starts the paid period when payment is confirmed;
-- the customer is not charged during the trial and is not billed retroactively for it.
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

  select * into sub from public.subscriptions where owner_id = pay.owner_id for update;
  base := case
    when found and sub.status <> 'trialing' and sub.current_period_end > now() then sub.current_period_end
    else now()
  end;

  insert into public.subscriptions (owner_id, plan_code, status, current_period_start, current_period_end)
  values (pay.owner_id, plan.code, 'active', base, base + make_interval(months => plan.interval_months))
  on conflict (owner_id) do update
    set plan_code = excluded.plan_code,
        status = 'active',
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        trial_started_at = null,
        trial_ends_at = null,
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
grant execute on function public.apply_successful_payment(text, integer, text, bigint, text, timestamptz)
  to service_role;

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
     where status in ('active', 'trialing') and current_period_end <= now()
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
