-- Initial per-order agreed-total implementation. The next migration replaces this with item-level prices.
create or replace function public.set_order_agreed_total(p_store_id uuid, p_order_id uuid, p_total_kobo bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  source_total numeric;
  item_count integer;
begin
  if p_total_kobo is null or p_total_kobo <= 0 or p_total_kobo > 10000000000 then
    raise exception 'invalid_order_total';
  end if;
  select * into o from public.orders where id = p_order_id and store_id = p_store_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;
  if p_total_kobo < o.paid_kobo then raise exception 'agreed_total_below_paid'; end if;
  select coalesce(sum(line_total_kobo), 0), count(*) into source_total, item_count
    from public.order_items where order_id = o.id;
  if item_count = 0 or source_total <= 0 then raise exception 'order_has_no_items'; end if;

  with source as (
    select id, quantity, line_total_kobo, sum(line_total_kobo) over () as weight_total,
           row_number() over (order by id) as row_num, count(*) over () as row_count
      from public.order_items where order_id = o.id
  ), shares as (
    select id, quantity,
           case when row_num = row_count then p_total_kobo - coalesce(
             sum(floor(p_total_kobo::numeric * line_total_kobo / weight_total))
               over (order by row_num rows between unbounded preceding and 1 preceding), 0)
           else floor(p_total_kobo::numeric * line_total_kobo / weight_total)
           end::bigint as agreed_line_total
      from source
  )
  update public.order_items i set line_total_kobo = s.agreed_line_total,
    unit_price_kobo = round(s.agreed_line_total::numeric / s.quantity)::bigint
    from shares s where i.id = s.id;

  update public.orders set total_kobo = p_total_kobo where id = o.id;
  perform private.refresh_order_payment(o.id);
  select * into o from public.orders ord where ord.id = o.id;
  return jsonb_build_object('order_id', o.id, 'total_kobo', o.total_kobo, 'paid_kobo', o.paid_kobo,
    'outstanding_kobo', o.total_kobo - o.paid_kobo, 'payment_status', o.payment_status);
end;
$$;

revoke all on function public.set_order_agreed_total(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.set_order_agreed_total(uuid, uuid, bigint) to service_role;
