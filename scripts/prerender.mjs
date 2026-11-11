/**
 * Runs after `vite build` and `vite build --ssr`. Writes real HTML for every public marketing page (own <title>,
 * description, canonical, Open Graph and JSON-LD), plus sitemap.xml and robots.txt.
 *
 * Output:
 *   dist/index.html, dist/features/index.html, ...   prerendered pages (hydrated by React in the browser)
 *   dist/app-shell.html                              empty client-rendered shell: SPA fallback for /:storeSlug pages
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const ssrDir = path.resolve("dist-ssr");
const ssr = await import(pathToFileURL(path.join(ssrDir, "entry-server.js")).href);
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const ROOT = '<div id="root"><!--app-html--></div>';

for (const marker of ["<!--app-head-->", ROOT]) {
  if (!template.includes(marker)) throw new Error(`dist/index.html is missing ${marker}`);
}

// Client-only shell for pages whose content is not known at build time (vendor storefronts).
fs.writeFileSync(
  path.join(dist, "app-shell.html"),
  template.replace("<!--app-head-->", "<title>Loading…</title>").replace(ROOT, '<div id="root"></div>'),
);

for (const route of ssr.prerenderRoutes) {
  const { html, head } = ssr.render(route);
  const page = template.replace("<!--app-head-->", head).replace(ROOT, `<div id="root" data-ssr="true">${html}</div>`);
  const file = route === "/" ? "index.html" : path.join(route.slice(1), "index.html");
  fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
  fs.writeFileSync(path.join(dist, file), page);
}

const site = ssr.siteUrl;
const today = new Date().toISOString().slice(0, 10);
const urls = ssr.indexableRoutes
  .map((r) => `  <url><loc>${site}${r === "/" ? "/" : r}</loc><lastmod>${today}</lastmod></url>`)
  .join("\n");
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

fs.writeFileSync(
  path.join(dist, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "# Private and transactional areas",
    "Disallow: /app/",
    "Disallow: /admin/",
    "Disallow: /onboarding/",
    "Disallow: /*/checkout",
    "Disallow: /*/order/",
    "",
    `Sitemap: ${site}/sitemap.xml`,
    "",
  ].join("\n"),
);

fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(`prerendered ${ssr.prerenderRoutes.length} pages + app-shell.html, sitemap.xml, robots.txt (${site})`);
