
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

  slug: string,
  name: string,
  description: string,
  priceNaira: number,

  isAvailable = true,
): Product => ({
  id: `${storeSlug}_${slug}`,
  storeSlug,

  slug,
  name,
  description,
  priceKobo: priceNaira * 100,

  images: [],
  isAvailable,
  isIndexable: false,
  createdAt: stamp,
  updatedAt: stamp,

});

export const MOCK_PRODUCTS: Product[] = [
  p(

    "ama-hairs",

    "silky-straight-wig",
    "Silky Straight Wig",
    "Soft, natural-looking straight wig with a pre-plucked hairline. Comfortable cap, easy to style and wash.",
    45000,

  ),
  p(
    "ama-hairs",

    "body-wave-bundle",
    "Body Wave Bundle",
    "Full-bodied wavy bundle that holds its curl. Sold per bundle; ask about lengths on WhatsApp.",
    32000,

  ),
  p(
    "ama-hairs",

    "luxury-closure",
    "Luxury Closure",
    "Lightweight lace closure for a seamless part. Pairs with any of our bundles.",
    18500,

    false,
  ),
  p(
    "glow-by-ife",

    "gentle-gel-cleanser",
    "Gentle Gel Cleanser",
    "Daily face wash that cleans without stripping. Suitable for oily and combination skin.",
    8500,
  ),
  p(
    "glow-by-ife",
    "vitamin-c-serum",
    "Vitamin C Serum",
    "Brightening serum for an even tone. Use in the morning under sunscreen.",
    14000,
  ),
  p(
    "glow-by-ife",
    "daily-spf-50",
    "Daily SPF 50",
    "Lightweight sunscreen with no white cast. Wears well under makeup.",
    11500,
  ),
  p(
    "benin-thrift-hub",
    "vintage-denim-jacket",
    "Vintage Denim Jacket",
    "Soft, broken-in denim jacket in good condition. Sizes vary; message us for measurements.",
    9500,
  ),
  p(
    "benin-thrift-hub",
    "high-waist-jeans",
    "High-Waist Jeans",
    "Hand-picked high-waist jeans, washed and quality-checked before listing.",
    7000,
  ),
  p(
    "benin-thrift-hub",
    "everyday-tote-bag",
    "Everyday Tote Bag",
    "Sturdy tote that fits a laptop and lunch. Gently used, clean inside.",
    5500,
  ),
];
