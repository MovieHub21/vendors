/**
 * Read-only access to PUBLIC data: the public views created in supabase/migrations/…0500_seo.sql.
 * The same code runs in the browser and in the server-side renderer (edge worker). Writes never happen here.
 */
import { MOCK_PRODUCTS, MOCK_STORES } from "./mockStores";
import { isReservedSlug } from "../lib/reservedSlugs";
import type { DirectoryFacet, Product, VendorStore } from "../types/store";

export interface DirectoryQuery {
  categorySlug?: string;
  stateSlug?: string;
  citySlug?: string;
  q?: string;
  limit?: number;
}

export interface PublicApi {
  getStore(slug: string): Promise<VendorStore | null>;
  listProducts(storeSlug: string, opts?: { limit?: number }): Promise<Product[]>;
  getProduct(storeSlug: string, productSlug: string): Promise<Product | null>;
  /** If a product was renamed, the slug it lives at now. */
  getProductRedirect(storeSlug: string, oldSlug: string): Promise<string | null>;
  listStores(query?: DirectoryQuery): Promise<VendorStore[]>;
  directoryFacets(): Promise<DirectoryFacet[]>;
  sitemapStores(offset: number, limit: number): Promise<Array<{ slug: string; lastModified: string }>>;
  sitemapProducts(
    offset: number,
    limit: number,
  ): Promise<Array<{ storeSlug: string; slug: string; lastModified: string }>>;
  sitemapProductCount(): Promise<number>;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Slugs go straight into a query string, so anything that is not a plain slug is refused before it gets near the API. */
export const isSafeSlug = (s: string): boolean => s.length <= 80 && SLUG.test(s);
export const cleanSearchTerm = (q: string | undefined): string =>
  (q ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

/* ---------------------------------------------------------------- REST (Supabase PostgREST) */

type Row = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

const toStore = (r: Row): VendorStore => ({
  id: String(r.id),
  slug: String(r.slug),
  name: String(r.name),
  tagline: str(r.tagline),
  description: String(r.description ?? ""),
  category: String(r.category ?? ""),
  categorySlug: String(r.category_slug ?? ""),
  city: str(r.city),
  citySlug: str(r.city_slug),
  state: str(r.state),
  stateSlug: str(r.state_slug),
  logoUrl: str(r.logo_url),
  coverUrl: str(r.cover_url),
  contactPhone: str(r.contact_phone),
  storefrontLayout: r.storefront_layout === "classic" || r.storefront_layout === "minimal" || r.storefront_layout === "editorial" ? r.storefront_layout : "showcase",
  heroEyebrow: str(r.hero_eyebrow),
  heroTitle: str(r.hero_title),
  heroDescription: str(r.hero_description),
  heroButtonText: str(r.hero_button_text),
  categoryHeading: str(r.category_heading),
  productsHeading: str(r.products_heading),
  promoOneTitle: str(r.promo_one_title),
  promoOneText: str(r.promo_one_text),
  promoOneImageUrl: str(r.promo_one_image_url),
  promoTwoTitle: str(r.promo_two_title),
  promoTwoText: str(r.promo_two_text),
  promoTwoImageUrl: str(r.promo_two_image_url),
  facebookUrl: str(r.facebook_url),
  instagramUrl: str(r.instagram_url),
  tiktokUrl: str(r.tiktok_url),
  youtubeUrl: str(r.youtube_url),
  xUrl: str(r.x_url),
  threadsUrl: str(r.threads_url),
  snapchatUrl: str(r.snapchat_url),
  pinterestUrl: str(r.pinterest_url),
  linkedinUrl: str(r.linkedin_url),
  otherSocialLabel: str(r.other_social_label),
  otherSocialUrl: str(r.other_social_url),
  ogImageUrl: str(r.og_image_url),
  seoTitle: str(r.seo_title),
  seoDescription: str(r.seo_description),
  isIndexable: r.is_indexable === true,
  productCount: Number(r.product_count ?? 0),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
  lastModified: String(r.last_modified ?? r.updated_at),
});

const toProduct = (r: Row): Product => ({
  id: String(r.id),
  storeSlug: String(r.store_slug),
  slug: String(r.slug),
  name: String(r.name),
  description: String(r.description ?? ""),
  priceKobo: Number(r.price_kobo),
  category: str(r.category),
  images: Array.isArray(r.images)
    ? (r.images as Row[]).map((i) => ({
        url: String(i.url),
        alt: str(i.alt) ?? null,
        width: (i.width as number) ?? null,
        height: (i.height as number) ?? null,
      }))
    : [],
  isAvailable: r.is_available === true,
  seoTitle: str(r.seo_title),
  seoDescription: str(r.seo_description),
  ogImageUrl: str(r.og_image_url),
  isIndexable: r.is_indexable === true,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

export function createRestApi(config: { url: string; key: string; fetch?: typeof fetch }): PublicApi {
  const base = `${config.url.replace(/\/+$/, "")}/rest/v1`;
  const doFetch = config.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function request(view: string, params: Record<string, string>, extra: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await doFetch(`${base}/${view}${qs ? `?${qs}` : ""}`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, Accept: "application/json", ...extra },
    });
    if (!res.ok) throw new Error(`Public data request failed (${view}: ${res.status})`);
    return res;
  }
  const rows = async (view: string, params: Record<string, string>): Promise<Row[]> =>
    (await request(view, params)).json() as Promise<Row[]>;

  return {
    async getStore(slug) {
      if (!isSafeSlug(slug)) return null;
      const r = await rows("public_stores", { select: "*", slug: `eq.${slug}`, limit: "1" });
      if (r[0]) return toStore(r[0]);
      return MOCK_STORES.find((s) => s.slug === slug) ?? null;
    },
    async listProducts(storeSlug, opts = {}) {
      if (!isSafeSlug(storeSlug)) return [];
      const r = await rows("public_products", {
        select: "*",
        store_slug: `eq.${storeSlug}`,
        order: "created_at.desc",
        limit: String(opts.limit ?? 60),
      });
      if (r.length > 0) return r.map(toProduct);
      return MOCK_PRODUCTS.filter((p) => p.storeSlug === storeSlug).slice(0, opts.limit ?? 60);
    },
    async getProduct(storeSlug, productSlug) {
      if (!isSafeSlug(storeSlug) || !isSafeSlug(productSlug)) return null;
      const r = await rows("public_products", {
        select: "*",
        store_slug: `eq.${storeSlug}`,
        slug: `eq.${productSlug}`,
        limit: "1",
      });
      if (r[0]) return toProduct(r[0]);
      return MOCK_PRODUCTS.find((p) => p.storeSlug === storeSlug && p.slug === productSlug) ?? null;
    },
    async getProductRedirect(storeSlug, oldSlug) {
      if (!isSafeSlug(storeSlug) || !isSafeSlug(oldSlug)) return null;
      const r = await rows("public_product_redirects", {
        select: "new_slug",
        store_slug: `eq.${storeSlug}`,
        old_slug: `eq.${oldSlug}`,
        limit: "1",
      });
      return str(r[0]?.new_slug) ?? null;
    },
    async listStores(q = {}) {
      const params: Record<string, string> = {
        select: "*",
        order: "product_count.desc,name.asc",
        limit: String(q.limit ?? 60),
        is_indexable: "eq.true",
      };
      if (q.categorySlug && isSafeSlug(q.categorySlug)) params.category_slug = `eq.${q.categorySlug}`;
      if (q.stateSlug && isSafeSlug(q.stateSlug)) params.state_slug = `eq.${q.stateSlug}`;
      if (q.citySlug && isSafeSlug(q.citySlug)) params.city_slug = `eq.${q.citySlug}`;
      const term = cleanSearchTerm(q.q);
      if (term) params.name = `ilike.*${term.replace(/ /g, "*")}*`;

      let live = (await rows("public_stores", params)).map(toStore);
      if (live.length === 0 && !term) {
        // If no indexable stores match, check if any published active stores exist in the database
        const { is_indexable: _, ...allParams } = params;
        try {
          live = (await rows("public_stores", allParams)).map(toStore);
        } catch {
          // ignore
        }
      }
      if (live.length > 0) return live;

      // If database has no stores yet, show sample demo stores so the directory is never empty
      return MOCK_STORES
        .filter((s) => !q.categorySlug || s.categorySlug === q.categorySlug)
        .filter((s) => !q.stateSlug || s.stateSlug === q.stateSlug)
        .filter((s) => !q.citySlug || s.citySlug === q.citySlug)
        .filter((s) => !term || s.name.toLowerCase().includes(term))
        .slice(0, q.limit ?? 60);
    },
    async directoryFacets() {
      const [cats, locs] = await Promise.all([
        rows("public_directory_categories", { select: "*" }),
        rows("public_directory_locations", { select: "*" }),
      ]);
      const facets = [
        ...cats.map((c): DirectoryFacet => ({
          kind: "category",
          slug: String(c.slug),
          name: String(c.name),
          storeCount: Number(c.store_count),
        })),
        ...locs.map((l): DirectoryFacet => ({
          kind: l.kind === "city" ? "city" : "state",
          slug: String(l.slug),
          name: String(l.name),
          storeCount: Number(l.store_count),
        })),
      ];
      if (facets.length > 0) return facets;

      const map = new Map<string, DirectoryFacet>();
      const bump = (kind: DirectoryFacet["kind"], slug: string | undefined, name: string | undefined) => {
        if (!slug || !name) return;
        const key = `${kind}:${slug}`;
        map.set(key, { kind, slug, name, storeCount: (map.get(key)?.storeCount ?? 0) + 1 });
      };
      for (const s of MOCK_STORES) {
        bump("category", s.categorySlug, s.category);
        bump("state", s.stateSlug, s.state);
        bump("city", s.citySlug, s.city);
      }
      return [...map.values()];
    },
    async sitemapStores(offset, limit) {
      const r = await rows("sitemap_stores", {
        select: "slug,last_modified",
        order: "slug.asc",
        limit: String(limit),
        offset: String(offset),
      });
      return r.map((x) => ({ slug: String(x.slug), lastModified: String(x.last_modified) }));
    },
    async sitemapProducts(offset, limit) {
      const r = await rows("sitemap_products", {
        select: "store_slug,slug,last_modified",
        order: "store_slug.asc,slug.asc",
        limit: String(limit),
        offset: String(offset),
      });
      return r.map((x) => ({
        storeSlug: String(x.store_slug),
        slug: String(x.slug),
        lastModified: String(x.last_modified),
      }));
    },
    async sitemapProductCount() {
      const res = await request("sitemap_products", { select: "slug" }, { Prefer: "count=exact", Range: "0-0" });
      const total = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
      return total ? Number(total[1]) : 0;
    },
  };
}

/* ---------------------------------------------------------------- in-memory (demo data and tests) */

export function createMemoryApi(data: {
  stores: VendorStore[];
  products: Product[];
  redirects?: Array<{ storeSlug: string; oldSlug: string; newSlug: string }>;
}): PublicApi {
  const visible = (slug: string) => data.stores.find((s) => s.slug === slug) ?? null;
  const facetsOf = (): DirectoryFacet[] => {
    const map = new Map<string, DirectoryFacet>();
    const bump = (kind: DirectoryFacet["kind"], slug: string | undefined, name: string | undefined) => {
      if (!slug || !name) return;
      const key = `${kind}:${slug}`;
      map.set(key, { kind, slug, name, storeCount: (map.get(key)?.storeCount ?? 0) + 1 });
    };
    for (const s of data.stores.filter((x) => x.isIndexable || x.isDemo)) {
      bump("category", s.categorySlug, s.category);
      bump("state", s.stateSlug, s.state);
      bump("city", s.citySlug, s.city);
    }
    return [...map.values()];
  };
  return {
    getStore: async (slug) => (isReservedSlug(slug) ? null : visible(slug)),
    listProducts: async (storeSlug, opts = {}) =>
      data.products.filter((p) => p.storeSlug === storeSlug).slice(0, opts.limit ?? 60),
    getProduct: async (storeSlug, productSlug) =>
      data.products.find((p) => p.storeSlug === storeSlug && p.slug === productSlug) ?? null,
    getProductRedirect: async (storeSlug, oldSlug) =>
      data.redirects?.find((r) => r.storeSlug === storeSlug && r.oldSlug === oldSlug)?.newSlug ?? null,
    listStores: async (q = {}) => {
      const term = cleanSearchTerm(q.q);
      return data.stores
        .filter((s) => s.isIndexable || s.isDemo)
        .filter((s) => !q.categorySlug || s.categorySlug === q.categorySlug)
        .filter((s) => !q.stateSlug || s.stateSlug === q.stateSlug)
        .filter((s) => !q.citySlug || s.citySlug === q.citySlug)
        .filter((s) => !term || s.name.toLowerCase().includes(term))
        .slice(0, q.limit ?? 60);
    },
    directoryFacets: async () => facetsOf(),
    sitemapStores: async (offset, limit) =>
      data.stores
        .filter((s) => s.isIndexable)
        .slice(offset, offset + limit)
        .map((s) => ({ slug: s.slug, lastModified: s.lastModified })),
    sitemapProducts: async (offset, limit) =>
      data.products
        .filter((p) => p.isIndexable)
        .slice(offset, offset + limit)
        .map((p) => ({ storeSlug: p.storeSlug, slug: p.slug, lastModified: p.updatedAt })),
    sitemapProductCount: async () => data.products.filter((p) => p.isIndexable).length,
  };
}

export const createDemoApi = (): PublicApi => createMemoryApi({ stores: MOCK_STORES, products: MOCK_PRODUCTS });
