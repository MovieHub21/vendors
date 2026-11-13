import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import type { Product, VendorStore } from "../types/store";
import {
  buildProductSeo,
  buildStoreAboutSeo,
  buildStoreProductsSeo,
  buildStoreSeo,
  effectiveStoreSeo,
  generateProductSeo,
  generateStoreSeo,
  isPublicImageUrl,
  jsonLdString,
  pickSocialImage,
  robotsContent,
  truncate,
} from "./seo";

const store: VendorStore = {
  id: "s1",
  slug: "ama-hairs",
  name: "Ama Hair Collection",
  description: "Quality human hair, wigs and extensions shipped across Nigeria from our Abuja studio.",
  category: "Hair & wigs",
  categorySlug: "hair-wigs",
  city: "Abuja",
  citySlug: "abuja",
  state: "FCT (Abuja)",
  stateSlug: "fct-abuja",
  isIndexable: true,
  productCount: 2,
  createdAt: "2026-11-01",
  updatedAt: "2026-11-02",
  lastModified: "2026-11-02",
};
const product: Product = {
  id: "p1",
  storeSlug: "ama-hairs",
  slug: "body-wave-wig",
  name: "Body Wave Human Hair Wig",
  priceKobo: 4_500_000,
  isAvailable: true,
  isIndexable: true,
  description: "Soft, full body wave wig made from human hair. Pre-plucked hairline and comfortable cap.",
  images: [{ url: "https://cdn.example.com/wig.jpg", alt: "Body wave wig front view", width: 1200, height: 800 }],
  createdAt: "2026-11-01",
  updatedAt: "2026-11-02",
};

