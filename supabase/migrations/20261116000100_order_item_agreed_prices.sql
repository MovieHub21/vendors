-- Let vendors set a separate agreed unit price for each item on a single order.
-- Order item snapshots and totals change; catalogue product prices do not.
drop function if exists public.set_order_agreed_total(uuid, uuid, bigint);

create or replace function public.set_order_item_prices(
  p_store_id uuid,
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  entry jsonb;
  item_id uuid;
  unit_price numeric;
  item_count integer;
  submitted_count integer;
  unique_count integer;
  new_total bigint;
begin
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_order_prices';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_prices';
  end if;

  select * into o from public.orders
   where id = p_order_id and store_id = p_store_id
   for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;

  select count(*) into item_count from public.order_items where order_id = o.id;
  select count(*), count(distinct value ->> 'order_item_id')
    into submitted_count, unique_count
    from jsonb_array_elements(p_items);
  if item_count = 0 or submitted_count <> item_count or unique_count <> item_count then
    raise exception 'invalid_order_prices';
  end if;

  for entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry) is distinct from 'object'
       or jsonb_typeof(entry -> 'order_item_id') is distinct from 'string'
       or jsonb_typeof(entry -> 'unit_price_kobo') is distinct from 'number' then
      raise exception 'invalid_order_prices';
    end if;
    item_id := (entry ->> 'order_item_id')::uuid;
    unit_price := (entry ->> 'unit_price_kobo')::numeric;
    if unit_price <> trunc(unit_price) or unit_price < 0 or unit_price > 10000000000 then
      raise exception 'invalid_order_prices';
    end if;

    update public.order_items
       set unit_price_kobo = unit_price::bigint,
           line_total_kobo = unit_price::bigint * quantity
     where id = item_id and order_id = o.id;
    if not found then raise exception 'order_item_not_found'; end if;
  end loop;

  select coalesce(sum(line_total_kobo), 0)::bigint into new_total
    from public.order_items where order_id = o.id;
  if new_total <= 0 then raise exception 'invalid_order_total'; end if;
  if new_total < o.paid_kobo then raise exception 'agreed_prices_below_paid'; end if;

  update public.orders set total_kobo = new_total where id = o.id;
  perform private.refresh_order_payment(o.id);
  select * into o from public.orders ord where ord.id = o.id;
  return jsonb_build_object(
    'order_id', o.id,
    'total_kobo', o.total_kobo,
    'paid_kobo', o.paid_kobo,
    'outstanding_kobo', o.total_kobo - o.paid_kobo,
    'payment_status', o.payment_status
  );
end;
$$;

revoke all on function public.set_order_item_prices(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_order_item_prices(uuid, uuid, jsonb) to service_role;
