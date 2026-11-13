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

<<<<<<< HEAD
/** Real pages we do not want in search results (account screens). Never listed in sitemaps. */
=======
/** Real pages we do not want in search results (placeholders / account screens). */
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
export const NOINDEX_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/onboarding/payment",
<<<<<<< HEAD
  "/dashboard",
  "/dashboard/seo",
  "/dashboard/sale",
  "/dashboard/orders",
  "/dashboard/customers",
  "/dashboard/products",
  "/dashboard/receipt",
] as const;

/** Old or alternate URLs that redirect somewhere else. */
export const REDIRECT_ROUTES = { "/register": "/signup", "/app": "/dashboard" } as const;

/** Pages the browser app renders on its own (they need a login, so there is nothing for a crawler to read). */
export const CLIENT_ONLY_PREFIXES = ["/onboarding", "/dashboard", "/reset-password"] as const;
=======
  "/app",
] as const;

/** Old or alternate URLs that redirect somewhere else. */
export const REDIRECT_ROUTES = { "/register": "/signup" } as const;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c

export const ALL_STATIC_ROUTES: readonly string[] = [
  ...INDEXABLE_ROUTES,
  ...NOINDEX_ROUTES,
  ...Object.keys(REDIRECT_ROUTES),
<<<<<<< HEAD
  "/stores",
];

export const storePath = (slug: string) => `/${slug}`;
export const storeProductsPath = (slug: string) => `/${slug}/products`;
export const storeAboutPath = (slug: string) => `/${slug}/about`;
export const productPath = (storeSlug: string, productSlug: string) => `/${storeSlug}/products/${productSlug}`;
export const directoryPath = (facetSlug?: string) => (facetSlug ? `/stores/${facetSlug}` : "/stores");
=======
];

export const storePath = (slug: string) => `/${slug}`;
export const productPath = (storeSlug: string, productSlug: string) => `/${storeSlug}/product/${productSlug}`;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
