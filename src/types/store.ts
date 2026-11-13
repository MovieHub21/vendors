/** Public shapes from the read-only storefront views. Contact phone is public by vendor choice for WhatsApp enquiries. */
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
  contactPhone?: string;
  storefrontLayout?: "editorial" | "classic" | "minimal" | "showcase";
  heroEyebrow?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroButtonText?: string;
  categoryHeading?: string;
  productsHeading?: string;
  promoOneTitle?: string;
  promoOneText?: string;
  promoOneImageUrl?: string;
  promoTwoTitle?: string;
  promoTwoText?: string;
  promoTwoImageUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  xUrl?: string;
  threadsUrl?: string;
  snapchatUrl?: string;
  pinterestUrl?: string;
  linkedinUrl?: string;
  otherSocialLabel?: string;
  otherSocialUrl?: string;
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
}

export interface Product {
  id: string;
  storeSlug: string;
  slug: string;
  name: string;
  description: string;
  /** Integer kobo. */
  priceKobo: number;
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
}