describe("jsonLdString / truncate", () => {
  it("cannot be broken out of a script tag by vendor text", () => {
    const out = jsonLdString({ name: '</script><script>alert("x")</script>' });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe('</script><script>alert("x")</script>');
  });
  it("cuts long text on a word boundary", () => {
    const out = truncate("one two three four five six seven eight nine ten", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("social images", () => {
  it.each([
    ["https://cdn.example.com/a.jpg", true],
    ["/og-default.png", true],
    ["http://cdn.example.com/a.jpg", false],
    ["https://localhost/a.jpg", false],
    ["https://abc.supabase.co/storage/v1/object/sign/private/a.jpg?token=xyz", false],
    ["https://cdn.example.com/a.jpg?X-Amz-Signature=abc", false],
    ["data:image/png;base64,AAAA", false],
    ["", false],
    [null, false],
  ])("isPublicImageUrl(%s) = %s", (url, expected) => expect(isPublicImageUrl(url)).toBe(expected));

  it("uses the first usable candidate, in the order given", () => {
    const img = pickSocialImage([
      { url: "http://bad.example.com/x.jpg", kind: "product" },
      { url: "https://cdn.example.com/p.jpg", kind: "product", width: 1200, height: 630 },
      { url: "https://cdn.example.com/logo.png", kind: "logo" },
    ]);
    expect(img).toMatchObject({
      image: "https://cdn.example.com/p.jpg",
      imageKind: "product",
      imageWidth: 1200,
      imageHeight: 630,
    });
  });
  it("falls back to the SellSharp default, never to another vendor's image", () => {
    const img = pickSocialImage([
      { url: undefined, kind: "cover" },
      { url: "http://insecure.example.com/x.jpg", kind: "logo" },
    ]);
    expect(img.imageKind).toBe("default");
    expect(img.image).toMatch(/^https:\/\/.+\/og-default\.png$/);
  });
});

describe("store SEO", () => {
  it("generates a keyword-relevant title and uses the store's own description", () => {
    const g = generateStoreSeo(store);
    expect(g.title).toBe("Ama Hair Collection – Buy Hair & Wigs in Abuja");
    expect(g.description).toContain("Quality human hair");
    expect(g.title.length).toBeLessThanOrEqual(60);
    expect(g.description.length).toBeLessThanOrEqual(155);
  });
  it("falls back to a safe generated sentence when the description is too short", () => {
    expect(generateStoreSeo({ ...store, description: "Hair." }).description).toBe(
      "Shop hair & wigs from Ama Hair Collection in Abuja. Explore available products and place your order online.",
    );
  });
  it("vendor overrides win over generated text", () => {
    expect(effectiveStoreSeo({ ...store, seoTitle: "Best wigs in Abuja", seoDescription: "Custom text." })).toEqual({
      title: "Best wigs in Abuja",
      description: "Custom text.",
    });
  });
  it("is indexable only when the database says so", () => {
    expect(robotsContent(buildStoreSeo(store, []))).toBe("index, follow, max-image-preview:large");
    expect(robotsContent(buildStoreSeo({ ...store, isIndexable: false }, []))).toBe("noindex, follow");
  });
  it("builds a canonical path and per-store social text (store name as the preview title)", () => {
    const seo = buildStoreSeo(store, [product]);
    expect(seo.path).toBe("/ama-hairs");
    expect(seo.ogTitle).toBe("Ama Hair Collection");
    expect(seo.ogDescription).toContain("Quality human hair");
  });
  it("social image order: social image → banner → logo → default", () => {
    expect(
      buildStoreSeo(
        {
          ...store,
          ogImageUrl: "https://c.example.com/og.jpg",
          coverUrl: "https://c.example.com/cover.jpg",
          logoUrl: "https://c.example.com/logo.jpg",
        },
        [],
      ).image,
    ).toBe("https://c.example.com/og.jpg");
    expect(
      buildStoreSeo(
        { ...store, coverUrl: "https://c.example.com/cover.jpg", logoUrl: "https://c.example.com/logo.jpg" },
        [],
      ).image,
    ).toBe("https://c.example.com/cover.jpg");
    const logoOnly = buildStoreSeo({ ...store, logoUrl: "https://c.example.com/logo.jpg" }, []);
    expect(logoOnly.image).toBe("https://c.example.com/logo.jpg");
    expect(logoOnly.imageKind).toBe("logo");
    expect(buildStoreSeo(store, []).imageKind).toBe("default");
  });
  it("structured data is an OnlineStore with no invented address, rating, review or hours", () => {
    const [ld] = buildStoreSeo(store, [product]).jsonLd!;
    const text = JSON.stringify(ld);
    expect(ld["@type"]).toBe("OnlineStore");
    for (const invented of ["address", "aggregateRating", "review", "openingHours", "telephone", "email", "geo"])
      expect(text, invented).not.toContain(`"${invented}"`);
    expect(text).toContain("/ama-hairs/products/body-wave-wig");
  });
  it("only lists indexable products in structured data", () => {
    const [ld] = buildStoreSeo(store, [product, { ...product, id: "p2", slug: "hidden", isIndexable: false }]).jsonLd!;
    expect(JSON.stringify(ld)).not.toContain("/hidden");
  });
  it("the /products list is indexable with the store; /about is not (thin)", () => {
    expect(buildStoreProductsSeo(store).noindex).toBe(false);
    expect(buildStoreProductsSeo(store).path).toBe("/ama-hairs/products");
    expect(buildStoreAboutSeo(store).noindex).toBe(true);
  });
});

describe("product SEO", () => {
  it("generates 'Buy … – Store' titles and descriptions from the product, per spec", () => {
    expect(generateProductSeo(store, product).title).toBe("Buy Body Wave Human Hair Wig – Ama Hair Collection");
  });
  it("falls back to a safe sentence for thin descriptions, without inventing claims", () => {
    expect(generateProductSeo(store, { ...product, description: "Nice." }).description).toBe(
      "Shop Body Wave Human Hair Wig from Ama Hair Collection. View product details and available pricing, then order online.",
    );
  });
  it("uses the /products/ URL under the owning store", () => {
    expect(buildProductSeo(store, product).path).toBe("/ama-hairs/products/body-wave-wig");
  });
  it("preview text names the product AND its vendor, and uses the main product image", () => {
    const seo = buildProductSeo(store, product);
    expect(seo.ogTitle).toBe("Body Wave Human Hair Wig – Ama Hair Collection");
    expect(seo).toMatchObject({
      type: "product",
      image: "https://cdn.example.com/wig.jpg",
      imageKind: "product",
      imageWidth: 1200,
      imageHeight: 800,
      imageAlt: "Body wave wig front view",
    });
    expect(seo.price).toEqual({ amountKobo: 4_500_000, available: true });
  });
  it("a product-specific social image overrides the gallery", () => {
    expect(buildProductSeo(store, { ...product, ogImageUrl: "https://cdn.example.com/og-wig.jpg" }).image).toBe(
      "https://cdn.example.com/og-wig.jpg",
    );
  });
  it("vendor SEO fields win over generated text", () => {
    const seo = buildProductSeo(store, {
      ...product,
      seoTitle: "Custom wig title",
      seoDescription: "Custom wig description.",
    });
    expect(seo.title).toBe("Custom wig title");
    expect(seo.description).toBe("Custom wig description.");
  });
  it("noindex follows the database's eligibility verdict", () => {
    expect(buildProductSeo(store, { ...product, isIndexable: false }).noindex).toBe(true);
  });
  it("emits Product data with NGN price from integer kobo and honest availability", () => {
    const wig = buildProductSeo(store, product).jsonLd![0] as { offers: Record<string, unknown>; image: string[] };
    expect(wig.offers).toMatchObject({
      price: "45000.00",
      priceCurrency: "NGN",
      availability: "https://schema.org/InStock",
    });
    expect(wig.image).toEqual(["https://cdn.example.com/wig.jpg"]);
    const sold = buildProductSeo(store, { ...product, isAvailable: false }).jsonLd![0] as {
      offers: Record<string, unknown>;
    };
    expect(sold.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(JSON.stringify(wig)).not.toMatch(/aggregateRating|"review"/);
=======
import { MOCK_PRODUCTS, MOCK_STORES } from "../data/mockStores";
import type { VendorStore } from "../types/store";
import { buildProductSeo, buildStoreSeo, jsonLdString, truncate } from "./seo";

const demo = MOCK_STORES[0];
const live: VendorStore = { ...demo, isDemo: false };
const products = MOCK_PRODUCTS.filter((p) => p.storeId === demo.id);

describe("jsonLdString", () => {
  it("cannot be broken out of a script tag by vendor text", () => {
    const out = jsonLdString({ name: '</script><script>alert("x")</script>' });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe('</script><script>alert("x")</script>');
  });
});

describe("truncate", () => {
  it("leaves short text alone and cuts long text on a word boundary", () => {
    expect(truncate("short text", 50)).toBe("short text");
    const out = truncate("one two three four five six seven eight nine ten", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
});

describe("vendor store SEO", () => {
  it("keeps sample stores out of search results", () => {
    expect(buildStoreSeo(demo, products).noindex).toBe(true);
    expect(buildProductSeo(demo, products[0]).noindex).toBe(true);
  });

  it("indexes a real, published, active store", () => {
    expect(buildStoreSeo(live, products).noindex).toBe(false);
  });

  it.each([
    ["unpublished", { isPublished: false }],
    ["suspended", { status: "suspended" as const }],
  ])("noindexes a %s store", (_label, patch) => {
    expect(buildStoreSeo({ ...live, ...patch }, products).noindex).toBe(true);
  });

  it("builds a canonical store path, a ≤60 char title and ≤155 char description", () => {
    const seo = buildStoreSeo(live, products);
    expect(seo.path).toBe("/ama-hairs");
    expect(seo.title.length).toBeLessThanOrEqual(60);
    expect(seo.description.length).toBeLessThanOrEqual(155);
    expect(seo.title).toContain("Ama Hair Studio");
  });

  it("lets the vendor override title and description", () => {
    const seo = buildStoreSeo({ ...live, seoTitle: "Best wigs in Lagos", seoDescription: "Custom text." }, products);
    expect(seo.title).toBe("Best wigs in Lagos");
    expect(seo.description).toBe("Custom text.");
  });

  it("emits OnlineStore structured data with Nigerian locality and product links", () => {
    const [store] = buildStoreSeo(live, products).jsonLd!;
    expect(store["@type"]).toBe("OnlineStore");
    expect(store.url).toMatch(/\/ama-hairs$/);
    expect(JSON.stringify(store)).toContain('"addressCountry":"NG"');
    expect(JSON.stringify(store)).toContain("/ama-hairs/product/silky-straight-wig");
  });

  it("emits Product structured data with NGN price from integer kobo", () => {
    const sold = products.find((p) => !p.isAvailable)!;
    const [wig] = buildProductSeo(live, products[0]).jsonLd!;
    const [closure] = buildProductSeo(live, sold).jsonLd!;
    const offer = (wig as { offers: Record<string, string> }).offers;
    expect(offer.price).toBe("45000.00");
    expect(offer.priceCurrency).toBe("NGN");
    expect(offer.availability).toBe("https://schema.org/InStock");
    expect((closure as { offers: Record<string, string> }).offers.availability).toBe("https://schema.org/OutOfStock");
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
  });
});
