/**
 * Runs the BUILT worker (dist/_worker.js) the way Cloudflare Pages will: a fake Supabase returns rows shaped like the
 * SQL views, ASSETS serves the files in dist/. Run after `npm run build`:  npm run smoke
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const worker = (await import(pathToFileURL(path.join(dist, "_worker.js")).href)).default;

const store = {
  id: "s1",
  slug: "ama-hairs",
  name: "Ama Hair Studio",
  tagline: "Quality wigs",
  description: "Quality human hair, wigs and extensions shipped across Nigeria.",
  category: "Hair & wigs",
  category_slug: "hair-wigs",
  city: "Abuja",
  city_slug: "abuja",
  state: "FCT (Abuja)",
  state_slug: "fct-abuja",
  logo_url: null,
  cover_url: "https://cdn.example.com/cover.jpg",
  og_image_url: null,
  seo_title: null,
  seo_description: null,
  is_indexable: true,
  product_count: 1,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-02T00:00:00Z",
  last_modified: "2026-11-03T00:00:00Z",
};
const product = {
  id: "p1",
  store_slug: "ama-hairs",
  slug: "body-wave-wig",
  name: "Body Wave Wig",
  description: "A soft, full body wave wig made from human hair.",
  price_kobo: 4500000,
  is_available: true,
  category: null,
  seo_title: null,
  seo_description: null,
  og_image_url: null,
  is_indexable: true,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-04T00:00:00Z",
  images: [{ url: "https://cdn.example.com/wig.jpg", alt: "Body wave wig", width: 1200, height: 800 }],
};
const views = {
  public_stores: [store],
  public_products: [product],
  public_product_redirects: [{ store_slug: "ama-hairs", old_slug: "old-wig", new_slug: "body-wave-wig" }],
  public_directory_categories: [],
  public_directory_locations: [],
  sitemap_stores: [{ slug: "ama-hairs", last_modified: store.last_modified }],
  sitemap_products: [{ store_slug: "ama-hairs", slug: "body-wave-wig", last_modified: product.updated_at }],
};

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const view = url.pathname.replace("/rest/v1/", "");
  let rows = [...(views[view] ?? [])];
  for (const [k, v] of url.searchParams)
    if (v.startsWith("eq.")) rows = rows.filter((r) => String(r[k]) === v.slice(3));
  const headers = { "Content-Type": "application/json" };
  if (new Headers(init?.headers).get("Prefer")?.includes("count=exact"))
    headers["Content-Range"] = `0-0/${rows.length}`;
  return new Response(JSON.stringify(rows), { headers });
};

const env = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  ASSETS: {
    async fetch(req) {
      let p = new URL(req.url).pathname;
      for (const candidate of [p, path.join(p, "index.html")]) {
        const file = path.join(dist, candidate);
        if (file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile())
          return new Response(fs.readFileSync(file), {
            headers: { "Content-Type": file.endsWith(".html") ? "text/html" : "application/octet-stream" },
          });
      }
      return new Response("not found", { status: 404 });
    },
  },
};
const ctx = { waitUntil() {} };
const get = async (p, init) => {
  const res = await worker.fetch(new Request(`https://sellsharp.ng${p}`, init), env, ctx);
  return { res, body: await res.text() };
};
let n = 0;
const ok = (name, fn) => (fn(), console.log(`  ✓ ${name}`), n++);

console.log("smoke test: dist/_worker.js");
let r = await get("/ama-hairs", { headers: { "User-Agent": "WhatsApp/2.23" } });
ok("store page: 200 HTML with h1, canonical and Open Graph in the first response", () => {
  assert.equal(r.res.status, 200);
  assert.match(r.body, /<h1>Ama Hair Studio<\/h1>/);
  assert.match(r.body, /rel="canonical"[^>]*href="https:\/\/sellsharp\.ng\/ama-hairs"/);
  assert.match(r.body, /property="og:title"[^>]*content="Ama Hair Studio"/);
  assert.match(r.body, /data-ssr="true"/);
  assert.match(r.body, /<script type="module"[^>]*src="\/assets\//); // the real app still loads and hydrates
});
r = await get("/ama-hairs/products/body-wave-wig");
ok("product page: product-specific preview and Product JSON-LD", () => {
  assert.equal(r.res.status, 200);
  assert.match(r.body, /property="og:title"[^>]*content="Body Wave Wig – Ama Hair Studio"/);
  assert.match(r.body, /property="og:image"[^>]*content="https:\/\/cdn\.example\.com\/wig\.jpg"/);
  assert.match(r.body, /"priceCurrency":"NGN"/);
});
r = await get("/ama-hairs/products/old-wig");
ok("renamed product: 301 to the new URL", () => {
  assert.equal(r.res.status, 301);
  assert.equal(r.res.headers.get("location"), "/ama-hairs/products/body-wave-wig");
});
r = await get("/no-such-store");
ok("unknown store: real 404 + noindex", () => {
  assert.equal(r.res.status, 404);
  assert.match(r.body, /noindex/);
});
r = await get("/sitemap.xml");
ok("sitemap index lists platform, stores and products", () => {
  assert.match(r.body, /sitemaps\/platform\.xml/);
  assert.match(r.body, /sitemaps\/stores\.xml/);
  assert.match(r.body, /sitemaps\/products-1\.xml/);
});
r = await get("/sitemaps/products-1.xml");
ok("products sitemap has the product URL", () =>
  assert.match(r.body, /https:\/\/sellsharp\.ng\/ama-hairs\/products\/body-wave-wig/),
);
r = await get("/sitemaps/platform.xml");
ok("platform sitemap is served from the build", () => assert.match(r.body, /https:\/\/sellsharp\.ng\/pricing/));
r = await get("/pricing");
ok("marketing pages are the prerendered files", () => assert.match(r.body, /Pricing: ₦3,000\/month/));
r = await get("/dashboard");
ok("dashboard is a noindex shell", () => {
  assert.equal(r.res.headers.get("x-robots-tag"), "noindex, nofollow");
});
r = await get("/robots.txt");
ok("robots.txt blocks private areas and points at the sitemap", () => {
  assert.match(r.body, /Disallow: \/dashboard\//);
  assert.match(r.body, /Sitemap: https:\/\/sellsharp\.ng\/sitemap\.xml/);
});
console.log(`${n} checks passed`);
