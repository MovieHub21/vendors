-- SellSharp · 0100 · store usernames (slugs): reserved words + validation
-- A store lives at sellsharp.ng/{slug}, so a slug must never collide with a real route.
-- KEEP IN SYNC with src/lib/reservedSlugs.ts (a test fails if the two lists differ).

create table if not exists public.reserved_slugs (
  slug text primary key check (slug = lower(slug))
);

insert into public.reserved_slugs (slug) values
  ('about'),
  ('account'),
  ('admin'),
  ('api'),
  ('app'),
  ('assets'),
  ('auth'),
  ('billing'),
  ('blog'),
  ('cart'),
  ('cdn'),
  ('checkout'),
  ('contact'),
  ('customers'),
  ('dashboard'),
  ('debts'),
  ('docs'),
  ('faq'),
  ('features'),
  ('forgot-password'),
  ('help'),
  ('legal'),
  ('login'),
  ('mail'),
  ('null'),
  ('onboarding'),
  ('order'),
  ('orders'),
  ('payment'),
  ('payments'),
  ('paystack'),
  ('pricing'),
  ('privacy'),
  ('products'),
  ('public'),
  ('receipt'),
  ('receipts'),
  ('register'),
  ('reports'),
  ('reset-password'),
  ('robots'),
  ('security'),
  ('sellsharp'),
  ('settings'),
  ('shop'),
  ('shopoga'),
  ('shops'),
  ('signup'),
  ('sitemap'),
  ('static'),
  ('status'),
  ('store'),
  ('stores'),
  ('support'),
  ('terms'),
  ('undefined'),
  ('vendor'),
  ('vendors'),
  ('verify-email'),
  ('webhook'),
  ('webhooks'),
  ('www')
on conflict (slug) do nothing;

alter table public.reserved_slugs enable row level security;
-- No policies: only the service role (edge functions) and SECURITY DEFINER functions read this table.
revoke all on public.reserved_slugs from anon, authenticated;

-- Returns NULL when the slug is acceptable, otherwise the reason:
-- 'too_short' | 'too_long' | 'invalid_characters' | 'reserved'
create or replace function public.slug_problem(p_slug text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text := lower(btrim(coalesce(p_slug, '')));
begin
  if char_length(v) < 3 then
    return 'too_short';
  elsif char_length(v) > 30 then
    return 'too_long';
  elsif v !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return 'invalid_characters';
  elsif exists (select 1 from public.reserved_slugs r where r.slug = v) then
    return 'reserved';
  end if;
  return null;
end;
$$;

revoke all on function public.slug_problem(text) from public, anon, authenticated;
grant execute on function public.slug_problem(text) to service_role;
