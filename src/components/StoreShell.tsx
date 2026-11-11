import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { storePath } from "../lib/routes";
import { SITE } from "../lib/site";
import type { VendorStore } from "../types/store";
import { ThemeToggle } from "./ThemeToggle";

/** Vendor-branded chrome for storefront pages. The vendor's name leads; SellSharp is a quiet credit in the footer. */
export function StoreShell({ store, children }: { store: VendorStore; children: ReactNode }) {
  return (
    <div className="sf">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="sf-header">
        <div className="container sf-header-inner">
          <Link to={storePath(store.slug)} className="sf-brand">
            {store.name}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main">
        {store.isDemo && (
          <p className="sf-demo" role="note">
            Demo store with sample products. Real vendor stores launch with Phase 4.
          </p>
        )}
        {children}
      </main>
      <footer className="sf-footer">
        <div className="container sf-footer-inner">
          <span>
            © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {store.name}
          </span>
          <Link to="/">Online store powered by {SITE.name}</Link>
        </div>
      </footer>
    </div>
  );
}
