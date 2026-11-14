import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { storeAboutPath, storePath } from "../lib/routes";
import { SITE } from "../lib/site";
import type { VendorStore } from "../types/store";
import { ThemeToggle } from "./ThemeToggle";
import { AtSign, Facebook, Ghost, Globe, Instagram, Linkedin, MessageCircle, Music2, Pin, X as XBrand, Youtube, type LucideIcon } from "lucide-react";
import { formatNaira } from "../lib/money";
import { whatsappLink, whatsappNumber } from "../lib/sales";
import { CartDrawer } from "./CartDrawer";
import { useCart } from "../storefront/CartContext";
import { StoreReportForm } from "./StoreReportForm";

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  Instagram, Facebook, TikTok: Music2, YouTube: Youtube, X: XBrand, Threads: AtSign,
  Snapchat: Ghost, Pinterest: Pin, LinkedIn: Linkedin, Other: Globe,
};

/** Vendor-branded chrome for storefront pages. The vendor's name leads; SellSharp is a quiet credit in the footer. */
export function StoreShell({ store, children }: { store: VendorStore; children: ReactNode }) {
  const cart = useCart();
  const showCartBar = cart.count(store.slug) > 0 && cart.openFor !== store.slug;
  const socialLinks = [
    ["Instagram", store.instagramUrl], ["Facebook", store.facebookUrl], ["TikTok", store.tiktokUrl],
    ["YouTube", store.youtubeUrl], ["X", store.xUrl], ["Threads", store.threadsUrl],
    ["Snapchat", store.snapchatUrl], ["Pinterest", store.pinterestUrl], ["LinkedIn", store.linkedinUrl],
    [store.otherSocialLabel || "Other", store.otherSocialUrl],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return (
    <div className={`sf${showCartBar ? " sf-has-cartbar" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {socialLinks.length > 0 && <div className="sf-social-strip"><div className="container sf-social-strip-inner"><span>Follow us</span><nav aria-label={`Follow ${store.name}`}>{socialLinks.map(([label, href]) => {
        const Icon = SOCIAL_ICONS[label] ?? Globe;
        return <a key={label} className="sf-social-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${store.name} on ${label}`} title={label}><Icon size={16} strokeWidth={2} aria-hidden="true" /></a>;
      })}</nav></div></div>}
      <header className="sf-header">
        <div className="container sf-header-inner">
          <Link to={storePath(store.slug)} className="sf-brand">
            {store.name}
          </Link>
          <nav className="sf-nav" aria-label="Store">
            <Link to={storePath(store.slug)}>Shop</Link>
            <Link to={storeAboutPath(store.slug)}>About</Link>
          </nav>
          <button type="button" className="sf-header-cart" onClick={() => cart.openCart(store.slug)} aria-label={`Open cart${cart.count(store.slug) ? `, ${cart.count(store.slug)} items` : ""}`}>
            Cart{cart.count(store.slug) > 0 && <span>{cart.count(store.slug)}</span>}
          </button>
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
            <a className="sf-footer-chat" href={whatsappLink(`Hello, I found your store on SellSharp and have a few enquiries.`, store.contactPhone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={15} aria-hidden="true" /> Chat with seller
            </a>
          )}
          {!store.isDemo && <StoreReportForm store={store} />}
          <Link to="/">Online store powered by {SITE.name}</Link>
        </div>
      </footer>
      {showCartBar && (
        <button type="button" className="sf-cartbar" onClick={() => cart.openCart(store.slug)}>
          <span>View cart · {cart.count(store.slug)} {cart.count(store.slug) === 1 ? "item" : "items"}</span>
          <span>{formatNaira(cart.total(store.slug))}</span>
        </button>
      )}
      <CartDrawer store={store} />
    </div>
  );
}
