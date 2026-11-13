import type { PublicApi } from "../data/publicApi";
import { MIN_STORES_FOR_LANDING_PAGE } from "../ssr/pageData";
import { directoryPath, productPath, storePath } from "../lib/routes";

export const URLS_PER_SITEMAP = 10_000; // the protocol allows 50,000; smaller files are faster to generate and cache

export const xmlEscape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const date = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

const urlset = (entries: Array<{ loc: string; lastmod?: string }>) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(
      (e) => `  <url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${date(e.lastmod)}</lastmod>` : ""}</url>`,
    )
    .join("\n")}\n</urlset>\n`;

/** /sitemap.xml: points at the platform file, the stores file and one products file per 10,000 products. */
export async function buildSitemapIndex(api: PublicApi, site: string): Promise<string> {
  const products = await api.sitemapProductCount();
  const files = ["/sitemaps/platform.xml", "/sitemaps/stores.xml"];
  for (let i = 1; i <= Math.max(1, Math.ceil(products / URLS_PER_SITEMAP)); i++)
    files.push(`/sitemaps/products-${i}.xml`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files
    .map((f) => `  <sitemap><loc>${xmlEscape(site + f)}</loc></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`;
}

/** Indexable stores, plus the directory pages that have enough real stores to deserve an index entry. */
export async function buildStoresSitemap(api: PublicApi, site: string): Promise<string> {
  const [stores, facets] = await Promise.all([api.sitemapStores(0, URLS_PER_SITEMAP), api.directoryFacets()]);
  const directory = [
    ...(stores.length > 0 ? [{ loc: site + directoryPath() }] : []),
    ...facets
      .filter((f) => f.storeCount >= MIN_STORES_FOR_LANDING_PAGE)
      .map((f) => ({ loc: site + directoryPath(f.slug) })),
  ];
  return urlset([...directory, ...stores.map((s) => ({ loc: site + storePath(s.slug), lastmod: s.lastModified }))]);
}

export async function buildProductsSitemap(api: PublicApi, site: string, page: number): Promise<string> {
  const rows = await api.sitemapProducts((page - 1) * URLS_PER_SITEMAP, URLS_PER_SITEMAP);
  return urlset(rows.map((p) => ({ loc: site + productPath(p.storeSlug, p.slug), lastmod: p.lastModified })));
}
