-- SellSharp · 0700 · vendor-designed receipts and invoices
--   * document_templates      the layout a vendor designed (JSON) and the CSS generated from it, one per kind per store
--   * store_payment_details   bank / account details a vendor wants printed on invoices
--   * get_invoice()           a live invoice for an order that still has a balance (unpaid or part-paid)
-- Safe to re-run. Earlier migrations are not touched: receipts keep working exactly as before.

-- ---------------------------------------------------------------- templates (written only by the save-document-template edge function)
create table if not exists public.document_templates (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  kind       text not null check (kind in ('receipt', 'invoice')),
  layout     jsonb not null,
  css        text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, kind),
  constraint document_templates_layout_shape check (jsonb_typeof(layout) = 'object' and pg_column_size(layout) <= 60000),
  -- Defence in depth: the edge function generates this CSS itself, and the database still refuses anything that could
  -- load a resource, start an at-rule or break out of a <style> element.
  constraint document_templates_css_safe check (
    char_length(css) between 1 and 60000
    and css !~* '(@|url[[:space:]]*\(|expression|javascript|behavior|binding|[<>\\])'
  )
);
create index if not exists document_templates_store_idx on public.document_templates (store_id);

drop trigger if exists document_templates_set_updated_at on public.document_templates;
create trigger document_templates_set_updated_at
  before update on public.document_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- bank / payment details shown on invoices
create table if not exists public.store_payment_details (
  store_id       uuid primary key references public.stores (id) on delete cascade,
  bank_name      text check (bank_name is null or (char_length(bank_name) between 1 and 80 and bank_name !~ '[<>]')),
  account_name   text check (account_name is null or (char_length(account_name) between 1 and 120 and account_name !~ '[<>]')),
  account_number text check (account_number is null or account_number ~ '^[0-9A-Za-z .-]{4,30}$'),
  extra_note     text check (extra_note is null or (char_length(extra_note) between 1 and 300 and extra_note !~ '[<>]')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists store_payment_details_set_updated_at on public.store_payment_details;
create trigger store_payment_details_set_updated_at
  before update on public.store_payment_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- row level security (a vendor reads only their own; writes go through edge functions)
alter table public.document_templates    enable row level security;
alter table public.store_payment_details enable row level security;

drop policy if exists "document_templates: owner reads own" on public.document_templates;
create policy "document_templates: owner reads own" on public.document_templates
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));

drop policy if exists "store_payment_details: owner reads own" on public.store_payment_details;
create policy "store_payment_details: owner reads own" on public.store_payment_details
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));

revoke all on public.document_templates, public.store_payment_details from anon, authenticated;
grant select on public.document_templates, public.store_payment_details to authenticated;

-- ---------------------------------------------------------------- vendor: live invoice for an order that still has a balance
-- Nothing is stored: the invoice number is the order reference with an INV- prefix, and the figures are read from the
-- order when it is opened, so it always shows what is still owed. Paid and cancelled orders have no invoice.
create or replace function public.get_invoice(p_store_id uuid, p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o  public.orders;
  s  public.stores;
  c  public.customers;
  pd public.store_payment_details;
begin
  select * into o from public.orders where id = p_order_id and store_id = p_store_id;
  if not found then
    raise exception 'order_not_found';
  end if;
  if o.status = 'cancelled' then
    raise exception 'order_cancelled';
  end if;
  if o.payment_status = 'paid' then
    raise exception 'order_paid';
  end if;

  select * into s  from public.stores  where id = p_store_id;
  select * into c  from public.customers where id = o.customer_id;
  select * into pd from public.store_payment_details where store_id = p_store_id;

  return jsonb_build_object(
    'invoice_no', 'INV-' || o.reference,
    'issued_at', now(),
    'bank', case when pd.store_id is null then null else jsonb_build_object(
              'bank_name', pd.bank_name, 'account_name', pd.account_name,
              'account_number', pd.account_number, 'extra_note', pd.extra_note) end,
    'snapshot', jsonb_build_object(
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
    )
  );
end;
$$;

-- Only the service role (edge functions) may call it, same as the other sales functions.
revoke all on function public.get_invoice(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_invoice(uuid, uuid) to service_role;
