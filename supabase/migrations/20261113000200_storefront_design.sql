-- Storefront settings, safe to apply when only the original store schema exists or
-- when the later Showcase migration has already been applied. Keep public_stores'
-- existing columns in place and append every supported design field in stable order.
alter table public.stores
  add column if not exists storefront_layout text not null default 'showcase',
  add column if not exists hero_eyebrow text,
  add column if not exists hero_title text,
  add column if not exists hero_description text,
  add column if not exists hero_button_text text,
  add column if not exists category_heading text,
  add column if not exists products_heading text,
  add column if not exists promo_one_title text,
  add column if not exists promo_one_text text,
  add column if not exists promo_one_image_url text,
  add column if not exists promo_two_title text,
  add column if not exists promo_two_text text,
  add column if not exists promo_two_image_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists youtube_url text,
  add column if not exists x_url text,
  add column if not exists threads_url text,
  add column if not exists snapchat_url text,
  add column if not exists pinterest_url text,
  add column if not exists linkedin_url text,
  add column if not exists other_social_label text,
  add column if not exists other_social_url text;

alter table public.stores drop constraint if exists stores_storefront_layout_check;
alter table public.stores add constraint stores_storefront_layout_check
  check (storefront_layout in ('editorial', 'classic', 'minimal', 'showcase'));
alter table public.stores alter column storefront_layout set default 'showcase';
update public.stores set storefront_layout = 'showcase' where storefront_layout = 'editorial';

alter table public.stores drop constraint if exists stores_showcase_copy_lengths;
alter table public.stores add constraint stores_showcase_copy_lengths check (
  (hero_eyebrow is null or char_length(hero_eyebrow) <= 50) and
  (hero_title is null or char_length(hero_title) <= 90) and
  (hero_description is null or char_length(hero_description) <= 200) and
  (hero_button_text is null or char_length(hero_button_text) <= 32) and
  (category_heading is null or char_length(category_heading) <= 50) and
  (products_heading is null or char_length(products_heading) <= 60) and
  (promo_one_title is null or char_length(promo_one_title) <= 60) and
  (promo_one_text is null or char_length(promo_one_text) <= 140) and
  (promo_two_title is null or char_length(promo_two_title) <= 60) and
  (promo_two_text is null or char_length(promo_two_text) <= 140) and
  (other_social_label is null or char_length(other_social_label) <= 32)
);

create or replace view public.public_stores as
  select s.id, s.slug, s.name, s.tagline, s.description,
         s.category, public.slugify(s.category) as category_slug,
         s.city, public.slugify(s.city) as city_slug,
         s.state, public.slugify(s.state) as state_slug,
         s.logo_url, s.cover_url, s.og_image_url, s.seo_title, s.seo_description,
         cardinality(private.store_problems(s)) = 0 as is_indexable,
         (select count(*) from public.products p where p.store_id = s.id and p.status = 'published')::int as product_count,
         s.created_at, s.updated_at,
         greatest(s.updated_at, coalesce((select max(p.updated_at) from public.products p
                                           where p.store_id = s.id and p.status = 'published'), s.updated_at)) as last_modified,
         s.contact_phone,
         s.storefront_layout,
         s.hero_eyebrow, s.hero_title, s.hero_description, s.hero_button_text, s.category_heading, s.products_heading,
         s.promo_one_title, s.promo_one_text, s.promo_one_image_url,
         s.promo_two_title, s.promo_two_text, s.promo_two_image_url,
         s.facebook_url, s.instagram_url, s.tiktok_url, s.youtube_url, s.x_url, s.threads_url,
         s.snapchat_url, s.pinterest_url, s.linkedin_url, s.other_social_label, s.other_social_url
  from public.stores s
  where s.is_published and s.status = 'active';

revoke all on public.public_stores from anon, authenticated;
grant select on public.public_stores to anon, authenticated;
