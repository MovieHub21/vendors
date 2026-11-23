-- Product costs, cost snapshots, operating expenses and vendor profit/loss reports.

alter table public.products
  add column if not exists unit_cost_kobo integer
  check (unit_cost_kobo is null or unit_cost_kobo between 0 and 2000000000);

alter table public.order_items
  add column if not exists unit_cost_kobo bigint
  check (unit_cost_kobo is null or unit_cost_kobo between 0 and 10000000000);

alter table public.orders add column if not exists confirmed_at timestamptz;
update public.orders
   set confirmed_at = created_at
 where status not in ('pending', 'cancelled') and confirmed_at is null;

create or replace function private.stamp_order_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status not in ('pending', 'cancelled') and new.confirmed_at is null then
    if tg_op = 'UPDATE' and old.status = 'pending' then
      new.confirmed_at := now();
    else
      new.confirmed_at := new.created_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stamp_confirmation on public.orders;
create trigger orders_stamp_confirmation
  before insert or update of status on public.orders
  for each row execute function private.stamp_order_confirmation();
create index if not exists orders_store_confirmed_idx on public.orders (store_id, confirmed_at desc)
  where status not in ('pending', 'cancelled');

create table if not exists public.business_expenses (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  amount_kobo  bigint not null check (amount_kobo between 1 and 10000000000),
  category     text not null check (category in ('rent', 'utilities', 'transport', 'packaging', 'delivery', 'marketing', 'wages', 'fees', 'other')),
  description  text not null check (char_length(btrim(description)) between 2 and 150 and description !~ '[<>]'),
  incurred_on  date not null default ((now() at time zone 'Africa/Lagos')::date),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists business_expenses_store_date_idx on public.business_expenses (store_id, incurred_on desc);

drop trigger if exists business_expenses_set_updated_at on public.business_expenses;
create trigger business_expenses_set_updated_at before update on public.business_expenses
  for each row execute function public.set_updated_at();

alter table public.business_expenses enable row level security;
drop policy if exists "expenses: owner reads own" on public.business_expenses;
create policy "expenses: owner reads own" on public.business_expenses
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));
revoke all on public.business_expenses from anon, authenticated;
grant select on public.business_expenses to authenticated;
grant select, insert, update, delete on public.business_expenses to service_role;

