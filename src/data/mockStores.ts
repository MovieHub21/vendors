<<<<<<< HEAD
import { slugify } from "../lib/reservedSlugs";
import type { Product, VendorStore } from "../types/store";

/**
 * Demo vendors shown ONLY when no backend is configured (local development). They are never indexable and the
 * server-side renderer never serves them: real stores come from the database through the public views.
 */
const stamp = "2026-11-01T09:00:00.000Z";

const store = (
  id: string,
  slug: string,
  name: string,
  tagline: string,
  category: string,
  city: string,
  state: string,
  description: string,
): VendorStore => ({
  id,
  slug,
  name,
  tagline,
  description,
  category,
  categorySlug: slugify(category),
  city,
  citySlug: slugify(city),
  state,
  stateSlug: slugify(state),
  isIndexable: false,
  isDemo: true,
  productCount: 3,
  createdAt: stamp,
  updatedAt: stamp,
  lastModified: stamp,
});

export const MOCK_STORES: VendorStore[] = [
  store(
    "store_demo_1",
    "ama-hairs",
    "Ama Hair Studio",
    "Quality wigs & bundles",
    "Hair & wigs",
    "Lagos",
    "Lagos",
    "Premium wigs, bundles and closures for every look. Ama Hair Studio delivers across Lagos and ships nationwide, with careful packaging and clear sizing guidance.",
  ),
  store(
    "store_demo_2",
    "glow-by-ife",
    "Glow by Ife",
    "Skincare that fits your routine",
    "Skincare & beauty",
    "Abuja",
    "FCT (Abuja)",
    "Gentle, honest skincare for Nigerian skin: cleansers, serums and moisturisers chosen for humid weather and everyday use. Based in Abuja with fast delivery.",
  ),
  store(
    "store_demo_3",
    "benin-thrift-hub",
    "Benin Thrift Hub",
    "Hand-picked thrift fashion",
    "Thrift & fashion",
    "Benin City",
    "Edo",
    "Weekly drops of hand-picked thrift fashion: jeans, jackets, dresses and bags in good condition at student-friendly prices. Pickup in Benin City or delivery anywhere.",
  ),
];

