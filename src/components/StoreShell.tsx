import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { storeAboutPath, storePath, storeProductsPath } from "../lib/routes";
import { SITE } from "../lib/site";
import type { VendorStore } from "../types/store";
import { ThemeToggle } from "./ThemeToggle";
import { MessageCircle } from "lucide-react";
import { whatsappLink, whatsappNumber } from "../lib/sales";
import { CartDrawer } from "./CartDrawer";
import { useCart } from "../storefront/CartContext";

/** Vendor-branded chrome for storefront pages. The vendor's name leads; SellSharp is a quiet credit in the footer. */
export function StoreShell({ store, children }: { store: VendorStore; children: ReactNode }) {
  const cart = useCart();
  const socialLinks = [
    ["Instagram", store.instagramUrl], ["Facebook", store.facebookUrl], ["TikTok", store.tiktokUrl],
    ["YouTube", store.youtubeUrl], ["X", store.xUrl], ["Threads", store.threadsUrl],
    ["Snapchat", store.snapchatUrl], ["Pinterest", store.pinterestUrl], ["LinkedIn", store.linkedinUrl],
    [store.otherSocialLabel || "Other", store.otherSocialUrl],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return (
    <div className="sf">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {socialLinks.length > 0 && <div className="sf-social-strip"><div className="container sf-social-strip-inner"><span>Follow us</span><nav aria-label={`Follow ${store.name}`}>{socialLinks.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}</nav></div></div>}
      <header className="sf-header">
        <div className="container sf-header-inner">
          <Link to={storePath(store.slug)} className="sf-brand">
            {store.name}
          </Link>
          <nav className="sf-nav" aria-label="Store">
            <Link to={storePath(store.slug)}>Shop</Link>
            <Link to={storeProductsPath(store.slug)}>Products</Link>
            <Link to={storeAboutPath(store.slug)}>About</Link>
          </nav>
          <button className="sf-cart-button" type="button" onClick={() => cart.openCart(store.slug)}>Cart{cart.count(store.slug) > 0 ? ` · ${cart.count(store.slug)}` : ""}</button>
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
          {whatsappNumber(store.contactPhone) && (
            <a className="sf-footer-chat" href={whatsappLink(`Hello ${store.name}, I have a question about your store.`, store.contactPhone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={15} aria-hidden="true" /> Chat with seller
            </a>
          )}
          <Link to="/">Online store powered by {SITE.name}</Link>
        </div>
      </footer>
      <CartDrawer store={store} />
    </div>
  );
}
