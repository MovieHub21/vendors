import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./styles/base.css";
import "./styles/tokens.generated.css";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/marketing.css";
import "./styles/pages.css";
import "./styles/storefront.css";
import "./styles/auth.css";
<<<<<<< HEAD
import "./styles/dashboard.css";
import "./styles/responsive.css";
import "./styles/utilities.css";
import App from "./App";
import type { PreloadedPage } from "./ssr/PreloadedPage";
import { PreloadedPageContext } from "./ssr/PreloadedPage";

const root = document.getElementById("root")!;
// Dynamic public pages are rendered on the server (src/edge); the data it used is embedded so we can hydrate without refetching.
const preloaded = (window as unknown as { __SS_DATA__?: PreloadedPage }).__SS_DATA__ ?? null;
const app = (
  <StrictMode>
    <HelmetProvider>
      <PreloadedPageContext.Provider value={preloaded}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PreloadedPageContext.Provider>
=======
import "./styles/responsive.css";
import "./styles/utilities.css";
import App from "./App";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
    </HelmetProvider>
  </StrictMode>
);

// Prerendered pages (see scripts/prerender.mjs) already contain HTML; adopt it instead of rebuilding it.
if (root.hasAttribute("data-ssr")) hydrateRoot(root, app);
else createRoot(root).render(app);
