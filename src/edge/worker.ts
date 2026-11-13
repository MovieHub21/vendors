/** Cloudflare Pages "advanced mode" entry. Built to dist/_worker.js by `npm run build`. */
import { createRestApi } from "../data/publicApi";
import { prerenderRoutes, render } from "../entry-server";
import { handlePublicRequest } from "./handler";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}
interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
      const url = new URL(request.url);
      // Marketing pages and assets still work without a backend; only vendor pages need it.
      if (/\.[a-z0-9]+$/i.test(url.pathname) || prerenderRoutes.includes(url.pathname) || url.pathname === "/")
        return env.ASSETS.fetch(request);
      return new Response(
        "SellSharp is not fully configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY on the Worker.",
        { status: 503 },
      );
    }
    const cache =
      typeof caches !== "undefined"
        ? (caches as unknown as { default?: Parameters<typeof handlePublicRequest>[1]["cache"] }).default
        : undefined;
    return handlePublicRequest(request, {
      assets: (r) => env.ASSETS.fetch(r),
      api: createRestApi({ url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY }),
      render,
      prerendered: prerenderRoutes,
      cache,
      waitUntil: (p) => ctx.waitUntil(p),
    });
  },
};
