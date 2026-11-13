-- SellSharp · 0600 · sales core: customers, orders, order items, order payments, receipts, dashboard figures
-- Safe to re-run. Run after 0500_seo.sql.
--
-- Rules implemented here (one place, so the dashboard, receipts and debts always agree):
--   * Money is integer kobo. Totals, balances and statuses are computed in Postgres, never trusted from the browser.
--   * Browsers may READ their own rows (Row Level Security). Every WRITE goes through the SECURITY DEFINER functions
--     below, which are callable only by the service role (edge functions), and which always receive the store id
--     resolved from the caller's login, never one sent by the browser.
--   * A SALE is an order that is not 'pending' and not 'cancelled'. A pending storefront order is a request until the
--     vendor confirms it. Debts, sales figures and customer totals only count sales.
--   * Stock is reduced exactly once, when an order becomes a sale (orders.stock_applied), and restored if a sale that
--     had reduced stock is cancelled. Pending, failed and cancelled-before-confirmation orders never touch stock.
--   * Manual payments (source 'manual') are kept distinct from provider-verified payments (source 'paystack').
--     A manual payment can never claim to be a Paystack payment (constraint order_payments_source_method).

-- ---------------------------------------------------------------- helpers
-- "0801 234 5678", "+234 801 234 5678" and "2348012345678" all become "08012345678" so a returning customer is matched.
create or replace function public.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d = '' then null
    when d ~ '^234[0-9]{10}$' then '0' || substr(d, 4)
    else d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) x
$$;

revoke all on function public.phone_key(text) from public, anon, authenticated;
grant execute on function public.phone_key(text) to service_role;

alter table public.stores
  add column if not exists receipt_counter integer not null default 0;

-- ---------------------------------------------------------------- customers
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120 and name !~ '[<>]'),
  phone      text check (phone is null or (char_length(phone) <= 30 and phone !~ '[<>]')),
  phone_key  text,
  email      text check (email is null or (char_length(email) <= 120 and email ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$')),
  address    text check (address is null or (char_length(address) <= 300 and address !~ '[<>]')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One customer per phone number per vendor. Customers without a phone (some walk-ins) are never merged.
create unique index if not exists customers_store_phone_key on public.customers (store_id, phone_key) where phone_key is not null;
create index if not exists customers_store_name_idx on public.customers (store_id, lower(name));

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- orders (also used for manually recorded sales)
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete restrict,
  reference        text not null unique,
  channel          text not null default 'store'
                     check (channel in ('store', 'whatsapp', 'instagram', 'facebook', 'walk_in', 'other')),
  status           text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled')),
  total_kobo       bigint not null default 0 check (total_kobo >= 0),
  paid_kobo        bigint not null default 0 check (paid_kobo >= 0),
  payment_status   text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  delivery_address text check (delivery_address is null or (char_length(delivery_address) <= 300 and delivery_address !~ '[<>]')),
  notes            text check (notes is null or (char_length(notes) <= 500 and notes !~ '[<>]')),
  stock_applied    boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint orders_paid_not_over_total check (paid_kobo <= total_kobo)
);
create index if not exists orders_store_created_idx  on public.orders (store_id, created_at desc);
create index if not exists orders_store_status_idx   on public.orders (store_id, status);
create index if not exists orders_customer_idx       on public.orders (customer_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      uuid references public.products (id) on delete set null, -- the name/price below are a snapshot
  product_name    text not null check (char_length(btrim(product_name)) between 1 and 120 and product_name !~ '[<>]'),
  variant         text check (variant is null or (char_length(variant) <= 60 and variant !~ '[<>]')),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  quantity        integer not null check (quantity between 1 and 10000),
  line_total_kobo bigint not null check (line_total_kobo >= 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------- order payments (manual and provider-verified)
create table if not exists public.order_payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  store_id           uuid not null references public.stores (id) on delete cascade,
  amount_kobo        bigint not null check (amount_kobo > 0),
  method             text not null check (method in ('cash', 'bank_transfer', 'pos', 'paystack', 'other')),
  source             text not null default 'manual' check (source in ('manual', 'paystack')),
  provider_reference text unique,
  note               text check (note is null or (char_length(note) <= 300 and note !~ '[<>]')),
  recorded_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  constraint order_payments_source_method check ((source = 'paystack') = (method = 'paystack')),
  constraint order_payments_provider_ref check ((source = 'paystack') = (provider_reference is not null))
);
create index if not exists order_payments_order_idx on public.order_payments (order_id, recorded_at);
create index if not exists order_payments_store_idx on public.order_payments (store_id, recorded_at desc);

-- ---------------------------------------------------------------- receipts (immutable snapshots; a new revision is added when payments change)
create table if not exists public.receipts (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  order_id   uuid not null references public.orders (id) on delete cascade,
  receipt_no text not null,
  revision   integer not null default 1 check (revision >= 1),
  snapshot   jsonb not null,
  created_at timestamptz not null default now(),
  unique (order_id, revision),
  unique (store_id, receipt_no, revision)
);
create index if not exists receipts_store_idx on public.receipts (store_id, created_at desc);

-- ---------------------------------------------------------------- row level security (read own; nothing writable from the browser)
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_payments enable row level security;
alter table public.receipts       enable row level security;

drop policy if exists "customers: owner reads own" on public.customers;
create policy "customers: owner reads own" on public.customers
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));

drop policy if exists "orders: owner reads own" on public.orders;
create policy "orders: owner reads own" on public.orders
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));

