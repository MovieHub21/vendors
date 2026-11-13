/**
 * Server-side rendering for public vendor pages, as a portable Web-standard handler (Request → Response).
 * Cloudflare Pages runs it through src/edge/worker.ts (bundled to dist/_worker.js).
 *
 * What it guarantees for /{store}, /{store}/products/{product}, /stores…:
 *  - the HTML a crawler receives ALREADY contains the title, description, canonical, Open Graph/Twitter tags,
 *    JSON-LD and the visible content (h1, products, images). Nothing depends on JavaScript.
 *  - real HTTP statuses: 200, 301 (renamed product, trailing slash, uppercase), 404 (unknown/hidden), 503 (data outage)
 *  - one answer for every visitor: social crawlers, Googlebot and people all get the same page.
 */
import type { PublicApi } from "../data/publicApi";
import { CLIENT_ONLY_PREFIXES } from "../lib/routes";
import { SITE } from "../lib/site";
import { loadPageData, matchPublicRoute } from "../ssr/pageData";
import type { PreloadedPage } from "../ssr/PreloadedPage";
import { buildProductsSitemap, buildSitemapIndex, buildStoresSitemap } from "./sitemaps";

export interface EdgeDeps {
  /** Serves the built static files (HTML, assets, sitemaps/platform.xml). */
  assets: (request: Request) => Promise<Response>;
  api: PublicApi;
  render: (url: string, preloaded: PreloadedPage | null) => { html: string; head: string };
  /** Paths already prerendered at build time (served straight from assets). */
  prerendered: readonly string[];
  cache?: { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };
  waitUntil?: (p: Promise<unknown>) => void;
}

const TEMPLATE_PATH = "/ssr-template.html";
const ROOT = '<div id="root"><!--app-html--></div>';
const HTML_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
const NOT_FOUND_CACHE = "public, max-age=30, s-maxage=60";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

/** JSON that is safe inside an inline <script>: a vendor's text can never close the tag. */
export const safeScriptJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/** Uses function replacers on purpose: page text containing "$&" or "$1" must never be interpreted as a pattern. */
export function injectIntoTemplate(
  template: string,
  parts: { head: string; html?: string; preloaded?: PreloadedPage | null },
): string {
  const script = parts.preloaded ? `<script>window.__SS_DATA__=${safeScriptJson(parts.preloaded)}</script>` : "";
  return template
    .replace("<!--app-head-->", () => `${parts.head}\n    ${script}`)
    .replace(ROOT, () =>
      parts.html === undefined ? '<div id="root"></div>' : `<div id="root" data-ssr="true">${parts.html}</div>`,
    );
}

function respond(request: Request, body: string, status: number, headers: Record<string, string>): Response {
  return new Response(request.method === "HEAD" ? null : body, {
    status,
    headers: { ...SECURITY_HEADERS, ...headers },
  });
}

const html = (request: Request, body: string, status: number, extra: Record<string, string> = {}) =>
  respond(request, body, status, { "Content-Type": "text/html; charset=utf-8", ...extra });

export async function handlePublicRequest(request: Request, deps: EdgeDeps): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return deps.assets(request);
  const url = new URL(request.url);

  // One URL per page: lowercase, no trailing slash. (Spec: lowercase, readable, no duplicate versions.)
  const clean = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "").toLowerCase() : "/";
  if (clean !== url.pathname && !/\.[a-z0-9]+$/i.test(clean)) {
    return new Response(null, {
      status: 301,
      headers: { Location: clean + url.search, "Cache-Control": "public, max-age=3600" },
    });
  }
  const path = clean;

  try {
    // ---- dynamic sitemaps
    if (path === "/sitemap.xml" || path === "/sitemaps/stores.xml" || /^\/sitemaps\/products-\d+\.xml$/.test(path)) {
      const xml =
        path === "/sitemap.xml"
          ? await buildSitemapIndex(deps.api, SITE.url)
          : path === "/sitemaps/stores.xml"
            ? await buildStoresSitemap(deps.api, SITE.url)
            : await buildProductsSitemap(deps.api, SITE.url, Number(/products-(\d+)/.exec(path)![1]));
      return respond(request, xml, 200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=900",
      });
    }

    // ---- static files and prerendered marketing pages
    if (/\.[a-z0-9]+$/i.test(path) || path.startsWith("/assets/") || deps.prerendered.includes(path))
      return deps.assets(request);

    const cached = deps.cache ? await deps.cache.match(request) : undefined;
    if (cached) return cached;

    const template = await loadTemplate(request, deps);

    // ---- pages that only exist for logged-in users: the browser app takes over, crawlers are told to stay out
    if (CLIENT_ONLY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return html(
        request,
        injectIntoTemplate(template, {
          head: '<title>SellSharp</title>\n    <meta name="robots" content="noindex, nofollow" />',
        }),
        200,
        {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      );
    }

    // ---- dynamic public pages (stores, products, directory)
    const match = matchPublicRoute(path);
    if (match) {
      const result = await loadPageData(match, url.search, deps.api);
      if (result.status === 301) {
        return new Response(null, {
          status: 301,
          headers: { Location: result.redirect, "Cache-Control": "public, max-age=300" },
        });
      }
      const preloaded: PreloadedPage = { path, search: url.search, status: result.status, data: result.data };
      const out = deps.render(path + url.search, preloaded);
      const extra: Record<string, string> = { "Cache-Control": result.status === 404 ? NOT_FOUND_CACHE : HTML_CACHE };
      if (result.status === 404) extra["X-Robots-Tag"] = "noindex";
      const response = html(
        request,
        injectIntoTemplate(template, { head: out.head, html: out.html, preloaded }),
        result.status,
        extra,
      );
      if (deps.cache && request.method === "GET") deps.waitUntil?.(deps.cache.put(request, response.clone()));
      return response;
    }

    // ---- anything else is a real 404 (not a 200 "soft 404")
    const out = deps.render(path, null);
    return html(request, injectIntoTemplate(template, { head: out.head, html: out.html }), 404, {
      "Cache-Control": NOT_FOUND_CACHE,
      "X-Robots-Tag": "noindex",
    });
  } catch (error) {
    // A data outage must never look like "this page doesn't exist" (that could drop pages from Google).
    console.error("public page error", path, error);
    return respond(request, "Temporarily unavailable. Please try again shortly.", 503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "60",
      "Cache-Control": "no-store",
    });
  }
}

let cachedTemplate: string | null = null;
async function loadTemplate(request: Request, deps: EdgeDeps): Promise<string> {
  if (cachedTemplate) return cachedTemplate;
  const res = await deps.assets(new Request(new URL(TEMPLATE_PATH, request.url)));
  if (!res.ok) throw new Error(`Missing ${TEMPLATE_PATH} (run npm run build)`);
  cachedTemplate = await res.text();
  return cachedTemplate;
}

/** For tests. */
export const __resetTemplateCache = () => {
  cachedTemplate = null;
};
