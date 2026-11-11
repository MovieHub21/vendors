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
  slug: string,
  name: string,
  description: string,
  priceNaira: number,
  stockQuantity: number | null = null,
): Product => ({
  id: `${storeId}_${slug}`,
  storeId,
  slug,
  name,
  description,
  priceKobo: priceNaira * 100,
  imageUrls: [],
  isAvailable: stockQuantity !== 0,
  stockQuantity,
});

export const MOCK_PRODUCTS: Product[] = [
  p(
    "store_demo_1",
    "silky-straight-wig",
    "Silky Straight Wig",
    "Soft, natural-looking straight wig with a pre-plucked hairline. Comfortable cap, easy to style and wash.",
    45000,
    6,
  ),
  p(
    "store_demo_1",
    "body-wave-bundle",
    "Body Wave Bundle",
    "Full-bodied wavy bundle that holds its curl. Sold per bundle; ask about lengths on WhatsApp.",
    32000,
    12,
  ),
  p(
    "store_demo_1",
    "luxury-closure",
    "Luxury Closure",
    "Lightweight lace closure for a seamless part. Pairs with any of our bundles.",
    18500,
    0,
  ),
  p(
    "store_demo_2",
    "gentle-gel-cleanser",
    "Gentle Gel Cleanser",
    "Daily face wash that cleans without stripping. Suitable for oily and combination skin.",
    8500,
    30,
  ),
  p(
    "store_demo_2",
    "vitamin-c-serum",
    "Vitamin C Serum",
    "Brightening serum for an even tone. Use in the morning under sunscreen.",
    14000,
    18,
  ),
  p(
    "store_demo_2",
    "daily-spf-50",
    "Daily SPF 50",
    "Lightweight sunscreen with no white cast. Wears well under makeup.",
    11500,
    22,
  ),
  p(
    "store_demo_3",
    "vintage-denim-jacket",
    "Vintage Denim Jacket",
    "Soft, broken-in denim jacket in good condition. Sizes vary; message us for measurements.",
    9500,
    4,
  ),
  p(
    "store_demo_3",
    "high-waist-jeans",
    "High-Waist Jeans",
    "Hand-picked high-waist jeans, washed and quality-checked before listing.",
    7000,
    9,
  ),
  p(
    "store_demo_3",
    "everyday-tote-bag",
    "Everyday Tote Bag",
    "Sturdy tote that fits a laptop and lunch. Gently used, clean inside.",
    5500,
    7,
  ),
];
