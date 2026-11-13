import type { Product, VendorStore } from "../types/store";
import { koboToDecimalString } from "./money";
<<<<<<< HEAD
import { directoryPath, productPath, storeAboutPath, storePath, storeProductsPath } from "./routes";
import { SITE, absoluteUrl } from "./site";

export type JsonLd = Record<string, unknown>;
export type ImageKind = "product" | "cover" | "logo" | "default";
=======
import { productPath, storePath } from "./routes";
import { SITE, absoluteUrl } from "./site";

export type JsonLd = Record<string, unknown>;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c

export interface PageSeo {
  /** Text before the brand suffix, or the whole title when `absoluteTitle` is true. */
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  noindex?: boolean;
<<<<<<< HEAD
  /** noindex pages normally still let crawlers follow links; set for pages that should not be followed at all. */
  nofollow?: boolean;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageKind?: ImageKind;
  /** Social-preview text when it should differ from the search title/description. */
  ogTitle?: string;
  ogDescription?: string;
  type?: "website" | "article" | "product";
  price?: { amountKobo: number; available: boolean };
=======
  image?: string;
  imageAlt?: string;
  type?: "website" | "article" | "product";
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
  jsonLd?: JsonLd[];
}

/**
 * Safe to place inside <script type="application/ld+json">. Vendor-written text ends up in here, so `<` is escaped
 * to stop a name like `</script><script>…` from breaking out of the tag.
 */
export function jsonLdString(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,;:.\-–—\s]+$/, "")}…`;
}

export function fullTitle(seo: Pick<PageSeo, "title" | "absoluteTitle">): string {
  return seo.absoluteTitle ? seo.title : `${seo.title} | ${SITE.name}`;
}

<<<<<<< HEAD
export const robotsContent = (seo: Pick<PageSeo, "noindex" | "nofollow">): string =>
  seo.noindex ? (seo.nofollow ? "noindex, nofollow" : "noindex, follow") : "index, follow, max-image-preview:large";

/* ---------- social images ---------- */

/** A social crawler must be able to fetch the image without logging in: https only, no signed or expiring URLs. */
export function isPublicImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url, SITE.url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname) || u.hostname.endsWith(".local")) return false;
  if (
    /\/storage\/v1\/object\/sign\//.test(u.pathname) ||
    /[?&](token|x-amz-signature|expires|signature)=/i.test(u.search)
  )
    return false;
  return true;
}

export interface ImageCandidate {
  url?: string | null;
  kind: ImageKind;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

/** First usable candidate wins; otherwise the SellSharp default. The fallback never pretends to be a product. */
export function pickSocialImage(
  candidates: ImageCandidate[],
): Required<Pick<PageSeo, "image" | "imageKind">> & Pick<PageSeo, "imageAlt" | "imageWidth" | "imageHeight"> {
  for (const c of candidates) {
    if (isPublicImageUrl(c.url)) {
      return {
        image: absoluteUrl(c.url),
        imageKind: c.kind,
        imageAlt: c.alt ?? undefined,
        imageWidth: c.width ?? undefined,
        imageHeight: c.height ?? undefined,
      };
    }
  }
  return {
    image: absoluteUrl(SITE.ogImage),
    imageKind: "default",
    imageAlt: SITE.ogImageAlt,
    imageWidth: 1200,
    imageHeight: 630,
  };
}

=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
/* ---------- site-level structured data ---------- */

export const organizationJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": absoluteUrl("/#organization"),
  name: SITE.name,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/logo-512.png"),
  areaServed: { "@type": "Country", name: "Nigeria" },
});

export const websiteJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": absoluteUrl("/#website"),
  name: SITE.name,
  url: absoluteUrl("/"),
  inLanguage: "en-NG",
  publisher: { "@id": absoluteUrl("/#organization") },
});

export const softwareJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: SITE.description,
  url: absoluteUrl("/"),
  offers: {
    "@type": "Offer",
    price: koboToDecimalString(SITE.monthlyPriceKobo),
    priceCurrency: "NGN",
    availability: "https://schema.org/InStock",
    url: absoluteUrl("/pricing"),
  },
});

export const faqJsonLd = (items: ReadonlyArray<readonly [string, string]>): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
});

export const breadcrumbJsonLd = (crumbs: ReadonlyArray<{ name: string; path: string }>): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: absoluteUrl(c.path),
  })),
});

<<<<<<< HEAD
/* ---------- generated defaults (vendors can override them in Settings → Store SEO) ---------- */

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
export const storeLocation = (s: Pick<VendorStore, "city" | "state">): string => s.city || s.state || "Nigeria";
const plain = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function generateStoreSeo(store: VendorStore): { title: string; description: string } {
  const where = storeLocation(store);
  const desc = plain(store.description);
  return {
    // e.g. "Ama Hair Studio – Buy Hair & Wigs in Lagos"
    title: truncate(`${store.name} – Buy ${titleCase(store.category ?? "")} in ${where}`, 60),
    // Spec fallback order: the store's own public description, otherwise a safe generated sentence.
    description:
      desc.length >= 70
        ? truncate(desc, 155)
        : truncate(
            `Shop ${(store.category ?? "").toLowerCase()} from ${store.name} in ${where}. Explore available products and place your order online.`,
            155,
          ),
  };
}

export function effectiveStoreSeo(store: VendorStore): { title: string; description: string } {
  const generated = generateStoreSeo(store);
  return {
    title: truncate(store.seoTitle || generated.title, 60),
    description: truncate(store.seoDescription || generated.description, 160),
  };
}

export function generateProductSeo(
  store: Pick<VendorStore, "name">,
  product: Product,
): { title: string; description: string } {
  const excerpt = plain(product.description);
  return {
    title: truncate(`Buy ${product.name} – ${store.name}`, 60),
    description:
      excerpt.length >= 40
        ? truncate(excerpt, 155)
        : truncate(
            `Shop ${product.name} from ${store.name}. View product details and available pricing, then order online.`,
            155,
          ),
  };
}

/* ---------- vendor storefront SEO ---------- */

function storeJsonLd(store: VendorStore, products: Product[]): JsonLd {
  const url = absoluteUrl(storePath(store.slug));
  const image = pickSocialImage([
    { url: store.ogImageUrl, kind: "cover" },
    { url: store.coverUrl, kind: "cover" },
    { url: store.logoUrl, kind: "logo" },
  ]);
  return {
    "@context": "https://schema.org",
    // OnlineStore, not LocalBusiness: we cannot verify a physical shop, so we never publish an address.
=======
/* ---------- per-vendor SEO ---------- */

export const isStoreIndexable = (store: VendorStore): boolean =>
  store.isPublished && store.status === "active" && !store.isDemo;

const storeLocation = (s: VendorStore) => [s.city, s.state].filter(Boolean).join(", ");

export function storeJsonLd(store: VendorStore, products: Product[]): JsonLd {
  const url = absoluteUrl(storePath(store.slug));
  const location = storeLocation(store);
  return {
    "@context": "https://schema.org",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    "@type": "OnlineStore",
    "@id": `${url}#store`,
    name: store.name,
    url,
    description: store.description,
