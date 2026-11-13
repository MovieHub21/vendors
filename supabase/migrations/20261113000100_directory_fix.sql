-- =============================================================================
-- Migration: Fix directory views so ALL published/active stores are counted
-- and shown — not just fully SEO-eligible ones. Also fixes:
--   • Category counts (now counts all public_stores rows, not just indexable)
--   • Location deduplication (Lagos city vs Lagos state, Abuja vs FCT Abuja)
-- =============================================================================

-- ── Category facets ───────────────────────────────────────────────────────────
-- Drop and recreate so we can change the base filter from is_indexable to all.
DROP VIEW IF EXISTS public.public_directory_categories;

CREATE VIEW public.public_directory_categories AS
  SELECT
    category_slug                   AS slug,
    min(category)                   AS name,
    count(*)::int                   AS store_count
  FROM public.public_stores
  WHERE category_slug IS NOT NULL
    AND category_slug <> ''
  GROUP BY category_slug;

-- ── Location facets ───────────────────────────────────────────────────────────
-- Deduplicate: emit state rows always; emit city rows ONLY when the city slug
-- differs from the state slug (prevents "Lagos" appearing twice because both
-- city="Lagos" and state="Lagos" slugify to "lagos").
DROP VIEW IF EXISTS public.public_directory_locations;

CREATE VIEW public.public_directory_locations AS
  -- State-level entries
  SELECT
    'state'::text   AS kind,
    state_slug      AS slug,
    min(state)      AS name,
    count(*)::int   AS store_count
  FROM public.public_stores
  WHERE state_slug IS NOT NULL
    AND state_slug <> ''
  GROUP BY state_slug

  UNION ALL

  -- City-level entries — only when city slug ≠ state slug
  SELECT
    'city'::text    AS kind,
    city_slug       AS slug,
    min(city)       AS name,
    count(*)::int   AS store_count
  FROM public.public_stores
  WHERE city_slug  IS NOT NULL
    AND city_slug  <> ''
    AND city_slug  <> state_slug
  GROUP BY city_slug;
