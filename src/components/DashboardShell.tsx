import type { ReactNode } from "react";
import { Navigate, NavLink, useNavigate } from "react-router-dom";
import { Alert } from "./AuthLayout";
import { Seo } from "./Seo";
import type { PageSeo } from "../lib/seo";
import { useVendor } from "../hooks/useVendor";
import type { Me } from "../services/api";
import { signOut } from "../services/auth";
import { ORDER_STATUSES, PAYMENT_STATUS_LABEL, type PaymentStatus } from "../lib/sales";

const NAV = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/sale", label: "Record sale" },
  { to: "/dashboard/orders", label: "Orders" },
  { to: "/dashboard/customers", label: "Customers" },
  { to: "/dashboard/products", label: "Products" },
  { to: "/dashboard/seo", label: "Store SEO" },
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
  if (me && me.next_step !== "done") return <Navigate to="/onboarding" replace />;
  return (
    <>
      <Seo seo={{ ...seo, noindex: true }} />
      <section className="dash-page">
        <div className="container">
          <nav className="dash-nav" aria-label="Dashboard">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
                {n.label}
              </NavLink>
            ))}
            <button
              type="button"
              className="dash-logout"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              Log out
            </button>
          </nav>
          <header className="dash-head">
            <h1>{title}</h1>
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
