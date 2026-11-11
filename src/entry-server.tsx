import { renderToString } from "react-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { StaticRouter } from "react-router-dom/server";
import App from "./App";
import { INDEXABLE_ROUTES } from "./lib/routes";
import { SITE } from "./lib/site";

export function render(url: string) {
  const helmetContext: { helmet?: HelmetServerState } = {};
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </HelmetProvider>,
  );
  const h = helmetContext.helmet!;
  const head = [h.title, h.meta, h.link, h.script].map((x) => x.toString()).join("\n    ");
  return { html, head };
}

/** Everything scripts/prerender.mjs needs: pages to write, plus the site origin for sitemap.xml and robots.txt. */
// Forms that work without account data are prerendered; account pages (/onboarding, /app…) load from the app shell.
export const prerenderRoutes: readonly string[] = [
  ...INDEXABLE_ROUTES,
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];
export const indexableRoutes: readonly string[] = INDEXABLE_ROUTES;
export const siteUrl = SITE.url;