const p = (
  storeSlug: string,
=======
import type { Product, VendorStore } from "../types/store";

/**
 * Sample vendors for the frontend-first build. Replace services/stores.ts with real API calls in Phase 6;
 * nothing else should import from this file.
 */
const stamp = "2026-11-01T09:00:00.000Z";

export const MOCK_STORES: VendorStore[] = [
  {
    id: "store_demo_1",
    ownerId: "owner_demo_1",
    name: "Ama Hair Studio",
    slug: "ama-hairs",
    tagline: "Quality wigs & bundles",
    description:
      "Premium wigs, bundles and closures for every look. Ama Hair Studio delivers across Lagos and ships nationwide, with careful packaging and clear sizing guidance.",
    category: "Hair & wigs",
    city: "Lagos",
    state: "Lagos",
    isPublished: true,
    status: "active",
    isDemo: true,
    createdAt: stamp,
    updatedAt: stamp,
  },
  {
    id: "store_demo_2",
    ownerId: "owner_demo_2",
    name: "Glow by Ife",
    slug: "glow-by-ife",
    tagline: "Skincare that fits your routine",
    description:
      "Gentle, honest skincare for Nigerian skin: cleansers, serums and moisturisers chosen for humid weather and everyday use. Based in Abuja with fast delivery.",
    category: "Skincare",
    city: "Abuja",
    state: "FCT",
    isPublished: true,
    status: "active",
    isDemo: true,
    createdAt: stamp,
    updatedAt: stamp,
  },
  {
    id: "store_demo_3",
    ownerId: "owner_demo_3",
    name: "Benin Thrift Hub",
    slug: "benin-thrift-hub",
    tagline: "Hand-picked thrift fashion",
    description:
      "Weekly drops of hand-picked thrift fashion: jeans, jackets, dresses and bags in good condition at student-friendly prices. Pickup in Benin City or delivery anywhere.",
    category: "Thrift fashion",
    city: "Benin City",
    state: "Edo",
    isPublished: true,
    status: "active",
    isDemo: true,
    createdAt: stamp,
    updatedAt: stamp,
  },
];

const p = (
  storeId: string,
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
  slug: string,
  name: string,
  description: string,
  priceNaira: number,
<<<<<<< HEAD
  isAvailable = true,
): Product => ({
  id: `${storeSlug}_${slug}`,
  storeSlug,
=======
  stockQuantity: number | null = null,
): Product => ({
  id: `${storeId}_${slug}`,
  storeId,
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
  slug,
  name,
  description,
  priceKobo: priceNaira * 100,
<<<<<<< HEAD
  images: [],
  isAvailable,
  isIndexable: false,
  createdAt: stamp,
  updatedAt: stamp,
=======
  imageUrls: [],
  isAvailable: stockQuantity !== 0,
  stockQuantity,
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
});

export const MOCK_PRODUCTS: Product[] = [
  p(
<<<<<<< HEAD
    "ama-hairs",
=======
    "store_demo_1",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "silky-straight-wig",
    "Silky Straight Wig",
    "Soft, natural-looking straight wig with a pre-plucked hairline. Comfortable cap, easy to style and wash.",
    45000,
<<<<<<< HEAD
  ),
  p(
    "ama-hairs",
=======
    6,
  ),
  p(
    "store_demo_1",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "body-wave-bundle",
    "Body Wave Bundle",
    "Full-bodied wavy bundle that holds its curl. Sold per bundle; ask about lengths on WhatsApp.",
    32000,
<<<<<<< HEAD
  ),
  p(
    "ama-hairs",
=======
    12,
  ),
  p(
    "store_demo_1",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "luxury-closure",
    "Luxury Closure",
    "Lightweight lace closure for a seamless part. Pairs with any of our bundles.",
    18500,
<<<<<<< HEAD
    false,
  ),
  p(
    "glow-by-ife",
=======
    0,
  ),
  p(
    "store_demo_2",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "gentle-gel-cleanser",
    "Gentle Gel Cleanser",
    "Daily face wash that cleans without stripping. Suitable for oily and combination skin.",
    8500,
<<<<<<< HEAD
  ),
  p(
    "glow-by-ife",
=======
    30,
  ),
  p(
    "store_demo_2",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "vitamin-c-serum",
    "Vitamin C Serum",
    "Brightening serum for an even tone. Use in the morning under sunscreen.",
    14000,
<<<<<<< HEAD
  ),
  p(
    "glow-by-ife",
=======
    18,
  ),
  p(
    "store_demo_2",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "daily-spf-50",
    "Daily SPF 50",
    "Lightweight sunscreen with no white cast. Wears well under makeup.",
    11500,
<<<<<<< HEAD
  ),
  p(
    "benin-thrift-hub",
=======
    22,
  ),
  p(
    "store_demo_3",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "vintage-denim-jacket",
    "Vintage Denim Jacket",
    "Soft, broken-in denim jacket in good condition. Sizes vary; message us for measurements.",
    9500,
<<<<<<< HEAD
  ),
  p(
    "benin-thrift-hub",
=======
    4,
  ),
  p(
    "store_demo_3",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "high-waist-jeans",
    "High-Waist Jeans",
    "Hand-picked high-waist jeans, washed and quality-checked before listing.",
    7000,
<<<<<<< HEAD
  ),
  p(
    "benin-thrift-hub",
=======
    9,
  ),
  p(
    "store_demo_3",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "everyday-tote-bag",
    "Everyday Tote Bag",
    "Sturdy tote that fits a laptop and lunch. Gently used, clean inside.",
    5500,
<<<<<<< HEAD
=======
    7,
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
  ),
];