drop policy if exists "order_items: owner reads own" on public.order_items;
create policy "order_items: owner reads own" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = (select auth.uid())
  ));

drop policy if exists "order_payments: owner reads own" on public.order_payments;
create policy "order_payments: owner reads own" on public.order_payments
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));

drop policy if exists "receipts: owner reads own" on public.receipts;
create policy "receipts: owner reads own" on public.receipts
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));

revoke all on public.customers, public.orders, public.order_items, public.order_payments, public.receipts
  from anon, authenticated;
grant select on public.customers, public.orders, public.order_items, public.order_payments, public.receipts
  to authenticated;

-- Per-customer totals for the customer list and profile. security_invoker makes the view obey the caller's RLS,
-- so a vendor can only ever see their own customers' figures.
drop view if exists public.customer_overview;
create view public.customer_overview with (security_invoker = true) as
  select c.id, c.store_id, c.name, c.phone, c.email, c.address, c.created_at,
         (count(o.id) filter (where o.status <> 'cancelled'))::int as order_count,
         coalesce(sum(o.total_kobo) filter (where o.status not in ('pending', 'cancelled')), 0)::bigint as total_purchases_kobo,
         coalesce(sum(o.paid_kobo) filter (where o.status <> 'cancelled'), 0)::bigint as total_paid_kobo,
         coalesce(sum(o.total_kobo - o.paid_kobo) filter (where o.status not in ('pending', 'cancelled')), 0)::bigint as outstanding_kobo,
         max(o.created_at) filter (where o.status <> 'cancelled') as last_purchase_at
  from public.customers c
  left join public.orders o on o.customer_id = c.id
  group by c.id;

revoke all on public.customer_overview from anon, authenticated;
grant select on public.customer_overview to authenticated;

-- ---------------------------------------------------------------- private helpers (not exposed by the Data API)
create or replace function private.new_order_reference()
returns text
language plpgsql
set search_path = ''
as $$
declare
  ref text;
begin
  loop
    ref := 'SS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.orders where reference = ref);
  end loop;
  return ref;
end;
$$;

