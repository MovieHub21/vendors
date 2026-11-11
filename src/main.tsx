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
    </HelmetProvider>
  </StrictMode>
);

// Prerendered pages (see scripts/prerender.mjs) already contain HTML; adopt it instead of rebuilding it.
if (root.hasAttribute("data-ssr")) hydrateRoot(root, app);
else createRoot(root).render(app);
