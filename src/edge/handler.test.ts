// @vitest-environment node
/**
 * Tests the REAL server-rendered HTML a crawler receives (not the browser's rendered page):
 * status codes, metadata in the first response, structured data, product↔vendor mapping, sitemaps, redirects.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryApi } from "../data/publicApi";
import { prerenderRoutes, render } from "../entry-server";
import type { Product, VendorStore } from "../types/store";
import { __resetTemplateCache, handlePublicRequest, type EdgeDeps } from "./handler";

const TEMPLATE = `<!doctype html><html lang="en-NG"><head><meta charset="UTF-8" />
    <!--app-head-->
  </head><body><div id="root"><!--app-html--></div><script type="module" src="/assets/app.js"></script></body></html>`;

const mk = (over: Partial<VendorStore> & Pick<VendorStore, "slug" | "name">): VendorStore => ({
  id: over.slug,
  description: "Quality goods for every need, shipped across Nigeria with care and clear communication.",
  category: "Hair & wigs",
  categorySlug: "hair-wigs",
  city: "Abuja",
  citySlug: "abuja",
  state: "FCT (Abuja)",
  stateSlug: "fct-abuja",
  isIndexable: true,
  productCount: 2,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-02T00:00:00Z",
  lastModified: "2026-11-03T00:00:00Z",
  ...over,
});
const pr = (storeSlug: string, slug: string, name: string, over: Partial<Product> = {}): Product => ({
  id: `${storeSlug}/${slug}`,
  storeSlug,
  slug,
  name,
  description: `${name}: a genuinely useful description for shoppers.`,
  priceKobo: 4_500_000,
  isAvailable: true,
  isIndexable: true,
  images: [{ url: `https://cdn.example.com/${storeSlug}/${slug}.jpg`, alt: `${name} photo`, width: 1200, height: 800 }],
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-04T00:00:00Z",
  ...over,
});

const stores = [
  mk({
    slug: "ama-hairs",
    name: "Ama Hair Studio",
    logoUrl: "https://cdn.example.com/ama/logo.png",
    coverUrl: "https://cdn.example.com/ama/cover.jpg",
  }),
  mk({
    slug: "glow-by-ife",
    name: "Glow by Ife",
    category: "Skincare & beauty",
    categorySlug: "skincare-beauty",
    city: "Ikeja",
    citySlug: "ikeja",
    state: "Lagos",
    stateSlug: "lagos",
  }),
  mk({ slug: "empty-shop", name: "Empty Shop", isIndexable: false, productCount: 0 }),
  mk({
    slug: "evil-shop",
    name: '</title><script>alert("xss")</script> & Co',
    description: "Great <img src=x onerror=alert(1)> goods $& $1 for you, shipped across Nigeria.",
  }),
];
const products = [
  pr("ama-hairs", "body-wave-wig", "Body Wave Wig"),
  pr("ama-hairs", "straight-bundle", "Straight Bundle", { isAvailable: false }),
  pr("glow-by-ife", "body-wave-wig", "Glow Serum", { priceKobo: 850_000 }), // same slug as Ama's wig, different vendor
  pr("evil-shop", "x-item", "<b>Bad</b> item"),
];

let ASSET_PATHS: string[] = [];
const deps = (over: Partial<EdgeDeps> = {}): EdgeDeps => ({
  assets: async (req) => {
    const p = new URL(req.url).pathname;
    ASSET_PATHS.push(p);
    return p === "/ssr-template.html"
      ? new Response(TEMPLATE, { headers: { "Content-Type": "text/html" } })
      : new Response("static:" + p, { status: p === "/missing.png" ? 404 : 200 });
  },
  api: createMemoryApi({
    stores,
    products,
    redirects: [{ storeSlug: "ama-hairs", oldSlug: "old-wig-name", newSlug: "body-wave-wig" }],
  }),
  render,
  prerendered: prerenderRoutes,
  ...over,
});
const get = async (path: string, init: RequestInit = {}, d = deps()) => {
  const res = await handlePublicRequest(new Request(`https://sellsharp.ng${path}`, init), d);
  return { res, body: await res.text() };
};
const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const meta = (body: string, attr: string) => {
  const m = new RegExp(`<meta[^>]*${attr}[^>]*content="([^"]*)"`).exec(body);
  return m ? unescape(m[1]) : null;
};
const canonical = (body: string) => /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/.exec(body)?.[1] ?? null;
const jsonLd = (body: string) =>
  [...body.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );

beforeEach(() => {
  __resetTemplateCache();
  ASSET_PATHS = [];
});

describe("store page: meaningful HTML in the first response", () => {
  it("contains the h1, description, products and prices without any JavaScript", async () => {
    const { res, body } = await get("/ama-hairs");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("<h1>Ama Hair Studio</h1>");
    expect(body).toContain("Body Wave Wig");
    expect(body).toContain("₦45,000");
    expect(body).toContain('href="/ama-hairs/products/body-wave-wig"');
    expect(body).toContain('data-ssr="true"');
  });

  it("carries title, description, canonical and social tags in the head", async () => {
    const { body } = await get("/ama-hairs");
    expect(/<title[^>]*>([^<]*)<\/title>/.exec(body)?.[1]).toBe("Ama Hair Studio – Buy Hair &amp; Wigs in Abuja");
    expect(meta(body, 'name="description"')).toContain("Quality goods");
    expect(canonical(body)).toBe("https://sellsharp.ng/ama-hairs");
    expect(meta(body, 'property="og:url"')).toBe(canonical(body));
    expect(meta(body, 'property="og:title"')).toBe("Ama Hair Studio");
    expect(meta(body, 'property="og:type"')).toBe("website");
    expect(meta(body, 'property="og:image"')).toBe("https://cdn.example.com/ama/cover.jpg");
    expect(meta(body, 'property="og:image:secure_url"')).toBe("https://cdn.example.com/ama/cover.jpg");
    expect(meta(body, 'name="twitter:card"')).toBe("summary_large_image");
    expect(meta(body, 'name="robots"')).toBe("index, follow, max-image-preview:large");
  });

  it("includes OnlineStore structured data and never private fields", async () => {
    const { body } = await get("/ama-hairs");
    const ld = jsonLd(body);
    expect(ld.map((x) => x["@type"])).toEqual(expect.arrayContaining(["OnlineStore", "BreadcrumbList"]));
    for (const secret of ["owner_id", "contact_phone", "contact_email", "ownerId", "stock_quantity"])
      expect(body).not.toContain(secret);
  });

  it("embeds the data needed to hydrate, escaped so it cannot close the script tag", async () => {
    const { body } = await get("/evil-shop");
    const script = /<script>window\.__SS_DATA__=([\s\S]*?)<\/script>/.exec(body)![1];
    expect(script).not.toContain("<");
    expect(JSON.parse(script).data.store.slug).toBe("evil-shop");
  });
});

describe("product page: exact product under its owning vendor", () => {
  it("renders the product with its vendor, image, price, availability and a link back", async () => {
    const { res, body } = await get("/ama-hairs/products/body-wave-wig");
    expect(res.status).toBe(200);
    expect(body).toContain("<h1");
    expect(body).toMatch(/<h1[^>]*>Body Wave Wig<\/h1>/);
    expect(body).toContain("₦45,000");
    expect(body).toContain("In stock");
    expect(body).toContain('href="/ama-hairs"'); // link back to the store
    expect(body).toContain("Ama Hair Studio");
    expect(body).toMatch(
      /<img[^>]*src="https:\/\/cdn\.example\.com\/ama-hairs\/body-wave-wig\.jpg"[^>]*alt="Body Wave Wig photo"/,
    );
  });

  it("has product-specific social tags, with the vendor in the title", async () => {
    const { body } = await get("/ama-hairs/products/body-wave-wig");
    expect(canonical(body)).toBe("https://sellsharp.ng/ama-hairs/products/body-wave-wig");
    expect(meta(body, 'property="og:url"')).toBe(canonical(body));
    expect(meta(body, 'property="og:type"')).toBe("product");
    expect(meta(body, 'property="og:title"')).toBe("Body Wave Wig – Ama Hair Studio");
    expect(meta(body, 'property="og:image"')).toBe("https://cdn.example.com/ama-hairs/body-wave-wig.jpg");
    expect(meta(body, 'property="og:image:width"')).toBe("1200");
    expect(meta(body, 'property="og:image:height"')).toBe("800");
    expect(meta(body, 'property="product:price:amount"')).toBe("45000.00");
    expect(meta(body, 'property="product:price:currency"')).toBe("NGN");
    expect(meta(body, 'name="twitter:image"')).toBe("https://cdn.example.com/ama-hairs/body-wave-wig.jpg");
  });

  it("emits valid Product structured data for the right seller", async () => {
    const product = jsonLd((await get("/ama-hairs/products/body-wave-wig")).body).find(
      (x) => x["@type"] === "Product",
    )!;
    expect(product.offers).toMatchObject({
      priceCurrency: "NGN",
      price: "45000.00",
      availability: "https://schema.org/InStock",
      seller: { name: "Ama Hair Studio" },
    });
    expect(product.url).toBe("https://sellsharp.ng/ama-hairs/products/body-wave-wig");
  });

  it("two vendors with the same product slug each get their OWN product, never each other's", async () => {
    const a = (await get("/ama-hairs/products/body-wave-wig")).body;
    const b = (await get("/glow-by-ife/products/body-wave-wig")).body;
    expect(a).toContain("Body Wave Wig");
    expect(a).not.toContain("Glow Serum");
    expect(b).toContain("Glow Serum");
    expect(b).not.toContain("Body Wave Wig");
    expect(meta(b, 'property="og:title"')).toBe("Glow Serum – Glow by Ife");
    expect(meta(b, 'property="og:image"')).toContain("/glow-by-ife/");
    expect(canonical(b)).toBe("https://sellsharp.ng/glow-by-ife/products/body-wave-wig");
  });

  it("a product cannot be reached through another vendor's store path", async () => {
    const { res, body } = await get("/glow-by-ife/products/straight-bundle");
    expect(res.status).toBe(404);
    expect(body).not.toContain("Straight Bundle");
  });

  it("out-of-stock products stay public with accurate availability", async () => {
    const { res, body } = await get("/ama-hairs/products/straight-bundle");
    expect(res.status).toBe(200);
    expect(body).toContain("Out of stock");
    expect(jsonLd(body).find((x) => x["@type"] === "Product")!.offers).toMatchObject({
      availability: "https://schema.org/OutOfStock",
    });
    expect(meta(body, 'name="robots"')).toContain("index");
  });

  it("a renamed product 301s to its new URL", async () => {
    const { res } = await get("/ama-hairs/products/old-wig-name");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/ama-hairs/products/body-wave-wig");
  });
});

describe("real HTTP statuses", () => {
  it.each(["/no-such-store", "/ama-hairs/products/nope", "/ama-hairs/nonsense", "/admin", "/a/b/c/d"])(
    "%s → 404, noindex, with a friendly page",
    async (path) => {
      const { res, body } = await get(path);
      expect(res.status).toBe(404);
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
      expect(meta(body, 'name="robots"')).toMatch(/noindex/);
      expect(body).toContain("404");
    },
  );

  it("a store that exists but is not public (suspended/unpublished) is a 404 too", async () => {
    // The public views never return such stores, so the API (like production) simply doesn't know them.
    expect((await get("/suspended-shop")).res.status).toBe(404);
  });

  it("incomplete stores are public but noindex (never in sitemaps)", async () => {
    const { res, body } = await get("/empty-shop");
    expect(res.status).toBe(200);
    expect(meta(body, 'name="robots"')).toBe("noindex, follow");
  });

  it("canonicalises uppercase and trailing slashes with a 301", async () => {
    for (const [from, to] of [
      ["/Ama-Hairs", "/ama-hairs"],
      ["/ama-hairs/", "/ama-hairs"],
      ["/ama-hairs/products/Body-Wave-Wig/", "/ama-hairs/products/body-wave-wig"],
    ]) {
      const { res } = await get(from);
      expect(res.status, from).toBe(301);
      expect(res.headers.get("location")).toBe(to);
    }
  });

  it("answers a data outage with 503 + Retry-After, never a 404 that could de-index pages", async () => {
    const broken = deps({
      api: {
        ...deps().api,
        getStore: async () => {
          throw new Error("db down");
        },
      },
    });
    const { res } = await get("/ama-hairs", {}, broken);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("HEAD returns headers only", async () => {
    const res = await handlePublicRequest(new Request("https://sellsharp.ng/ama-hairs", { method: "HEAD" }), deps());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});

describe("crawlers get the same complete page as people", () => {
  const AGENTS = [
    "WhatsApp/2.23.20.0",
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "TelegramBot (like TwitterBot)",
    "Googlebot/2.1",
    "Mozilla/5.0 (iPhone)",
  ];
  it.each(AGENTS)("%s", async (ua) => {
    const { res, body } = await get("/ama-hairs/products/body-wave-wig", { headers: { "User-Agent": ua } });
    expect(res.status).toBe(200);
    expect(meta(body, 'property="og:title"')).toBe("Body Wave Wig – Ama Hair Studio");
    expect(meta(body, 'property="og:image"')).toMatch(/^https:\/\//);
  });
});

describe("user-written text is never executed", () => {
  it("escapes markup in names, descriptions and structured data", async () => {
    const { body } = await get("/evil-shop");
    expect(body).not.toContain('<script>alert("xss")');
    expect(body).not.toContain("<img src=x onerror");
    expect(body).not.toContain("</title><script>");
    expect(body).toContain("&lt;/title&gt;");
    for (const ld of body.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g))
      expect(ld[1]).not.toContain("<");
  });

  it("does not mangle text that looks like a replacement pattern ($& and $1)", async () => {
    const { body } = await get("/evil-shop");
    expect(body).toContain("goods $&amp; $1 for you");
  });
});

describe("account pages and static files", () => {
  it.each(["/dashboard", "/dashboard/seo", "/onboarding", "/onboarding/payment"])(
    "%s is served as a noindex app shell",
    async (path) => {
      const { res, body } = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(meta(body, 'name="robots"')).toBe("noindex, nofollow");
      expect(body).not.toContain("data-ssr");
    },
  );

  it("prerendered marketing pages and assets pass straight through", async () => {
    expect((await get("/features")).body).toBe("static:/features");
    expect((await get("/reset-password")).body).toBe("static:/reset-password"); // prerendered, noindex in its own head
    expect((await get("/assets/app.js")).body).toBe("static:/assets/app.js");
    expect((await get("/og-default.png")).body).toBe("static:/og-default.png");
    expect(ASSET_PATHS).not.toContain("/ssr-template.html");
  });

  it("adds security headers and cache headers to rendered pages", async () => {
    const { res } = await get("/ama-hairs");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });
});

describe("sitemaps", () => {
  const xml = async (path: string) => (await get(path)).body;
  const locs = (x: string) => [...x.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

  it("the index lists platform, stores and products sitemaps", async () => {
    const { res, body } = await get("/sitemap.xml");
    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(locs(body)).toEqual([
      "https://sellsharp.ng/sitemaps/platform.xml",
      "https://sellsharp.ng/sitemaps/stores.xml",
      "https://sellsharp.ng/sitemaps/products-1.xml",
    ]);
  });

  it("stores.xml has only indexable stores with accurate dates, and canonical URLs", async () => {
    const x = await xml("/sitemaps/stores.xml");
    expect(locs(x)).toEqual(
      expect.arrayContaining(["https://sellsharp.ng/ama-hairs", "https://sellsharp.ng/glow-by-ife"]),
    );
    expect(x).not.toContain("empty-shop"); // incomplete store
    expect(x).toContain("<lastmod>2026-11-03</lastmod>");
    for (const l of locs(x)) expect(l).toBe(l.toLowerCase());
  });

  it("products-1.xml has only indexable products under their own store", async () => {
    const x = await xml("/sitemaps/products-1.xml");
    expect(locs(x)).toEqual(
      expect.arrayContaining([
        "https://sellsharp.ng/ama-hairs/products/body-wave-wig",
        "https://sellsharp.ng/glow-by-ife/products/body-wave-wig",
      ]),
    );
    expect(x).toContain("<lastmod>2026-11-04</lastmod>");
  });

  it("excludes drafts, noindex products and private pages", async () => {
    const hidden = deps({
      api: createMemoryApi({
        stores,
        products: [...products, pr("ama-hairs", "no-photo", "No Photo", { isIndexable: false, images: [] })],
      }),
    });
    const x = (await get("/sitemaps/products-1.xml", {}, hidden)).body;
    expect(x).not.toContain("no-photo");
    for (const banned of ["dashboard", "login", "signup", "checkout", "onboarding", "admin"])
      expect(`${await xml("/sitemaps/stores.xml")}${x}`).not.toContain(banned);
  });

  it("escapes XML special characters", async () => {
    const odd = deps({ api: createMemoryApi({ stores, products: [pr("ama-hairs", "a-b", "x")], redirects: [] }) });
    expect((await get("/sitemaps/products-1.xml", {}, odd)).body).toContain(
      "<loc>https://sellsharp.ng/ama-hairs/products/a-b</loc>",
    );
  });
});

describe("store directory", () => {
  it("/stores lists real stores, categories and locations, and is indexable", async () => {
    const { res, body } = await get("/stores");
    expect(res.status).toBe(200);
    expect(body).toContain("Ama Hair Studio");
    expect(body).toContain('href="/stores/hair-wigs"');
    expect(meta(body, 'name="robots"')).toContain("index");
    expect(body).not.toContain("Empty Shop"); // non-indexable stores are not advertised
  });

  it("a landing page with too few stores stays out of search results (no thin pages)", async () => {
    const { res, body } = await get("/stores/skincare-beauty");
    expect(res.status).toBe(200);
    expect(meta(body, 'name="robots"')).toBe("noindex, follow");
    expect(locs((await get("/sitemaps/stores.xml")).body)).not.toContain("https://sellsharp.ng/stores/skincare-beauty");
  });

  it("becomes indexable and enters the sitemap once it has enough stores", async () => {
    const many = [1, 2, 3].map((n) => mk({ slug: `hair-shop-${n}`, name: `Hair Shop ${n}` }));
    const rich = deps({ api: createMemoryApi({ stores: many, products: [] }) });
    const page = await get("/stores/hair-wigs", {}, rich);
    expect(meta(page.body, 'name="robots"')).toContain("index, follow");
    expect(locs((await get("/sitemaps/stores.xml", {}, rich)).body)).toContain("https://sellsharp.ng/stores/hair-wigs");
  });

  it("search-result pages are never indexed, and unknown facets 404", async () => {
    expect(meta((await get("/stores?q=ama")).body, 'name="robots"')).toBe("noindex, follow");
    expect((await get("/stores/does-not-exist")).res.status).toBe(404);
  });

  it("the canonical URL ignores the search query", async () => {
    expect(canonical((await get("/stores?q=ama")).body)).toBe("https://sellsharp.ng/stores");
  });
});

const locs = (x: string) => [...x.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
