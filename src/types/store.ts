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
}

export interface Product {
  id: string;
  storeId: string;
  slug: string;
  name: string;
  description: string;
  /** Integer kobo. */
  priceKobo: number;
  imageUrls: string[];
  isAvailable: boolean;
  stockQuantity: number | null;
}
