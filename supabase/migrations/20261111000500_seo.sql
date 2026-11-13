-- SellSharp · 0500 · SEO: store SEO fields, products, product images, slug redirects,
--                    indexing eligibility, public views, sitemap + directory views
-- Safe to re-run.
--
-- Rules implemented here (one place, so the website, the sitemaps and the dashboard always agree):
--   * A STORE is indexable when it is published (active subscription), not suspended, the vendor allows indexing,
--     its public profile is complete (description ≥ 30 chars, category, location) and it has ≥ 1 eligible product.
--   * A PRODUCT is indexable when it is published, has a name, a description ≥ 20 chars and ≥ 1 image, the vendor
--     allows indexing, and its store is published and active. Out-of-stock products stay indexable.
--   * Only views expose public data. They never include owner ids, phone numbers, emails or any private column.

-- ---------------------------------------------------------------- helpers
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(lower(replace(replace(coalesce(p_text, ''), '''', ''), '’', '')), '[^a-z0-9]+', '-', 'g'),
    '-'
  )
$$;

-- ---------------------------------------------------------------- store SEO + contact columns
alter table public.stores
  add column if not exists og_image_url   text,
  add column if not exists indexable      boolean not null default true,
  add column if not exists seo_keywords   text,
  add column if not exists contact_phone  text,
  add column if not exists contact_email  text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_text_no_markup') then
    alter table public.stores add constraint stores_text_no_markup check (
      name !~ '[<>]' and description !~ '[<>]'
      and coalesce(tagline, '') !~ '[<>]' and coalesce(seo_title, '') !~ '[<>]'
      and coalesce(seo_description, '') !~ '[<>]' and coalesce(seo_keywords, '') !~ '[<>]'
      and coalesce(city, '') !~ '[<>]' and coalesce(state, '') !~ '[<>]' and category !~ '[<>]'
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stores_og_image_https') then
    alter table public.stores add constraint stores_og_image_https check (
      og_image_url is null or (og_image_url ~ '^https://' and char_length(og_image_url) <= 500)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stores_seo_keywords_len') then
    alter table public.stores add constraint stores_seo_keywords_len check (
      seo_keywords is null or char_length(seo_keywords) <= 200
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stores_contact_format') then
    alter table public.stores add constraint stores_contact_format check (
      (contact_phone is null or contact_phone ~ '^\+?[0-9 ()-]{7,20}$')
      and (contact_email is null or (char_length(contact_email) <= 120 and contact_email ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$'))
    );
  end if;
end $$;

-- ---------------------------------------------------------------- products
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id) on delete cascade,
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  name            text not null check (char_length(btrim(name)) between 2 and 120),
  description     text not null default '' check (char_length(description) <= 5000),
  price_kobo      integer not null check (price_kobo > 0),
  category        text check (category is null or char_length(category) <= 40),
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_available    boolean not null default true,
  stock_quantity  integer check (stock_quantity is null or stock_quantity >= 0),
  seo_title       text check (seo_title is null or char_length(seo_title) <= 60),
  seo_description text check (seo_description is null or char_length(seo_description) <= 160),
  og_image_url    text check (og_image_url is null or (og_image_url ~ '^https://' and char_length(og_image_url) <= 500)),
  indexable       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint products_slug_unique_per_store unique (store_id, slug),
  constraint products_text_no_markup check (
    name !~ '[<>]' and description !~ '[<>]' and coalesce(category, '') !~ '[<>]'
    and coalesce(seo_title, '') !~ '[<>]' and coalesce(seo_description, '') !~ '[<>]'
  )
);
create index if not exists products_store_status_idx on public.products (store_id, status);

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url        text not null check (url ~ '^https://' and char_length(url) <= 500),
  alt_text   text check (alt_text is null or (char_length(alt_text) <= 125 and alt_text !~ '[<>]')),
  position   integer not null default 0,
  width      integer check (width is null or width > 0),
  height     integer check (height is null or height > 0),
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- When a product is renamed its old URL keeps working: visitors and Google are redirected (301) to the new one.
create table if not exists public.product_slug_redirects (
  store_id   uuid not null references public.stores (id) on delete cascade,
  old_slug   text not null,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, old_slug)
);

create or replace function public.products_track_slug_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    insert into public.product_slug_redirects (store_id, old_slug, product_id)
    values (old.store_id, old.slug, old.id)
    on conflict (store_id, old_slug) do update set product_id = excluded.product_id;
    -- Renaming back to an earlier slug removes the redirect that pointed away from it.
    delete from public.product_slug_redirects where store_id = new.store_id and old_slug = new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists products_track_slug_change on public.products;
create trigger products_track_slug_change
  after update of slug on public.products
  for each row execute function public.products_track_slug_change();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- row level security
alter table public.products               enable row level security;
alter table public.product_images         enable row level security;
alter table public.product_slug_redirects enable row level security;

drop policy if exists "products: owner reads own" on public.products;
create policy "products: owner reads own" on public.products
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));

drop policy if exists "product_images: owner reads own" on public.product_images;
create policy "product_images: owner reads own" on public.product_images
  for select to authenticated
  using (exists (
    select 1 from public.products p join public.stores s on s.id = p.store_id
    where p.id = product_id and s.owner_id = (select auth.uid())
  ));

revoke all on public.products, public.product_images, public.product_slug_redirects from anon, authenticated;
grant select on public.products, public.product_images to authenticated;

-- ---------------------------------------------------------------- eligibility (the single source of truth)
-- Each returns the list of reasons something is NOT eligible. Empty list = eligible.
-- They live in the "private" schema, which the Data API does not expose, and run as their owner (SECURITY DEFINER):
-- Postgres checks function privileges against whoever queries a view, so the public views need these callable by
-- anon, while keeping them out of reach of API clients.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.product_problems(p public.products, s public.stores)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when s.is_published is not true then 'store_not_published' end,
    case when s.status <> 'active' then 'store_suspended' end,
    case when s.indexable is not true then 'store_indexing_disabled' end,
    case when p.status <> 'published' then 'not_published' end,
    case when p.indexable is not true then 'indexing_disabled' end,
    case when char_length(btrim(p.name)) < 2 then 'name_missing' end,
    case when char_length(btrim(p.description)) < 20 then 'description_too_short' end,
    case when not exists (select 1 from public.product_images i where i.product_id = p.id) then 'no_image' end
  ], null)
$$;

create or replace function private.store_problems(s public.stores)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when s.is_published is not true then 'not_published' end,
    case when s.status <> 'active' then 'suspended' end,
    case when s.indexable is not true then 'indexing_disabled' end,
    case when char_length(btrim(s.description)) < 30 then 'description_too_short' end,
    case when btrim(coalesce(s.category, '')) = '' then 'missing_category' end,
    case when btrim(coalesce(s.state, '')) = '' and btrim(coalesce(s.city, '')) = '' then 'missing_location' end,
    case when not exists (
      select 1 from public.products p
      where p.store_id = s.id and cardinality(private.product_problems(p, s)) = 0
    ) then 'no_eligible_products' end
  ], null)
$$;

revoke all on function private.product_problems(public.products, public.stores) from public;
revoke all on function private.store_problems(public.stores) from public;
grant execute on function private.product_problems(public.products, public.stores) to anon, authenticated, service_role;
grant execute on function private.store_problems(public.stores) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- public views (the ONLY public surface)
drop view if exists public.sitemap_products, public.sitemap_stores, public.public_directory_locations,
  public.public_directory_categories, public.public_product_redirects, public.public_products, public.public_stores;

create view public.public_stores as
  select s.id, s.slug, s.name, s.tagline, s.description,
         s.category, public.slugify(s.category) as category_slug,
         s.city, public.slugify(s.city) as city_slug,
         s.state, public.slugify(s.state) as state_slug,
         s.logo_url, s.cover_url, s.og_image_url, s.seo_title, s.seo_description,
         cardinality(private.store_problems(s)) = 0 as is_indexable,
         (select count(*) from public.products p where p.store_id = s.id and p.status = 'published')::int as product_count,
         s.created_at, s.updated_at,
         greatest(s.updated_at, coalesce((select max(p.updated_at) from public.products p
                                           where p.store_id = s.id and p.status = 'published'), s.updated_at)) as last_modified
  from public.stores s
  where s.is_published and s.status = 'active';

create view public.public_products as
  select p.id, s.slug as store_slug, p.slug, p.name, p.description, p.price_kobo,
         (p.is_available and coalesce(p.stock_quantity, 1) > 0) as is_available,
         p.category, p.seo_title, p.seo_description, p.og_image_url,
         coalesce((select jsonb_agg(jsonb_build_object('url', i.url, 'alt', i.alt_text, 'width', i.width, 'height', i.height)
                                    order by i.position, i.created_at)
                     from public.product_images i where i.product_id = p.id), '[]'::jsonb) as images,
         cardinality(private.product_problems(p, s)) = 0 as is_indexable,
         p.created_at, p.updated_at
  from public.products p
  join public.stores s on s.id = p.store_id
  where s.is_published and s.status = 'active' and p.status = 'published';

create view public.public_product_redirects as
  select s.slug as store_slug, r.old_slug, p.slug as new_slug
  from public.product_slug_redirects r
  join public.products p on p.id = r.product_id and p.status = 'published'
  join public.stores s on s.id = r.store_id and s.is_published and s.status = 'active';

-- Sitemaps list ONLY indexable pages, with accurate last-modified dates.
create view public.sitemap_stores as
  select slug, last_modified from public.public_stores where is_indexable;

create view public.sitemap_products as
  select store_slug, slug, updated_at as last_modified from public.public_products where is_indexable;

-- Directory facets: a category/location only appears when it has indexable stores.
create view public.public_directory_categories as
  select category_slug as slug, min(category) as name, count(*)::int as store_count
  from public.public_stores
  where is_indexable and category_slug <> ''
  group by category_slug;

create view public.public_directory_locations as
  select 'state'::text as kind, state_slug as slug, min(state) as name, count(*)::int as store_count
  from public.public_stores where is_indexable and state_slug <> '' group by state_slug
  union all
  select 'city', city_slug, min(city), count(*)::int
  from public.public_stores where is_indexable and city_slug <> '' group by city_slug;

revoke all on public.public_stores, public.public_products, public.public_product_redirects,
  public.sitemap_stores, public.sitemap_products, public.public_directory_categories,
  public.public_directory_locations from anon, authenticated;
grant select on public.public_stores, public.public_products, public.public_product_redirects,
  public.sitemap_stores, public.sitemap_products, public.public_directory_categories,
  public.public_directory_locations to anon, authenticated;

-- ---------------------------------------------------------------- vendor-facing SEO status (service role / edge function)
create or replace function public.store_seo_status(p_owner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.stores;
  problems text[];
  published_products int;
  eligible_products int;
begin
  select * into s from public.stores where owner_id = p_owner;
  if not found then
    return null;
  end if;
  problems := private.store_problems(s);
  select count(*) filter (where p.status = 'published'),
         count(*) filter (where cardinality(private.product_problems(p, s)) = 0)
    into published_products, eligible_products
    from public.products p where p.store_id = s.id;

  return jsonb_build_object(
    'published', s.is_published and s.status = 'active',
    'eligible', cardinality(problems) = 0,
    'problems', to_jsonb(problems),
    'custom_title', s.seo_title is not null,
    'custom_description', s.seo_description is not null,
    'has_social_image', coalesce(s.og_image_url, s.cover_url, s.logo_url) is not null,
    'published_products', published_products,
    'eligible_products', eligible_products
  );
end;
$$;

revoke all on function public.store_seo_status(uuid) from public, anon, authenticated;
grant execute on function public.store_seo_status(uuid) to service_role;
