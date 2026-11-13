/**
 * Vercel Edge Function entry. Same portable handler as the Cloudflare Worker (src/edge/handler.ts), so a link to
 * /ama-hairs or /ama-hairs/products/body-wave-wig returns HTML that already contains the title, description and
 * Open Graph / Twitter tags. WhatsApp, Facebook and X read those tags without running JavaScript.
 *
 * Built by `vite build --config vite.vercel.config.ts` and packaged by scripts/vercel-output.mjs.
 * Env (Vercel → Settings → Environment Variables): VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY are enough
 * (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY also work).
 */
import { createRestApi } from "../data/publicApi";
import { prerenderRoutes, render } from "../entry-server";
import { handlePublicRequest } from "./handler";

/**
 * Read through globalThis on purpose: the bundler rewrites a literal `process.env` to an empty object at build time,
 * which would hide the variables Vercel sets at runtime.
 */
const env = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];

/** The route table sends every non-file URL to /ssr?__p=<original path>; put the original URL back. */
function originalRequest(request: Request): Request {
  const url = new URL(request.url);
  const p = url.searchParams.get("__p");
  if (p === null) return request;
  url.searchParams.delete("__p");
  url.pathname = `/${p.replace(/^\/+/, "")}`;
  return new Request(url, request);
}

/** Static files (HTML, assets, template) live on the same deployment: fetch them from our own origin. */
function assets(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let path = url.pathname;
  // Prerendered pages are folders (dist/pricing/index.html); ask for the file so the route table cannot loop back here.
  if (!/\.[a-z0-9]+$/i.test(path) && !path.startsWith("/assets/")) path = `${path === "/" ? "" : path}/index.html`;
  return fetch(new URL(path, url.origin), { headers: { "x-sellsharp-asset": "1" } });
}

export const config = { runtime: "edge" };

export default async function handler(incoming: Request): Promise<Response> {
  const supabaseUrl = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_PUBLISHABLE_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const request = originalRequest(incoming);
  if (!supabaseUrl || !key) {
    return new Response(
      "SellSharp is not fully configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel.",
      { status: 503 },
    );
  }
  // A request for a file that does not exist must 404, never recurse through this function.
  if (request.headers.get("x-sellsharp-asset") && /\.[a-z0-9]+$/i.test(new URL(request.url).pathname))
    return new Response("Not found", { status: 404 });
  return handlePublicRequest(request, {
    assets,
    api: createRestApi({ url: supabaseUrl, key }),
    render,
    prerendered: prerenderRoutes,
  });
}
