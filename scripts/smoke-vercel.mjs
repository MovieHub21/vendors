/**
 * Runs the BUILT Vercel edge function (dist-vercel/index.js) like Vercel will: the route table sends non-file URLs to
 * /ssr?__p=<path>, static files come from dist/, Supabase is faked. Run after `npm run build`:  npm run smoke:vercel
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

process.env.VITE_SUPABASE_URL = "https://proj.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
const dist = path.resolve("dist");
const handler = (await import(pathToFileURL(path.resolve("dist-vercel/index.js")).href)).default;

const store = {
  id: "s1", slug: "ama-hairs", name: "Ama Hair Studio", tagline: "Quality wigs",
  description: "Quality human hair, wigs and extensions shipped across Nigeria.",
  category: "Hair & wigs", category_slug: "hair-wigs", city: "Abuja", city_slug: "abuja",
  state: "FCT (Abuja)", state_slug: "fct-abuja", logo_url: null, cover_url: "https://cdn.example.com/cover.jpg",
  og_image_url: null, seo_title: null, seo_description: null, is_indexable: true, product_count: 1,
  created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-02T00:00:00Z", last_modified: "2026-11-03T00:00:00Z",
};
const product = {
  id: "p1", store_slug: "ama-hairs", slug: "body-wave-wig", name: "Body Wave Wig",
  description: "A soft, full body wave wig made from human hair.", price_kobo: 4500000, is_available: true,
  category: null, seo_title: null, seo_description: null, og_image_url: null, is_indexable: true,
  created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-04T00:00:00Z",
  images: [{ url: "https://cdn.example.com/wig.jpg", alt: "Body wave wig", width: 1200, height: 800 }],
};
const views = {
  public_stores: [store], public_products: [product], public_product_redirects: [],
  public_directory_categories: [], public_directory_locations: [],
  sitemap_stores: [{ slug: "ama-hairs", last_modified: store.last_modified }],
  sitemap_products: [{ store_slug: "ama-hairs", slug: "body-wave-wig", last_modified: product.updated_at }],
};

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname.endsWith("supabase.co")) {
    const view = url.pathname.replace("/rest/v1/", "");
    let rows = [...(views[view] ?? [])];
    for (const [k, v] of url.searchParams) if (v.startsWith("eq.")) rows = rows.filter((r) => String(r[k]) === v.slice(3));
    const headers = { "Content-Type": "application/json" };
    if (new Headers(init?.headers).get("Prefer")?.includes("count=exact")) headers["Content-Range"] = `0-0/${rows.length}`;
    return new Response(JSON.stringify(rows), { headers });
  }
  const file = path.join(dist, url.pathname);
  if (file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile())
    return new Response(fs.readFileSync(file), { headers: { "Content-Type": "text/html" } });
  return new Response("not found", { status: 404 });
};

// What Vercel's route table does: /ama-hairs  →  /ssr?__p=ama-hairs
const get = async (p) => {
  const [pathname, query = ""] = p.split("?");
  const qs = new URLSearchParams(query);
  qs.set("__p", pathname.replace(/^\//, ""));
  const res = await handler(new Request(`https://sellsharp-six.vercel.app/ssr?${qs}`, { headers: { "User-Agent": "WhatsApp/2.23" } }));
  return { res, body: await res.text() };
};
let n = 0;
const ok = (name, fn) => (fn(), console.log(`  ✓ ${name}`), n++);

console.log("smoke test: dist-vercel/index.js");
let r = await get("/ama-hairs");
ok("store link: server HTML has title + Open Graph tags (what WhatsApp reads)", () => {
  assert.equal(r.res.status, 200);
  assert.match(r.body, /property="og:title"[^>]*content="Ama Hair Studio"/);
  assert.match(r.body, /property="og:image"[^>]*content="https:\/\/cdn\.example\.com\/cover\.jpg"/);
  assert.match(r.body, /name="twitter:card"/);
});
r = await get("/ama-hairs/products/body-wave-wig");
ok("product link: product title, price and photo in the preview", () => {
  assert.equal(r.res.status, 200);
  assert.match(r.body, /property="og:title"[^>]*content="Body Wave Wig – Ama Hair Studio"/);
  assert.match(r.body, /property="og:image"[^>]*content="https:\/\/cdn\.example\.com\/wig\.jpg"/);
  assert.match(r.body, /product:price:amount/);
});
r = await get("/no-such-store");
ok("unknown store: real 404", () => assert.equal(r.res.status, 404));
r = await get("/pricing");
ok("marketing page: prerendered file, no redirect loop", () => assert.equal(r.res.status, 200));
r = await get("/dashboard/orders");
ok("dashboard: app shell, noindex", () => {
  assert.equal(r.res.status, 200);
  assert.match(r.body, /noindex/);
});
console.log(`${n} checks passed`);
