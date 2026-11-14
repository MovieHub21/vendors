import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { VendorPageLoading } from "../components/DashboardShell";

/** Route guard for the user experience only. Real protection is Row Level Security + the edge functions. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    if (location.pathname.startsWith("/dashboard")) {
      const title = location.pathname.startsWith("/dashboard/orders") ? "Orders"
        : location.pathname.startsWith("/dashboard/products") ? "Products"
          : location.pathname.startsWith("/dashboard/customers") ? "Customers"
            : location.pathname.startsWith("/dashboard/receipts") || location.pathname.startsWith("/dashboard/receipt/") ? "Receipts"
              : location.pathname.startsWith("/dashboard/invoice/") ? "Invoice"
                : location.pathname === "/dashboard/templates" ? "Receipt & invoice design"
              : location.pathname === "/dashboard/design" ? "Store design"
                : location.pathname === "/dashboard/seo" ? "Store SEO"
                    : location.pathname === "/dashboard/sale" ? "Record a sale"
                      : location.pathname === "/dashboard/export" ? "Export business data"
                        : location.pathname === "/dashboard/support" ? "Contact support"
                    : "Overview";
      return <VendorPageLoading title={title} path={location.pathname} />;
    }
    return (
      <div className="auth-loading" role="status">
        Loading your account…
      </div>
    );
  }
  if (status === "signedOut") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
