/** Static (non-vendor) routes. Anything listed here is automatically reserved as a store slug (see reservedSlugs.ts). */
export const INDEXABLE_ROUTES = [
  "/",
  "/features",
  "/pricing",
  "/faq",
  "/contact",
  "/about",
  "/terms",
  "/privacy",
] as const;

/** Real pages we do not want in search results (placeholders / account screens). */
export const NOINDEX_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/onboarding/payment",
  "/app",
] as const;

/** Old or alternate URLs that redirect somewhere else. */
export const REDIRECT_ROUTES = { "/register": "/signup" } as const;

export const ALL_STATIC_ROUTES: readonly string[] = [
  ...INDEXABLE_ROUTES,
  ...NOINDEX_ROUTES,
  ...Object.keys(REDIRECT_ROUTES),
];

export const storePath = (slug: string) => `/${slug}`;
export const productPath = (storeSlug: string, productSlug: string) => `/${storeSlug}/product/${productSlug}`;
