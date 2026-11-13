import type { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}

export default function MarketingLayout() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/dashboard")) return <Outlet />;
  return (
    <MarketingShell>
      <Outlet />
    </MarketingShell>
  );
}
