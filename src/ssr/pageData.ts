/**
 * Decides, for a public URL, what data the page needs and what HTTP status it deserves.
 * Used by BOTH the server-side renderer (so crawlers get real HTML) and the browser (client-side navigation).
 */
import type { PublicApi } from "../data/publicApi";
import { cleanSearchTerm, isSafeSlug } from "../data/publicApi";
import { isReservedSlug } from "../lib/reservedSlugs";
import { productPath } from "../lib/routes";
import type { DirectoryFacet, Product, VendorStore } from "../types/store";

/** A category/location landing page is only indexable with enough real stores, so we never publish empty pages. */
export const MIN_STORES_FOR_LANDING_PAGE = 3;
export const HOME_PRODUCT_LIMIT = 12;

export type PublicRoute =
  | { route: "store"; storeSlug: string }
  | { route: "storeProducts"; storeSlug: string }
  | { route: "storeAbout"; storeSlug: string }
  | { route: "product"; storeSlug: string; productSlug: string }
  | { route: "directory"; facet?: string };

export type PageData =
  | { kind: "store"; store: VendorStore; products: Product[] }
  | { kind: "storeProducts"; store: VendorStore; products: Product[] }
  | { kind: "storeAbout"; store: VendorStore }
  | { kind: "product"; store: VendorStore; product: Product; related: Product[] }
  | {
      kind: "directory";
      scope: DirectoryScope;
      stores: VendorStore[];
      facets: DirectoryFacet[];
      q: string;
      indexable: boolean;
    }
  | { kind: "notFound" };

export type DirectoryScope = { type: "all" } | { type: "facet"; facet: DirectoryFacet };

export type LoadResult = { status: 200 | 404; data: PageData } | { status: 301; redirect: string };

/** Pure URL → route. Returns null for anything that is not a dynamic public page (marketing pages, assets, account pages). */
export function matchPublicRoute(pathname: string): PublicRoute | null {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return null;
  if (seg[0] === "stores") {
    if (seg.length === 1) return { route: "directory" };
    if (seg.length === 2 && isSafeSlug(seg[1])) return { route: "directory", facet: seg[1] };
    return null;
  }
  if (isReservedSlug(seg[0]) || !isSafeSlug(seg[0])) return null;
  const storeSlug = seg[0];
  if (seg.length === 1) return { route: "store", storeSlug };
  if (seg.length === 2 && seg[1] === "products") return { route: "storeProducts", storeSlug };
  if (seg.length === 2 && seg[1] === "about") return { route: "storeAbout", storeSlug };
  if (seg.length === 3 && seg[1] === "products" && isSafeSlug(seg[2]))
    return { route: "product", storeSlug, productSlug: seg[2] };
  return null;
}

const NOT_FOUND: LoadResult = { status: 404, data: { kind: "notFound" } };

export async function loadPageData(match: PublicRoute, search: string, api: PublicApi): Promise<LoadResult> {
  switch (match.route) {
    case "store": {
      const store = await api.getStore(match.storeSlug);
      if (!store) return NOT_FOUND;
      return {
        status: 200,
        data: { kind: "store", store, products: await api.listProducts(store.slug, { limit: HOME_PRODUCT_LIMIT }) },
      };
    }
    case "storeProducts": {
      const store = await api.getStore(match.storeSlug);
      if (!store) return NOT_FOUND;
      return {
        status: 200,
        data: { kind: "storeProducts", store, products: await api.listProducts(store.slug, { limit: 200 }) },
      };
    }
    case "storeAbout": {
      const store = await api.getStore(match.storeSlug);
      return store ? { status: 200, data: { kind: "storeAbout", store } } : NOT_FOUND;
    }
    case "product": {
      // The store and product are looked up TOGETHER: a product is never shown under a store that does not own it.
      const store = await api.getStore(match.storeSlug);
      if (!store) return NOT_FOUND;
      const product = await api.getProduct(store.slug, match.productSlug);
      if (!product) {
        const renamed = await api.getProductRedirect(store.slug, match.productSlug);
        return renamed ? { status: 301, redirect: productPath(store.slug, renamed) } : NOT_FOUND;
      }
      const others = await api.listProducts(store.slug, { limit: 5 });
      return {
        status: 200,
        data: { kind: "product", store, product, related: others.filter((p) => p.id !== product.id).slice(0, 4) },
      };
    }
    case "directory": {
      const q = cleanSearchTerm(new URLSearchParams(search).get("q") ?? "");
      const facets = await api.directoryFacets();
      if (!match.facet) {
        const stores = await api.listStores({ q });
        // Search-result pages are never indexed; the plain directory is indexed once it lists real stores.
        return {
          status: 200,
          data: { kind: "directory", scope: { type: "all" }, stores, facets, q, indexable: !q && stores.length > 0 },
        };
      }
      const facet =
        facets.find((f) => f.slug === match.facet && f.kind === "category") ??
        facets.find((f) => f.slug === match.facet && f.kind === "state") ??
        facets.find((f) => f.slug === match.facet);
      if (!facet) return NOT_FOUND;
      const stores = await api.listStores({
        categorySlug: facet.kind === "category" ? facet.slug : undefined,
        stateSlug: facet.kind === "state" ? facet.slug : undefined,
        citySlug: facet.kind === "city" ? facet.slug : undefined,
        q,
      });
      return {
        status: 200,
        data: {
          kind: "directory",
          scope: { type: "facet", facet },
          stores,
          facets,
          q,
          indexable: !q && facet.storeCount >= MIN_STORES_FOR_LANDING_PAGE,
        },
      };
    }
  }
}
