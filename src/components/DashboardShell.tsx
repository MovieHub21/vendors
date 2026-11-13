import type { CSSProperties, ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FileDown, LayoutDashboard, LayoutTemplate, LogOut, Package, Plus, Receipt, Search, ShoppingBag, Store, Users, Wallet, ClipboardList, type LucideIcon } from "lucide-react";
import { Alert } from "./AuthLayout";
import { Seo } from "./Seo";
import type { PageSeo } from "../lib/seo";
import { useVendor } from "../hooks/useVendor";
import type { Me } from "../services/api";
import { signOut } from "../services/auth";
import { ORDER_STATUSES, PAYMENT_STATUS_LABEL, type PaymentStatus } from "../lib/sales";
import { ThemeToggle } from "./ThemeToggle";
import { storePath } from "../lib/routes";
import { PwaInstallPrompt } from "./PwaInstallPrompt";

function SkeletonPulse({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span className={`page-skeleton-pulse${className ? ` ${className}` : ""}`} style={style} aria-hidden="true" />;
}

export function VendorPageLoading({ title, path }: { title: string; path: string }) {
  const overview = path === "/dashboard";
  const products = path === "/dashboard/products";
  const formPage = path === "/dashboard/design" || path === "/dashboard/seo";
  return (
    <section className="vendor-app vendor-app-loading" role="status" aria-label={`Loading ${title.toLowerCase()}`}>
      <span className="sr-only">Loading {title.toLowerCase()}…</span>
      <header className="vendor-topbar"><div className="vendor-topbar-inner"><span className="vendor-brand"><span className="vendor-brand-mark"><ShoppingBag size={17} aria-hidden="true" /></span><span>Sell<span>Sharp</span></span></span><div className="vendor-topbar-tools"><SkeletonPulse style={{ width: 76, height: 12 }} /><SkeletonPulse style={{ width: 32, height: 32, borderRadius: 99 }} /></div></div></header>
      <div className="vendor-layout">
        <aside className="vendor-sidebar vendor-sidebar-loading" aria-hidden="true"><SkeletonPulse style={{ width: 66, height: 9, margin: "3px 10px 8px" }} />{Array.from({ length: 6 }, (_, i) => <SkeletonPulse className="vendor-nav-skeleton" key={i} style={{ width: i === 1 ? "84%" : "72%" }} />)}<SkeletonPulse style={{ width: 54, height: 9, margin: "18px 10px 8px" }} />{Array.from({ length: 3 }, (_, i) => <SkeletonPulse className="vendor-nav-skeleton" key={`store-${i}`} style={{ width: "76%" }} />)}</aside>
        <main className="vendor-main"><div className="vendor-main-inner">
          <header className="dash-head"><div><p className="vendor-page-eyebrow">Workspace</p><h1>{title}</h1></div><SkeletonPulse style={{ width: 114, height: 38, borderRadius: 9 }} /></header>
          {overview ? <>
            <div className="stat-grid-dash">{Array.from({ length: 4 }, (_, i) => <div className="dash-card" key={i}><SkeletonPulse style={{ width: "54%", height: 11, marginBottom: 15 }} /><SkeletonPulse style={{ width: "72%", height: 25 }} /><SkeletonPulse style={{ width: "44%", height: 10, marginTop: 16 }} /></div>)}</div>
            <div className="vendor-loading-panels"><div className="dash-card"><SkeletonPulse style={{ width: "42%", height: 16, marginBottom: 22 }} /><SkeletonPulse className="vendor-loading-chart" /></div><div className="dash-card"><SkeletonPulse style={{ width: "45%", height: 16, marginBottom: 20 }} />{Array.from({ length: 4 }, (_, i) => <SkeletonPulse className="vendor-loading-row" key={i} />)}</div></div>
          </> : products ? <div className="vendor-loading-products">{Array.from({ length: 6 }, (_, i) => <div className="dash-card" key={i}><SkeletonPulse className="vendor-loading-product-image" /><SkeletonPulse style={{ width: "70%", height: 14, margin: "14px 0 8px" }} /><SkeletonPulse style={{ width: "44%", height: 11 }} /></div>)}</div> : formPage ? <div className="dash-card vendor-loading-form">{Array.from({ length: 5 }, (_, i) => <div key={i}><SkeletonPulse style={{ width: 140, height: 11, marginBottom: 8 }} /><SkeletonPulse style={{ width: "100%", height: i === 2 ? 96 : 40, marginBottom: 20, borderRadius: 8 }} /></div>)}</div> : <div className="dash-card vendor-loading-table"><SkeletonPulse style={{ width: 184, height: 16, marginBottom: 20 }} />{Array.from({ length: 7 }, (_, i) => <SkeletonPulse className="vendor-loading-row" key={i} />)}</div>}
        </div></main>
      </div>
    </section>
  );
}

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: LucideIcon; search?: string }[] }[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/dashboard/orders", label: "Orders", icon: ClipboardList },
      { to: "/dashboard/products", label: "Products", icon: Package },
      { to: "/dashboard/customers", label: "Customers", icon: Users },
      { to: "/dashboard/customers?owing=1", label: "Debts", icon: Wallet, search: "owing=1" },
      { to: "/dashboard/receipts", label: "Receipts", icon: Receipt },
      { to: "/dashboard/export", label: "Export data", icon: FileDown },
    ],
  },
  {
    label: "Store",
    items: [
      { to: "store", label: "My storefront", icon: Store },
      { to: "/dashboard/design", label: "Store design", icon: LayoutTemplate },
      { to: "/dashboard/seo", label: "Store SEO", icon: Search },
    ],
  },
];

