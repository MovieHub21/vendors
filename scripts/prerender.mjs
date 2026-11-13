/**
 * Runs after the client build, the server build and the worker build. Writes:
 *   dist/<page>/index.html          real HTML for every public marketing page (own title, description, canonical, JSON-LD)
 *   dist/ssr-template.html          the page frame the edge renderer fills in for stores and products
 *   dist/app-shell.html             empty client-rendered frame (fallback for hosts without the edge renderer)
 *   dist/sitemaps/platform.xml      the SellSharp marketing pages
 *   dist/sitemap.xml                a static index (platform only). On Cloudflare the Worker replaces it with the
 *                                   full dynamic index that also lists every eligible store and product.
 *   dist/robots.txt
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

// Function replacers on purpose: page text containing "$&" or "$1" must never be treated as a replacement pattern.
fs.writeFileSync(path.join(dist, "ssr-template.html"), template);
fs.writeFileSync(
  path.join(dist, "app-shell.html"),
  template.replace("<!--app-head-->", () => "<title>Loading…</title>").replace(ROOT, () => '<div id="root"></div>'),
);

for (const route of ssr.prerenderRoutes) {
  const { html, head } = ssr.render(route);
  const page = template
    .replace("<!--app-head-->", () => head)
    .replace(ROOT, () => `<div id="root" data-ssr="true">${html}</div>`);
  const file = route === "/" ? "index.html" : path.join(route.slice(1), "index.html");
  fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
  fs.writeFileSync(path.join(dist, file), page);
}

const site = ssr.siteUrl;
const today = new Date().toISOString().slice(0, 10);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

fs.mkdirSync(path.join(dist, "sitemaps"), { recursive: true });
fs.writeFileSync(
  path.join(dist, "sitemaps", "platform.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ssr.indexableRoutes
    .map((r) => `  <url><loc>${esc(site + (r === "/" ? "/" : r))}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${esc(site)}/sitemaps/platform.xml</loc></sitemap>\n</sitemapindex>\n`,
);

fs.writeFileSync(
  path.join(dist, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "",
    "# Private and transactional areas (never meant for search)",
    "Disallow: /dashboard/",
    "Disallow: /dashboard",
    "Disallow: /onboarding",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /signup",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "Disallow: /checkout/",
    "Disallow: /*/checkout",
    "Disallow: /*/order/",
    "Disallow: /admin/",
    "Disallow: /account/",
    "# Internal page frames",
    "Disallow: /ssr-template.html",
    "Disallow: /app-shell.html",
    "",
    `Sitemap: ${site}/sitemap.xml`,
    "",
  ].join("\n"),
);

fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(
  `prerendered ${ssr.prerenderRoutes.length} pages; wrote ssr-template.html, app-shell.html, sitemaps/platform.xml, sitemap.xml, robots.txt (${site})`,
);