<<<<<<< HEAD
    ...(store.logoUrl && isPublicImageUrl(store.logoUrl) ? { logo: absoluteUrl(store.logoUrl) } : {}),
    ...(image.imageKind !== "default" ? { image: image.image } : {}),
    areaServed: store.city
      ? { "@type": "City", name: store.city, containedInPlace: { "@type": "Country", name: "Nigeria" } }
      : { "@type": "Country", name: "Nigeria" },
=======
    ...(store.logoUrl ? { logo: absoluteUrl(store.logoUrl) } : {}),
    ...(store.coverUrl ? { image: absoluteUrl(store.coverUrl) } : {}),
    areaServed: store.city
      ? { "@type": "City", name: store.city, address: { "@type": "PostalAddress", addressCountry: SITE.country } }
      : { "@type": "Country", name: "Nigeria" },
    ...(location
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: store.city,
            ...(store.state ? { addressRegion: store.state } : {}),
            addressCountry: SITE.country,
          },
        }
      : {}),
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${store.name} products`,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(productPath(store.slug, p.slug)),
        name: p.name,
      })),
    },
  };
}

export function productJsonLd(store: VendorStore, product: Product): JsonLd {
  const url = absoluteUrl(productPath(store.slug, product.slug));
<<<<<<< HEAD
  const images = product.images.filter((i) => isPublicImageUrl(i.url)).map((i) => absoluteUrl(i.url));
=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.description,
    sku: product.id,
    url,
<<<<<<< HEAD
    ...(images.length ? { image: images } : {}),
    brand: { "@type": "Brand", name: store.name },
    // Only real, visible data. No ratings or reviews are ever generated.
=======
    ...(product.imageUrls.length ? { image: product.imageUrls.map((u) => absoluteUrl(u)) } : {}),
    brand: { "@type": "Brand", name: store.name },
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "NGN",
      price: koboToDecimalString(product.priceKobo),
      availability: product.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: store.name, url: absoluteUrl(storePath(store.slug)) },
    },
  };
}

<<<<<<< HEAD
export function buildStoreSeo(store: VendorStore, products: Product[]): PageSeo {
  const seo = effectiveStoreSeo(store);
  const img = pickSocialImage([
    { url: store.ogImageUrl, kind: "cover", alt: `${store.name} social sharing image` },
    { url: store.coverUrl, kind: "cover", alt: `${store.name} banner` },
    { url: store.logoUrl, kind: "logo", alt: `${store.name} logo` },
  ]);
  return {
    title: seo.title,
    absoluteTitle: true,
    description: seo.description,
    path: storePath(store.slug),
    noindex: !store.isIndexable,
    ...img,
    imageAlt: img.imageAlt ?? `${store.name} online store`,
    ogTitle: store.name,
    ogDescription: truncate(plain(store.description).length >= 30 ? store.description : seo.description, 200),
    jsonLd: [
      storeJsonLd(
        store,
        products.filter((p) => p.isIndexable),
      ),
      breadcrumbJsonLd([
        { name: SITE.name, path: "/" },
        { name: "Stores", path: directoryPath() },
        { name: store.name, path: storePath(store.slug) },
      ]),
    ],
  };
}

export function buildStoreProductsSeo(store: VendorStore): PageSeo {
  return {
    title: truncate(`All products from ${store.name} in ${storeLocation(store)}`, 60),
    absoluteTitle: true,
    description: truncate(`Browse every product from ${store.name}. ${store.description}`, 155),
    path: storeProductsPath(store.slug),
    noindex: !store.isIndexable,
    ...pickSocialImage([
      { url: store.ogImageUrl, kind: "cover" },
      { url: store.coverUrl, kind: "cover" },
      { url: store.logoUrl, kind: "logo" },
    ]),
    ogTitle: `${store.name} – all products`,
    jsonLd: [
      breadcrumbJsonLd([
        { name: SITE.name, path: "/" },
        { name: store.name, path: storePath(store.slug) },
        { name: "Products", path: storeProductsPath(store.slug) },
=======
/** Pure functions so the same code can later run inside an edge function that injects tags for WhatsApp/Facebook crawlers. */
export function buildStoreSeo(store: VendorStore, products: Product[]): PageSeo {
  const location = store.city ? ` in ${store.city}` : "";
  const fallbackTitle = `${store.name} — ${store.tagline ?? `${store.category}${location}`}`;
  return {
    title: truncate(store.seoTitle ?? fallbackTitle, 60),
    absoluteTitle: true,
    description: truncate(store.seoDescription ?? store.description, 155),
    path: storePath(store.slug),
    noindex: !isStoreIndexable(store),
    image: store.coverUrl ?? store.logoUrl,
    imageAlt: `${store.name} online store`,
    jsonLd: [
      storeJsonLd(store, products),
      breadcrumbJsonLd([
        { name: SITE.name, path: "/" },
        { name: store.name, path: storePath(store.slug) },
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
      ]),
    ],
  };
}

<<<<<<< HEAD
/** Thin by nature, so it stays out of search results (but links are still followed). */
export function buildStoreAboutSeo(store: VendorStore): PageSeo {
  return {
    title: truncate(`About ${store.name}`, 60),
    description: truncate(store.description, 155),
    path: storeAboutPath(store.slug),
    noindex: true,
    jsonLd: [],
  };
}

export function buildProductSeo(store: VendorStore, product: Product): PageSeo {
  const generated = generateProductSeo(store, product);
  const description = truncate(product.seoDescription || generated.description, 160);
  const img = pickSocialImage([
    { url: product.ogImageUrl, kind: "product", alt: product.name },
    ...product.images.map((i) => ({
      url: i.url,
      kind: "product" as const,
      alt: i.alt || product.name,
      width: i.width,
      height: i.height,
    })),
    { url: store.ogImageUrl, kind: "cover" },
    { url: store.logoUrl, kind: "logo" },
  ]);
  return {
    title: truncate(product.seoTitle || generated.title, 60),
    absoluteTitle: true,
    description,
    path: productPath(store.slug, product.slug),
    noindex: !product.isIndexable,
    type: "product",
    price: { amountKobo: product.priceKobo, available: product.isAvailable },
    ...img,
    imageAlt: img.imageAlt ?? product.name,
    ogTitle: truncate(`${product.name} – ${store.name}`, 70),
    ogDescription: truncate(
      product.seoDescription ||
        (plain(product.description).length >= 40
          ? product.description
          : `View product details and order from ${store.name}.`),
      200,
    ),
=======
export function buildProductSeo(store: VendorStore, product: Product): PageSeo {
  return {
    title: truncate(`${product.name} — ${store.name}`, 60),
    absoluteTitle: true,
    description: truncate(product.description, 155),
    path: productPath(store.slug, product.slug),
    noindex: !isStoreIndexable(store),
    image: product.imageUrls[0] ?? store.coverUrl ?? store.logoUrl,
    imageAlt: product.name,
    type: "product",
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    jsonLd: [
      productJsonLd(store, product),
      breadcrumbJsonLd([
        { name: SITE.name, path: "/" },
        { name: store.name, path: storePath(store.slug) },
        { name: product.name, path: productPath(store.slug, product.slug) },
      ]),
    ],
  };
}
<<<<<<< HEAD

/* ---------- directory SEO ---------- */

export function buildDirectorySeo(opts: {
  path: string;
  heading: string;
  description: string;
  stores: VendorStore[];
  indexable: boolean;
  crumbs: Array<{ name: string; path: string }>;
}): PageSeo {
  return {
    title: truncate(opts.heading, 60),
    description: truncate(opts.description, 160),
    path: opts.path,
    noindex: !opts.indexable,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: opts.heading,
        url: absoluteUrl(opts.path),
        mainEntity: {
          "@type": "ItemList",
          itemListElement: opts.stores.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(storePath(s.slug)),
            name: s.name,
          })),
        },
      },
      breadcrumbJsonLd([{ name: SITE.name, path: "/" }, ...opts.crumbs]),
    ],
  };
}
=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