-- Finds the vendor's customer by phone number (same vendor only) or creates one. Never overwrites an existing name.
create or replace function private.upsert_customer(
  p_store_id uuid, p_name text, p_phone text, p_email text, p_address text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  k   text := public.phone_key(p_phone);
  nm  text := left(btrim(coalesce(p_name, '')), 120);
  ph  text := nullif(left(btrim(coalesce(p_phone, '')), 30), '');
  em  text := nullif(left(btrim(coalesce(p_email, '')), 120), '');
  ad  text := nullif(left(btrim(coalesce(p_address, '')), 300), '');
  cid uuid;
begin
  if nm = '' then
    raise exception 'invalid_customer';
  end if;

  if k is not null then
    insert into public.customers (store_id, name, phone, phone_key, email, address)
    values (p_store_id, nm, ph, k, em, ad)
    on conflict (store_id, phone_key) where phone_key is not null
    do update set email = coalesce(public.customers.email, excluded.email),
                  address = coalesce(excluded.address, public.customers.address)
    returning id into cid;
  else
    insert into public.customers (store_id, name, phone, email, address)
    values (p_store_id, nm, ph, em, ad)
    returning id into cid;
  end if;
  return cid;
end;
$$;

-- Recomputes paid amount and payment status from the payment rows. The only code that writes these two columns.
create or replace function private.refresh_order_payment(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.orders o
     set paid_kobo = pay.paid,
         payment_status = case
           when o.total_kobo > 0 and pay.paid = 0 then 'unpaid'
           when pay.paid >= o.total_kobo then 'paid'
           else 'partial'
         end
    from (select coalesce(sum(amount_kobo), 0)::bigint as paid from public.order_payments where order_id = p_order_id) pay
   where o.id = p_order_id;
end;
$$;

-- Reduces (p_sign < 0) or restores (p_sign > 0) stock for every catalogue line of an order.
-- Products with no stock count (stock_quantity is null) are untracked and never change.
-- Rows are touched in product order so two sales at once cannot deadlock.
create or replace function private.adjust_stock(p_order_id uuid, p_sign integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  it record;
begin
  for it in
    select oi.product_id, sum(oi.quantity)::int as qty
      from public.order_items oi
     where oi.order_id = p_order_id and oi.product_id is not null
     group by oi.product_id
     order by oi.product_id
  loop
    if p_sign < 0 then
      update public.products p
         set stock_quantity = p.stock_quantity - it.qty
       where p.id = it.product_id and p.stock_quantity is not null and p.stock_quantity >= it.qty;
      if not found and exists (select 1 from public.products p where p.id = it.product_id and p.stock_quantity is not null) then
        raise exception 'insufficient_stock';
      end if;
    else
      update public.products p
         set stock_quantity = p.stock_quantity + it.qty
       where p.id = it.product_id and p.stock_quantity is not null;
    end if;
  end loop;
end;
$$;

-- Validates and inserts the lines of an order, returns the total in kobo.
--   p_mode 'public' : storefront checkout. Catalogue products only, price ALWAYS read from the database, product must
--                     be published and available, and the stock must cover the quantity.
--   p_mode 'vendor' : manual sale. Catalogue products (price may be overridden by the vendor) or custom lines.
create or replace function private.add_order_items(p_order_id uuid, p_store_id uuid, p_items jsonb, p_mode text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  e       jsonb;
  q       numeric;
  pr      numeric;
  v_pid   uuid;
  v_name  text;
  v_var   text;
  v_price bigint;
  v_qty   integer;
  v_total bigint := 0;
  prod    public.products;
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
    if q <> trunc(q) or q < 1 or q > 10000 then
      raise exception 'invalid_item';
    end if;
    v_qty := q::integer;
    v_var := nullif(left(btrim(coalesce(e ->> 'variant', '')), 60), '');

    v_pid := null;
    if jsonb_typeof(e -> 'product_id') = 'string' then
      begin
        v_pid := (e ->> 'product_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid_item';
      end;
    end if;

    -- A price the vendor typed (vendor mode only). Whole kobo, 0 to ₦100,000,000.
    pr := null;
    if p_mode = 'vendor' and jsonb_typeof(e -> 'unit_price_kobo') = 'number' then
      pr := (e ->> 'unit_price_kobo')::numeric;
      if pr <> trunc(pr) or pr < 0 or pr > 10000000000 then
        raise exception 'invalid_item';
      end if;
    end if;

    if v_pid is not null then
      select * into prod from public.products where id = v_pid and store_id = p_store_id;
      if not found then
        raise exception 'product_not_found';
      end if;
      if p_mode = 'public' and (prod.status <> 'published' or not prod.is_available) then
        raise exception 'product_unavailable';
      end if;
      v_name := prod.name;
      v_price := coalesce(pr::bigint, prod.price_kobo::bigint);
    else
      if p_mode <> 'vendor' or pr is null then
        raise exception 'invalid_item';
      end if;
      v_name := left(btrim(coalesce(e ->> 'name', '')), 120);
      if v_name = '' or v_name ~ '[<>]' then
        raise exception 'invalid_item';
      end if;
      v_price := pr::bigint;
    end if;

    insert into public.order_items (order_id, product_id, product_name, variant, unit_price_kobo, quantity, line_total_kobo)
    values (p_order_id, v_pid, v_name, v_var, v_price, v_qty, v_price * v_qty);
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
  ) then
    raise exception 'insufficient_stock';
  end if;

  return v_total;
end;
$$;

revoke all on function private.new_order_reference(), private.refresh_order_payment(uuid), private.adjust_stock(uuid, integer),
  private.upsert_customer(uuid, text, text, text, text), private.add_order_items(uuid, uuid, jsonb, text) from public;

-- ---------------------------------------------------------------- public checkout (no login): creates a PENDING order
-- Called by the place-order edge function. Does not touch stock and records no payment.
create or replace function public.place_store_order(
  p_store_slug text, p_customer jsonb, p_items jsonb, p_notes text, p_address text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s      public.stores;
  k      text;
  recent integer;
  cid    uuid;
  oid    uuid;
  ref    text;
  total  bigint;
begin
  select * into s from public.stores where slug = lower(coalesce(p_store_slug, '')) and is_published and status = 'active';
  if not found then
    raise exception 'store_not_found';
  end if;

  if p_customer is null or jsonb_typeof(p_customer) <> 'object' or char_length(btrim(coalesce(p_customer ->> 'name', ''))) < 2 then
    raise exception 'invalid_customer';
  end if;
  k := public.phone_key(p_customer ->> 'phone');
  if k is null or char_length(k) < 7 then
    raise exception 'invalid_customer';
  end if;

  -- Basic abuse guard: at most 5 unconfirmed orders per phone number per store per hour.
  select count(*) into recent
    from public.orders o join public.customers c on c.id = o.customer_id
   where o.store_id = s.id and c.phone_key = k and o.status = 'pending' and o.created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'too_many_orders';
  end if;

  cid := private.upsert_customer(s.id, p_customer ->> 'name', p_customer ->> 'phone', p_customer ->> 'email', p_address);
  ref := private.new_order_reference();

  insert into public.orders (store_id, customer_id, reference, channel, status, delivery_address, notes)
  values (s.id, cid, ref, 'store', 'pending', nullif(left(btrim(coalesce(p_address, '')), 300), ''),
          nullif(left(btrim(coalesce(p_notes, '')), 500), ''))
  returning id into oid;

  total := private.add_order_items(oid, s.id, p_items, 'public');
  if total <= 0 then
    raise exception 'invalid_item';
  end if;
  update public.orders set total_kobo = total where id = oid;

  return jsonb_build_object(
    'order_id', oid, 'reference', ref, 'total_kobo', total,
    'store_name', s.name, 'store_phone', s.contact_phone
  );
end;
$$;

-- ---------------------------------------------------------------- vendor: record a sale made outside the storefront
create or replace function public.record_sale(
  p_store_id    uuid,
  p_customer_id uuid,
  p_customer    jsonb,
  p_items       jsonb,
  p_channel     text,
  p_paid_kobo   bigint,
  p_method      text,
  p_note        text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid   uuid;
  oid   uuid;
  ref   text;
  total bigint;
  paid  bigint := coalesce(p_paid_kobo, 0);
begin
  if p_channel not in ('store', 'whatsapp', 'instagram', 'facebook', 'walk_in', 'other') then
    raise exception 'invalid_channel';
  end if;

  if p_customer_id is not null then
    select id into cid from public.customers where id = p_customer_id and store_id = p_store_id;
    if not found then
      raise exception 'customer_not_found';
    end if;
  else
    if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
      raise exception 'invalid_customer';
    end if;
    cid := private.upsert_customer(p_store_id, p_customer ->> 'name', p_customer ->> 'phone',
                                   p_customer ->> 'email', p_customer ->> 'address');
  end if;

  ref := private.new_order_reference();
  insert into public.orders (store_id, customer_id, reference, channel, status, notes)
  values (p_store_id, cid, ref, p_channel, 'confirmed', nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  returning id into oid;

  total := private.add_order_items(oid, p_store_id, p_items, 'vendor');
  if total <= 0 then
    raise exception 'invalid_item';
  end if;
  update public.orders set total_kobo = total where id = oid;

  if paid < 0 or paid > total then
    raise exception 'invalid_payment';
  end if;
  if paid > 0 then
    if p_method is null or p_method not in ('cash', 'bank_transfer', 'pos', 'other') then
      raise exception 'invalid_payment';
    end if;
    insert into public.order_payments (order_id, store_id, amount_kobo, method, source, note)
    values (oid, p_store_id, paid, p_method, 'manual', null);
  end if;
  perform private.refresh_order_payment(oid);

  -- The sale is real from this moment: reduce stock (raises insufficient_stock and rolls everything back if short).
  perform private.adjust_stock(oid, -1);
  update public.orders set stock_applied = true where id = oid;

  return jsonb_build_object(
    'order_id', oid, 'reference', ref, 'customer_id', cid,
    'total_kobo', total, 'paid_kobo', paid, 'outstanding_kobo', total - paid
  );
end;
$$;

-- ---------------------------------------------------------------- vendor: move an order along (stock follows the status)
create or replace function public.set_order_status(p_store_id uuid, p_order_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if p_status not in ('pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled') then
    raise exception 'invalid_status';
  end if;

  select * into o from public.orders where id = p_order_id and store_id = p_store_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if o.status = p_status then
    return jsonb_build_object('order_id', o.id, 'status', o.status);
  end if;
  if o.status = 'cancelled' then
    raise exception 'order_cancelled';           -- a cancelled order is final; record a new sale instead
  end if;
  if p_status = 'pending' then
    raise exception 'invalid_transition';        -- once confirmed, an order does not go back to "pending"
  end if;

  if p_status = 'cancelled' then
    if o.stock_applied then
      perform private.adjust_stock(o.id, 1);
    end if;
    update public.orders set status = 'cancelled', stock_applied = false where id = o.id;
  else
    -- pending -> confirmed (or any later status): the order becomes a sale, so stock is reduced once.
    if not o.stock_applied then
      perform private.adjust_stock(o.id, -1);
    end if;
    update public.orders set status = p_status, stock_applied = true where id = o.id;
  end if;

  return jsonb_build_object('order_id', o.id, 'status', p_status);
end;
$$;

-- ---------------------------------------------------------------- vendor: record a payment against an order (manual)
create or replace function public.record_order_payment(
  p_store_id uuid, p_order_id uuid, p_amount_kobo bigint, p_method text, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'invalid_payment';
  end if;
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'pos', 'other') then
    raise exception 'invalid_payment';
  end if;

  select * into o from public.orders where id = p_order_id and store_id = p_store_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if o.status = 'cancelled' then
    raise exception 'order_cancelled';
  end if;
  if p_amount_kobo > o.total_kobo - o.paid_kobo then
    raise exception 'overpayment';
  end if;

  insert into public.order_payments (order_id, store_id, amount_kobo, method, source, note)
  values (o.id, p_store_id, p_amount_kobo, p_method, 'manual', nullif(left(btrim(coalesce(p_note, '')), 300), ''));
  perform private.refresh_order_payment(o.id);

  select * into o from public.orders where id = o.id;
  return jsonb_build_object(
    'order_id', o.id, 'total_kobo', o.total_kobo, 'paid_kobo', o.paid_kobo,
    'outstanding_kobo', o.total_kobo - o.paid_kobo, 'payment_status', o.payment_status
  );
end;
$$;

-- ---------------------------------------------------------------- vendor: generate (or re-issue) a receipt
-- First call creates revision 1 and a receipt number. Calling again with nothing changed returns the same receipt.
-- When the paid amount or total has changed since the latest revision, a NEW revision is added (same receipt number);
-- earlier revisions are never edited, so the original transaction history is preserved.
create or replace function public.generate_receipt(p_store_id uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o       public.orders;
  s       public.stores;
  c       public.customers;
  latest  public.receipts;
  no_     text;
  rev     integer;
  snap    jsonb;
  rec     public.receipts;
begin
  select * into o from public.orders where id = p_order_id and store_id = p_store_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  select * into s from public.stores where id = p_store_id;
  select * into c from public.customers where id = o.customer_id;

  select * into latest from public.receipts where order_id = o.id order by revision desc limit 1;
  if found
     and (latest.snapshot -> 'totals' ->> 'paid_kobo')::bigint = o.paid_kobo
     and (latest.snapshot -> 'totals' ->> 'total_kobo')::bigint = o.total_kobo then
    return jsonb_build_object('id', latest.id, 'receipt_no', latest.receipt_no, 'revision', latest.revision,
                              'snapshot', latest.snapshot, 'created_at', latest.created_at, 'created', false);
  end if;

  if found then
    no_ := latest.receipt_no;
    rev := latest.revision + 1;
  else
    update public.stores set receipt_counter = receipt_counter + 1 where id = p_store_id returning receipt_counter into rev;
    no_ := 'RC-' || lpad(rev::text, 6, '0');
    rev := 1;
  end if;

  snap := jsonb_build_object(
    'business', jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'phone', s.contact_phone,
                                   'email', s.contact_email, 'city', s.city, 'state', s.state, 'slug', s.slug),
    'customer', jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'address', c.address),
    'order', jsonb_build_object('reference', o.reference, 'channel', o.channel, 'status', o.status, 'created_at', o.created_at),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                'name', i.product_name, 'variant', i.variant, 'quantity', i.quantity,
                'unit_price_kobo', i.unit_price_kobo, 'line_total_kobo', i.line_total_kobo) order by i.line_total_kobo desc, i.id)
              from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'totals', jsonb_build_object('total_kobo', o.total_kobo, 'paid_kobo', o.paid_kobo,
                                 'outstanding_kobo', o.total_kobo - o.paid_kobo, 'payment_status', o.payment_status),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
                'amount_kobo', p.amount_kobo, 'method', p.method, 'source', p.source, 'recorded_at', p.recorded_at)
                order by p.recorded_at, p.id)
              from public.order_payments p where p.order_id = o.id), '[]'::jsonb),
    'issued_at', now()
  );

  insert into public.receipts (store_id, order_id, receipt_no, revision, snapshot)
  values (p_store_id, o.id, no_, rev, snap)
  returning * into rec;

  return jsonb_build_object('id', rec.id, 'receipt_no', rec.receipt_no, 'revision', rec.revision,
                            'snapshot', rec.snapshot, 'created_at', rec.created_at, 'created', true);
end;
$$;

-- ---------------------------------------------------------------- vendor: dashboard figures (all from this vendor's rows)
-- "Today" and "this month" follow Nigerian time. Sales = orders that are not pending and not cancelled.
create or replace function public.dashboard_summary(p_store_id uuid, p_low_stock integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  result jsonb;
begin
  select jsonb_build_object(
    'total_sales_kobo',   coalesce(sum(o.total_kobo) filter (where o.status not in ('pending', 'cancelled')), 0),
    'sales_today_kobo',   coalesce(sum(o.total_kobo) filter (where o.status not in ('pending', 'cancelled')
                              and (o.created_at at time zone 'Africa/Lagos')::date = today), 0),
    'sales_month_kobo',   coalesce(sum(o.total_kobo) filter (where o.status not in ('pending', 'cancelled')
                              and date_trunc('month', o.created_at at time zone 'Africa/Lagos') = date_trunc('month', today::timestamp)), 0),
    'total_orders',       count(*) filter (where o.status <> 'cancelled'),
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

-- Only the service role (edge functions) may call these. Browsers cannot, so ids and amounts can't be forged from the client.
revoke all on function
  public.place_store_order(text, jsonb, jsonb, text, text),
  public.record_sale(uuid, uuid, jsonb, jsonb, text, bigint, text, text),
  public.set_order_status(uuid, uuid, text),
  public.record_order_payment(uuid, uuid, bigint, text, text),
  public.generate_receipt(uuid, uuid),
  public.dashboard_summary(uuid, integer)
  from public, anon, authenticated;
grant execute on function
  public.place_store_order(text, jsonb, jsonb, text, text),
  public.record_sale(uuid, uuid, jsonb, jsonb, text, bigint, text, text),
  public.set_order_status(uuid, uuid, text),
  public.record_order_payment(uuid, uuid, bigint, text, text),
  public.generate_receipt(uuid, uuid),
  public.dashboard_summary(uuid, integer)
  to service_role;
