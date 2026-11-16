-- SellSharp · OPTIONAL one-time clean-up. Run it ONCE, after 20261114000000_billing_renewals.sql.
-- Before the renewal fix, an automatic Paystack renewal was logged and ignored: the vendor was charged but the
-- subscription was not extended. This finds those events in webhook_events and applies them now.
-- Safe to run more than once (a renewal is never applied twice).

-- Step 1 (look first): the renewals that were charged but never applied.
select received_at,
       reference,
       payload #>> '{data,customer,email}'         as customer_email,
       (payload #>> '{data,amount}')::int / 100.0  as naira,
       payload #>> '{data,plan,plan_code}'         as plan_code
  from public.webhook_events
 where provider = 'paystack'
   and event = 'charge.success'
   and processed_at is null
   and coalesce(reference, '') <> ''
   and reference not like 'ss\_sub\_%' escape '\'
 order by received_at;

-- Step 2: apply them (oldest first). Anything that cannot be matched to a vendor, or whose amount is not the plan
-- price, is skipped and listed in the notices below it, so nothing is applied by guesswork.
do $$
declare
  ev    record;
  d     jsonb;
  n_ok  integer := 0;
  n_not integer := 0;
begin
  for ev in
    select id, reference, payload
      from public.webhook_events
     where provider = 'paystack'
       and event = 'charge.success'
       and processed_at is null
       and coalesce(reference, '') <> ''
       and reference not like 'ss\_sub\_%' escape '\'
     order by received_at
  loop
    d := ev.payload -> 'data';
    begin
      perform public.apply_renewal_payment(
        d #>> '{customer,customer_code}',
        d #>> '{customer,email}',
        (d #>> '{plan,plan_code}') is not null,   -- only trust the email when Paystack says it was a plan charge
        ev.reference,
        (d ->> 'amount')::integer,
        d ->> 'currency',
        (d ->> 'id')::bigint,
        d ->> 'channel',
        (d ->> 'paid_at')::timestamptz
      );
      update public.webhook_events set processed_at = now() where id = ev.id;
      n_ok := n_ok + 1;
    exception when others then
      n_not := n_not + 1;
      raise notice 'NOT applied: % (%)', ev.reference, sqlerrm;
    end;
  end loop;
  raise notice 'Renewals applied: %   Not applied: %', n_ok, n_not;
end $$;
