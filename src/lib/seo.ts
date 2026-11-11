import type { Product, VendorStore } from "../types/store";
import { koboToDecimalString } from "./money";
import { productPath, storePath } from "./routes";
import { SITE, absoluteUrl } from "./site";

export type JsonLd = Record<string, unknown>;

export interface PageSeo {
  /** Text before the brand suffix, or the whole title when `absoluteTitle` is true. */
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  noindex?: boolean;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article" | "product";
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

/* ---------- per-vendor SEO ---------- */

export const isStoreIndexable = (store: VendorStore): boolean =>
  store.isPublished && store.status === "active" && !store.isDemo;

const storeLocation = (s: VendorStore) => [s.city, s.state].filter(Boolean).join(", ");

export function storeJsonLd(store: VendorStore, products: Product[]): JsonLd {
  const url = absoluteUrl(storePath(store.slug));
  const location = storeLocation(store);
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${url}#store`,
    name: store.name,
    url,
    description: store.description,
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
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.description,
    sku: product.id,
    url,
    ...(product.imageUrls.length ? { image: product.imageUrls.map((u) => absoluteUrl(u)) } : {}),
    brand: { "@type": "Brand", name: store.name },
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
      ]),
    ],
  };
}

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
