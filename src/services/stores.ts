import { MOCK_PRODUCTS, MOCK_STORES } from "../data/mockStores";
import { isReservedSlug } from "../lib/reservedSlugs";
import type { Product, VendorStore } from "../types/store";

/**
 * Data access for storefronts. Synchronous and mock-backed today. In Phase 6 these become async calls
 * (Supabase / API) and the Storefront pages load through the router or an edge function so crawlers get real HTML.
 */
export function getStoreBySlug(slug: string): VendorStore | null {
  const key = slug.toLowerCase();
  if (isReservedSlug(key)) return null;
  const store = MOCK_STORES.find((s) => s.slug === key);
  return store && store.isPublished && store.status === "active" ? store : null;
}

export function getProductsForStore(storeId: string): Product[] {
  return MOCK_PRODUCTS.filter((x) => x.storeId === storeId);
}

export function getProduct(storeSlug: string, productSlug: string): { store: VendorStore; product: Product } | null {
  const store = getStoreBySlug(storeSlug);
  const product = store ? getProductsForStore(store.id).find((x) => x.slug === productSlug.toLowerCase()) : undefined;
  return store && product ? { store, product } : null;
}
