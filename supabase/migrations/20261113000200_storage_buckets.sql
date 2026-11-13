-- =============================================================================
-- Migration: Create the product-images Supabase Storage bucket and its
-- Row-Level Security policies so vendors can upload product photos.
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- =============================================================================

-- ── Bucket ────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,   -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS policies ─────────────────────────────────────────────────────────────

-- 1. Anyone (including unauthenticated visitors) can VIEW product images
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- 2. Authenticated vendors can UPLOAD product images
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- 3. Authenticated vendors can UPDATE (replace) their own images
CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

-- 4. Authenticated vendors can DELETE their own images
CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
