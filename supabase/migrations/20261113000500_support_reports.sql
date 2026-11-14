-- Extend the existing support inbox for storefront reports and vendor complaints.
alter table public.support_requests
  add column if not exists phone text check (phone is null or (char_length(phone) between 5 and 30 and phone ~ '^\+?[0-9 ()-]+$')),
  add column if not exists request_type text not null default 'general' check (request_type in ('general', 'store_report', 'vendor_complaint')),
  add column if not exists reported_store_id uuid references public.stores (id) on delete set null,
  add column if not exists reported_store_name text,
  add column if not exists reported_store_slug text;

create index if not exists support_requests_type_created_idx on public.support_requests (request_type, created_at desc);