-- Capture the product's cost at the time the order is created. For manual custom lines, vendors can supply a cost;
-- for catalogue products the database always uses the store's saved product cost.
create or replace function private.add_order_items(p_order_id uuid, p_store_id uuid, p_items jsonb, p_mode text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  e         jsonb;
  q         numeric;
  pr        numeric;
  v_cost    numeric;
  v_pid     uuid;
  v_name    text;
  v_var     text;
  v_price   bigint;
  v_cost_k  bigint;
  v_qty     integer;
  v_total   bigint := 0;
  prod      public.products;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;

  for e in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'quantity') is distinct from 'number' then
      raise exception 'invalid_item';
    end if;
    q := (e ->> 'quantity')::numeric;
    if q <> trunc(q) or q < 1 or q > 10000 then raise exception 'invalid_item'; end if;
    v_qty := q::integer;
    v_var := nullif(left(btrim(coalesce(e ->> 'variant', '')), 60), '');
    v_pid := null;
    v_cost_k := null;

    if jsonb_typeof(e -> 'product_id') = 'string' then
      begin
        v_pid := (e ->> 'product_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid_item';
      end;
    end if;

    pr := null;
    if p_mode = 'vendor' and jsonb_typeof(e -> 'unit_price_kobo') = 'number' then
      pr := (e ->> 'unit_price_kobo')::numeric;
      if pr <> trunc(pr) or pr < 0 or pr > 10000000000 then raise exception 'invalid_item'; end if;
    end if;

    if v_pid is not null then
      select * into prod from public.products where id = v_pid and store_id = p_store_id;
      if not found then raise exception 'product_not_found'; end if;
      if p_mode = 'public' and (prod.status <> 'published' or not prod.is_available) then raise exception 'product_unavailable'; end if;
      v_name := prod.name;
      v_price := coalesce(pr::bigint, prod.price_kobo::bigint);
      v_cost_k := prod.unit_cost_kobo::bigint;
    else
      if p_mode <> 'vendor' or pr is null then raise exception 'invalid_item'; end if;
      v_name := left(btrim(coalesce(e ->> 'name', '')), 120);
      if v_name = '' or v_name ~ '[<>]' then raise exception 'invalid_item'; end if;
      v_price := pr::bigint;
      if jsonb_typeof(e -> 'unit_cost_kobo') = 'number' then
        v_cost := (e ->> 'unit_cost_kobo')::numeric;
        if v_cost <> trunc(v_cost) or v_cost < 0 or v_cost > 10000000000 then raise exception 'invalid_item'; end if;
        v_cost_k := v_cost::bigint;
      elsif e ? 'unit_cost_kobo' and jsonb_typeof(e -> 'unit_cost_kobo') <> 'null' then
        raise exception 'invalid_item';
      end if;
    end if;

    insert into public.order_items (order_id, product_id, product_name, variant, unit_price_kobo, unit_cost_kobo, quantity, line_total_kobo)
    values (p_order_id, v_pid, v_name, v_var, v_price, v_cost_k, v_qty, v_price * v_qty);
    v_total := v_total + v_price * v_qty;
  end loop;

  if p_mode = 'public' and exists (
    select 1
      from (select oi.product_id, sum(oi.quantity) as q
              from public.order_items oi
             where oi.order_id = p_order_id and oi.product_id is not null
             group by oi.product_id) a
      join public.products p on p.id = a.product_id
     where p.stock_quantity is not null and p.stock_quantity < a.q
  ) then raise exception 'insufficient_stock'; end if;

  return v_total;
end;
$$;
revoke all on function private.add_order_items(uuid, uuid, jsonb, text) from public;

-- Existing order detail lets vendors correct historical cost snapshots and agreed prices atomically.
create or replace function public.set_order_item_prices(p_store_id uuid, p_order_id uuid, p_items jsonb)
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
  unit_cost numeric;
  has_cost boolean;
  item_count integer;
  submitted_count integer;
  unique_count integer;
  new_total bigint;
begin
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_prices';
  end if;
  select * into o from public.orders where id = p_order_id and store_id = p_store_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'cancelled' then raise exception 'order_cancelled'; end if;

  select count(*) into item_count from public.order_items where order_id = o.id;
  select count(*), count(distinct value ->> 'order_item_id') into submitted_count, unique_count
    from jsonb_array_elements(p_items);
  if item_count = 0 or submitted_count <> item_count or unique_count <> item_count then raise exception 'invalid_order_prices'; end if;

  for entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry) is distinct from 'object'
       or jsonb_typeof(entry -> 'order_item_id') is distinct from 'string'
       or jsonb_typeof(entry -> 'unit_price_kobo') is distinct from 'number' then
      raise exception 'invalid_order_prices';
    end if;
    item_id := (entry ->> 'order_item_id')::uuid;
    unit_price := (entry ->> 'unit_price_kobo')::numeric;
    if unit_price <> trunc(unit_price) or unit_price < 0 or unit_price > 10000000000 then raise exception 'invalid_order_prices'; end if;

    has_cost := entry ? 'unit_cost_kobo';
    if has_cost and jsonb_typeof(entry -> 'unit_cost_kobo') <> 'null' then
      if jsonb_typeof(entry -> 'unit_cost_kobo') is distinct from 'number' then raise exception 'invalid_order_cost'; end if;
      unit_cost := (entry ->> 'unit_cost_kobo')::numeric;
      if unit_cost <> trunc(unit_cost) or unit_cost < 0 or unit_cost > 10000000000 then raise exception 'invalid_order_cost'; end if;
    else
      unit_cost := null;
    end if;

    update public.order_items
       set unit_price_kobo = unit_price::bigint,
           line_total_kobo = unit_price::bigint * quantity,
           unit_cost_kobo = case when has_cost then unit_cost::bigint else unit_cost_kobo end
     where id = item_id and order_id = o.id;
    if not found then raise exception 'order_item_not_found'; end if;
  end loop;

  select coalesce(sum(line_total_kobo), 0)::bigint into new_total from public.order_items where order_id = o.id;
  if new_total <= 0 then raise exception 'invalid_order_total'; end if;
  if new_total < o.paid_kobo then raise exception 'agreed_prices_below_paid'; end if;
  update public.orders set total_kobo = new_total where id = o.id;
  perform private.refresh_order_payment(o.id);
  select * into o from public.orders ord where ord.id = o.id;
  return jsonb_build_object('order_id', o.id, 'total_kobo', o.total_kobo, 'paid_kobo', o.paid_kobo,
                            'outstanding_kobo', o.total_kobo - o.paid_kobo, 'payment_status', o.payment_status);
