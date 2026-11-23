-- Sales totals outside today are fetched only when the vendor selects that period.
-- The (store_id, created_at) index on orders supports the bounded date range query.

create or replace function public.dashboard_summary(p_store_id uuid, p_low_stock integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  today_end   timestamptz := today_start + interval '1 day';
  result jsonb;
begin
  select jsonb_build_object(
    'sales_today_kobo', (select coalesce(sum(o.total_kobo), 0)
                           from public.orders o
                          where o.store_id = p_store_id
                            and o.status not in ('pending', 'cancelled')
                            and o.created_at >= today_start and o.created_at < today_end),
    'orders_today',       (select count(*)
                             from public.orders o
                            where o.store_id = p_store_id
                              and o.status <> 'cancelled'
                              and o.created_at >= today_start and o.created_at < today_end),
    'pending_orders',     count(*) filter (where o.status = 'pending'),
    'awaiting_delivery',  count(*) filter (where o.status in ('confirmed', 'processing', 'ready_for_pickup', 'shipped')),
    'outstanding_kobo',   coalesce(sum(o.total_kobo - o.paid_kobo) filter (where o.status not in ('pending', 'cancelled')), 0),
    'debtors',            count(distinct o.customer_id) filter (where o.status not in ('pending', 'cancelled') and o.total_kobo > o.paid_kobo)
  ) into result
  from public.orders o
  where o.store_id = p_store_id;

  return result || jsonb_build_object(
    'total_customers', (select count(*) from public.customers c where c.store_id = p_store_id),
    'low_stock', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'stock_quantity', x.stock_quantity) order by x.stock_quantity, x.name)
      from (select p.id, p.name, p.stock_quantity from public.products p
             where p.store_id = p_store_id and p.status <> 'archived'
               and p.stock_quantity is not null and p.stock_quantity <= p_low_stock
             order by p.stock_quantity, p.name limit 10) x
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'reference', r.reference, 'customer_name', r.customer_name, 'total_kobo', r.total_kobo,
        'status', r.status, 'payment_status', r.payment_status, 'channel', r.channel, 'created_at', r.created_at)
        order by r.created_at desc)
      from (select o.id, o.reference, c.name as customer_name, o.total_kobo, o.status, o.payment_status, o.channel, o.created_at
              from public.orders o join public.customers c on c.id = o.customer_id
             where o.store_id = p_store_id order by o.created_at desc limit 5) r
    ), '[]'::jsonb),
    'recent_transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'order_id', t.order_id, 'reference', t.reference, 'customer_name', t.customer_name,
        'amount_kobo', t.amount_kobo, 'method', t.method, 'source', t.source, 'recorded_at', t.recorded_at)
        order by t.recorded_at desc)
      from (select p.id, p.order_id, o.reference, c.name as customer_name, p.amount_kobo, p.method, p.source, p.recorded_at
              from public.order_payments p
              join public.orders o on o.id = p.order_id
              join public.customers c on c.id = o.customer_id
             where p.store_id = p_store_id order by p.recorded_at desc limit 5) t
    ), '[]'::jsonb)
  );
end;
$$;

-- period is restricted to 'month' or 'all_time'. 'today' is part of dashboard_summary.
drop function if exists public.dashboard_sales_range(uuid, text);
create function public.dashboard_sales_range(p_store_id uuid, p_period text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  range_start timestamptz;
  range_end timestamptz;
  total bigint;
  order_count bigint;
begin
  if p_period = 'all_time' then
    select coalesce(sum(o.total_kobo) filter (where o.status not in ('pending', 'cancelled')), 0)::bigint,
           count(*) filter (where o.status <> 'cancelled')
      into total, order_count
      from public.orders o
     where o.store_id = p_store_id;
    return jsonb_build_object('sales_kobo', total, 'total_orders', order_count);
  elsif p_period = 'month' then
    range_start := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    range_end := range_start + interval '1 month';
  else
    raise exception 'invalid_sales_period' using errcode = '22023';
  end if;

  select coalesce(sum(o.total_kobo) filter (where o.status not in ('pending', 'cancelled')), 0)::bigint,
         count(*) filter (where o.status <> 'cancelled')
    into total, order_count
    from public.orders o
   where o.store_id = p_store_id
     and o.created_at >= range_start and o.created_at < range_end;
  return jsonb_build_object('sales_kobo', total, 'total_orders', order_count);
end;
$$;

revoke all on function public.dashboard_sales_range(uuid, text) from public, anon, authenticated;
grant execute on function public.dashboard_sales_range(uuid, text) to service_role;
