<<<<<<< HEAD
/** Public shapes: exactly what the public views return. Nothing private (owner, phone, email, stock) lives here. */
export interface VendorStore {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  category: string;
  categorySlug: string;
  city?: string;
  citySlug?: string;
  state?: string;
  stateSlug?: string;
  logoUrl?: string;
  coverUrl?: string;
  ogImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  /** Decided by the database (see migration 0500): published, complete profile, vendor allows it, has an eligible product. */
  isIndexable: boolean;
  productCount: number;
  /** Sample data used when no backend is configured. Demo stores are never indexable. */
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
  lastModified: string;
}

export interface ProductImage {
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
=======
export type StoreStatus = "active" | "suspended";

export interface VendorStore {
  id: string;
  ownerId: string;
  name: string;
  /** URL username: sellsharp.ng/{slug}. Unique, validated by validateStoreSlug. */
  slug: string;
  tagline?: string;
  description: string;
  category: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  coverUrl?: string;
  isPublished: boolean;
  status: StoreStatus;
  /** Optional vendor overrides edited in dashboard → Store settings. */
  seoTitle?: string;
  seoDescription?: string;
  /** Sample data. Demo stores are always noindex and never appear in the sitemap. */
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
}

export interface Product {
  id: string;
<<<<<<< HEAD
  storeSlug: string;
=======
  storeId: string;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
  slug: string;
  name: string;
  description: string;
  /** Integer kobo. */
  priceKobo: number;
<<<<<<< HEAD
  category?: string;
  images: ProductImage[];
  isAvailable: boolean;
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
  isIndexable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryFacet {
  slug: string;
  name: string;
  storeCount: number;
  kind: "category" | "state" | "city";
=======
  imageUrls: string[];
  isAvailable: boolean;
  stockQuantity: number | null;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
}