end;
$$;
revoke all on function public.set_order_item_prices(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_order_item_prices(uuid, uuid, jsonb) to service_role;

create or replace function public.profit_loss_report(p_store_id uuid, p_period text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_start date;
  local_end date;
  range_start timestamptz;
  range_end timestamptz;
  revenue bigint := 0;
  sale_count bigint := 0;
  known_cogs bigint := 0;
  missing_cost_items bigint := 0;
  expense_total bigint := 0;
  expense_count bigint := 0;
begin
  if p_period not in ('today', 'month', 'all_time') then raise exception 'invalid_period' using errcode = '22023'; end if;
  if p_period = 'today' then
    local_start := (now() at time zone 'Africa/Lagos')::date;
    local_end := local_start + 1;
  elsif p_period = 'month' then
    local_start := date_trunc('month', now() at time zone 'Africa/Lagos')::date;
    local_end := (local_start + interval '1 month')::date;
  end if;
  if p_period <> 'all_time' then
    range_start := local_start::timestamp at time zone 'Africa/Lagos';
    range_end := local_end::timestamp at time zone 'Africa/Lagos';
  end if;

  if p_period = 'all_time' then
    select coalesce(sum(o.total_kobo), 0)::bigint, count(*) into revenue, sale_count
      from public.orders o where o.store_id = p_store_id and o.status not in ('pending', 'cancelled');
    select coalesce(sum(oi.unit_cost_kobo * oi.quantity) filter (where oi.unit_cost_kobo is not null), 0)::bigint,
           count(*) filter (where oi.unit_cost_kobo is null)
      into known_cogs, missing_cost_items
      from public.order_items oi join public.orders o on o.id = oi.order_id
     where o.store_id = p_store_id and o.status not in ('pending', 'cancelled');
    select coalesce(sum(e.amount_kobo), 0)::bigint, count(*) into expense_total, expense_count
      from public.business_expenses e where e.store_id = p_store_id;
  else
    select coalesce(sum(o.total_kobo), 0)::bigint, count(*) into revenue, sale_count
      from public.orders o
     where o.store_id = p_store_id and o.status not in ('pending', 'cancelled')
       and o.confirmed_at >= range_start and o.confirmed_at < range_end;
    select coalesce(sum(oi.unit_cost_kobo * oi.quantity) filter (where oi.unit_cost_kobo is not null), 0)::bigint,
           count(*) filter (where oi.unit_cost_kobo is null)
      into known_cogs, missing_cost_items
      from public.order_items oi join public.orders o on o.id = oi.order_id
     where o.store_id = p_store_id and o.status not in ('pending', 'cancelled')
       and o.confirmed_at >= range_start and o.confirmed_at < range_end;
    select coalesce(sum(e.amount_kobo), 0)::bigint, count(*) into expense_total, expense_count
      from public.business_expenses e
     where e.store_id = p_store_id and e.incurred_on >= local_start and e.incurred_on < local_end;
  end if;

  return jsonb_build_object(
    'period', p_period,
    'revenue_kobo', revenue,
    'known_cogs_kobo', known_cogs,
    'missing_cost_items', missing_cost_items,
    'gross_profit_kobo', case when missing_cost_items = 0 then revenue - known_cogs else null end,
    'expenses_kobo', expense_total,
    'net_profit_kobo', case when missing_cost_items = 0 then revenue - known_cogs - expense_total else null end,
    'sales_count', sale_count,
    'expense_count', expense_count
  );
end;
$$;
revoke all on function public.profit_loss_report(uuid, text) from public, anon, authenticated;
grant execute on function public.profit_loss_report(uuid, text) to service_role;