/** Page frame for every signed-in vendor screen: navigation, loading and error states, and the subscription rule. */
export function DashboardShell({
  seo,
  title,
  actions,
  children,
}: {
  seo: PageSeo;
  title: string;
  actions?: ReactNode;
  children: (me: Me) => ReactNode;
}) {
  const { me, error } = useVendor();
  const navigate = useNavigate();
  const location = useLocation();
  if (me && me.next_step !== "done") return <Navigate to="/onboarding" replace />;
  const name = me?.profile?.full_name?.trim() || me?.user.email || "Vendor";
  const initials = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "V";
  const storeIsLive = Boolean(me?.store?.is_published && me.store.status === "active");
  if (!me && !error) return <VendorPageLoading title={title} path={location.pathname} />;
  return (
    <>
      <Seo seo={{ ...seo, noindex: true }} />
      <section className="vendor-app">
        {me && <PwaInstallPrompt />}
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="vendor-topbar">
          <div className="vendor-topbar-inner">
            <Link to="/dashboard" className="vendor-brand" aria-label="SellSharp dashboard">
              <span className="vendor-brand-mark"><ShoppingBag size={17} aria-hidden="true" /></span>
              <span>Sell<span>Sharp</span></span>
            </Link>
            <div className="vendor-topbar-tools">
              {me?.store && (
                <span className={`vendor-live-status${storeIsLive ? " is-live" : ""}`}>
                  <i aria-hidden="true" /> {storeIsLive ? "Store is live" : "Store is not live"}
                </span>
              )}
              <ThemeToggle />
              <span className="vendor-avatar" aria-label={name} title={name}>{initials}</span>
            </div>
          </div>
        </header>
        <div className="vendor-layout">
          <aside className="vendor-sidebar">
            <nav className="vendor-sidebar-nav" aria-label="Vendor workspace">
              {NAV_GROUPS.map((group) => (
                <div className="vendor-nav-group" key={group.label}>
                  <p className="vendor-nav-heading">{group.label}</p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    if (item.to === "store") {
                      return me?.store ? (
                        <Link key={item.label} className="vendor-nav-link" to={storePath(me.store.slug)}>
                          <Icon size={16} aria-hidden="true" /> <span>{item.label}</span>
                        </Link>
                      ) : null;
                    }
                    const itemPath = item.to.split("?")[0];
                    const active =
                      (location.pathname === itemPath ||
                        (item.label === "Receipts" && location.pathname.startsWith("/dashboard/receipt/"))) &&
                      (item.search ? location.search.includes(item.search) : item.to !== "/dashboard/customers" || !location.search.includes("owing=1"));
                    return (
                      <Link key={item.label} to={item.to} aria-current={active ? "page" : undefined} className={`vendor-nav-link${active ? " active" : ""}`}>
                        <Icon size={16} aria-hidden="true" /> <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
              <Link className={`vendor-record-sale${location.pathname === "/dashboard/sale" ? " active" : ""}`} to="/dashboard/sale">
                <Plus size={16} aria-hidden="true" /> Record a sale
              </Link>
            </nav>
            <button
              type="button"
              className="vendor-logout"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut size={16} aria-hidden="true" /> Log out
            </button>
          </aside>
          <main className="vendor-main" id="main">
            <div className="vendor-main-inner">
              <header className="dash-head">
                <div>
                  <p className="vendor-page-eyebrow">Workspace</p>
                  <h1>{title}</h1>
                </div>
                {actions && <div className="dash-actions">{actions}</div>}
              </header>
          {error && <Alert kind="error">{error}</Alert>}
          {!me && !error && (
            <p className="auth-loading" role="status">
              Loading…
            </p>
          )}
          {me && children(me)}
            </div>
          </main>
        </div>
      </section>
    </>
  );
}

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`badge badge-${status}`}>{ORDER_STATUSES.find((s) => s.value === status)?.label ?? status}</span>
);
export const PayBadge = ({ status }: { status: PaymentStatus }) => (
  <span className={`badge badge-pay-${status}`}>{PAYMENT_STATUS_LABEL[status]}</span>
);

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const dateOnly = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
