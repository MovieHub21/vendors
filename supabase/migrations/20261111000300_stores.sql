-- SellSharp · 0300 · vendor stores

create table if not exists public.stores (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null unique references auth.users (id) on delete cascade, -- one store per vendor
  name            text not null check (char_length(btrim(name)) between 2 and 80),
  slug            text not null,
  tagline         text check (tagline is null or char_length(tagline) <= 100),
  description     text not null default '' check (char_length(description) <= 1000),
  category        text not null check (char_length(category) between 2 and 40),
  city            text check (city is null or char_length(city) <= 60),
  state           text check (state is null or char_length(state) <= 40),
  logo_url        text,
  cover_url       text,
  is_published    boolean not null default false,
  status          text not null default 'active' check (status in ('active', 'suspended')),
  seo_title       text check (seo_title is null or char_length(seo_title) <= 60),
  seo_description text check (seo_description is null or char_length(seo_description) <= 160),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint stores_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 30
  )
);

-- The unique index is the final arbiter for "is this username taken?" (it also closes race conditions).
create unique index if not exists stores_slug_key on public.stores (slug);

-- Reserved words (a CHECK cannot read another table, so a trigger does it) and slug stability:
-- changing a slug breaks every shared link and its search ranking, so it is frozen once created.
-- To allow renames later, drop the "immutable" branch and add a redirect table instead.
create or replace function public.stores_guard_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception 'slug_immutable' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and exists (select 1 from public.reserved_slugs r where r.slug = new.slug) then
    raise exception 'slug_reserved' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists stores_guard_slug on public.stores;
create trigger stores_guard_slug
  before insert or update of slug on public.stores
  for each row execute function public.stores_guard_slug();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

alter table public.stores enable row level security;

drop policy if exists "stores: owner reads own" on public.stores;
create policy "stores: owner reads own" on public.stores
  for select to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.stores from anon, authenticated;
grant select on public.stores to authenticated;

<<<<<<< HEAD
-- The public read surface (public_stores and friends) is defined in 0500_seo.sql, next to the indexing rules it depends on.
=======
-- What the public (and the storefront / link-preview function) may see: published, active stores only,
-- and never the owner's id. The view runs with its owner's rights, so anon needs no access to the table itself.
create or replace view public.public_stores as
  select id, slug, name, tagline, description, category, city, state,
         logo_url, cover_url, seo_title, seo_description, created_at, updated_at
  from public.stores
  where is_published and status = 'active';

revoke all on public.public_stores from anon, authenticated;
grant select on public.public_stores to anon, authenticated;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
