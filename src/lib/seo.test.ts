import { describe, expect, it } from "vitest";
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
  });
});
