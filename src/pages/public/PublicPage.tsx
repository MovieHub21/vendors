import { useContext, useEffect, useState, type CSSProperties } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getClientApi } from "../../data/clientApi";
import { MarketingShell } from "../../layouts/MarketingLayout";
import { loadPageData, matchPublicRoute, type LoadResult, type PageData, type PublicRoute } from "../../ssr/pageData";
import { PreloadedPageContext } from "../../ssr/PreloadedPage";
import NotFound from "../NotFound";
import { Directory } from "./Directory";
import { ProductDetail } from "./ProductDetail";
import { StoreAbout } from "./StoreAbout";
import { StoreHome } from "./StoreHome";
import { StoreProducts } from "./StoreProducts";

function View({ data }: { data: PageData }) {
  switch (data.kind) {
    case "store":
      return <StoreHome store={data.store} products={data.products} />;
    case "storeProducts":
      return <StoreProducts store={data.store} products={data.products} />;
    case "storeAbout":
      return <StoreAbout store={data.store} />;
    case "product":
      return <ProductDetail store={data.store} product={data.product} related={data.related} />;
    case "directory":
      return (
        <MarketingShell>
          <Directory
            scope={data.scope}
            stores={data.stores}
            facets={data.facets}
            q={data.q}
            indexable={data.indexable}
          />
        </MarketingShell>
      );
    case "notFound":
      return (
        <MarketingShell>
          <NotFound />
        </MarketingShell>
      );
  }
}

function Pulse({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span className={`page-skeleton-pulse${className ? ` ${className}` : ""}`} style={style} aria-hidden="true" />;
}

function StorefrontLoading({ route }: { route: PublicRoute }) {
  const directory = route.route === "directory";
  const productsOnly = route.route === "storeProducts";
  const about = route.route === "storeAbout";
  const product = route.route === "product";
  return (
    <div className="sf sf-loading" role="status" aria-label="Loading store">
      <span className="sr-only">Loading store details…</span>
      <header className="sf-header">
        <div className="container sf-header-inner">
          <Pulse style={{ width: 142, height: 22 }} />
          <div className="sf-loading-nav"><Pulse style={{ width: 42, height: 12 }} /><Pulse style={{ width: 62, height: 12 }} /><Pulse style={{ width: 42, height: 12 }} /></div>
          <Pulse style={{ width: 34, height: 34, borderRadius: 99 }} />
        </div>
      </header>
      <main className="sf-loading-main">
        {directory ? (
          <div className="container sf-products">
            <Pulse style={{ width: 200, height: 12, marginBottom: 16 }} /><Pulse style={{ width: 300, height: 34, marginBottom: 28 }} />
            <div className="sf-loading-grid">{Array.from({ length: 8 }, (_, i) => <div className="sf-loading-store-card" key={i}><Pulse className="sf-loading-store-thumb" /><Pulse style={{ width: "68%", height: 14 }} /><Pulse style={{ width: "44%", height: 11 }} /></div>)}</div>
          </div>
        ) : product ? (
          <div className="container sf-product">
            <Pulse style={{ width: 240, height: 12, marginBottom: 24 }} />
            <div className="sf-product-layout"><Pulse className="sf-loading-product-image" /><div className="sf-product-info"><Pulse style={{ width: "84%", height: 30 }} /><Pulse style={{ width: "42%", height: 24, marginTop: 20 }} /><Pulse style={{ width: "58%", height: 12, marginTop: 18 }} /><Pulse style={{ width: "100%", height: 12, marginTop: 26 }} /><Pulse style={{ width: "92%", height: 12, marginTop: 9 }} /><Pulse style={{ width: "100%", height: 46, marginTop: 28, borderRadius: 9 }} /></div></div>
          </div>
        ) : about ? (
          <div className="container sf-about-page"><Pulse style={{ width: "100%", height: 190, borderRadius: 18 }} /><Pulse style={{ width: 220, height: 28, margin: "28px 0 16px" }} /><Pulse style={{ width: "90%", height: 13, marginBottom: 10 }} /><Pulse style={{ width: "78%", height: 13 }} /></div>
        ) : (
          <>
            {!productsOnly && <section className="sf-store-hero"><Pulse className="sf-loading-banner" /><div className="container sf-profile-wrap"><div className="sf-profile-card"><Pulse className="sf-loading-logo" /><div className="sf-profile-copy"><Pulse style={{ width: 168, height: 11, marginBottom: 15 }} /><Pulse style={{ width: 310, height: 32, marginBottom: 12 }} /><Pulse style={{ width: "85%", height: 13, marginBottom: 8 }} /><Pulse style={{ width: "66%", height: 13 }} /></div></div></div></section>}
            <section className="container sf-products"><div className="sf-section-heading"><div><Pulse style={{ width: 90, height: 10, marginBottom: 12 }} /><Pulse style={{ width: 230, height: 26, marginBottom: 10 }} /><Pulse style={{ width: 200, height: 12 }} /></div></div><div className="sf-loading-grid">{Array.from({ length: 8 }, (_, i) => <div className="sf-loading-product-card" key={i}><Pulse className="sf-loading-product-thumb" /><Pulse style={{ width: "74%", height: 13, margin: "14px 3px 8px" }} /><Pulse style={{ width: "42%", height: 12, margin: "0 3px" }} /></div>)}</div></section>
          </>
        )}
      </main>
      <footer className="sf-footer"><div className="container sf-footer-inner"><Pulse style={{ width: 120, height: 12 }} /><span>Online store powered by SellSharp</span></div></footer>
    </div>
  );
}

/**
 * One component behind every dynamic public URL (/{store}, /{store}/products, /{store}/products/{product}, /stores…).
 * On first load the server has already rendered it and passed the data in; on in-app navigation it loads the data itself.
 */
export default function PublicPage() {
  const { pathname, search } = useLocation();
  const preloaded = useContext(PreloadedPageContext);
  const key = pathname + search;
  const initial = preloaded && preloaded.path + preloaded.search === key ? preloaded.data : null;
  const [loaded, setLoaded] = useState<{ key: string; result: LoadResult } | null>(null);

  useEffect(() => {
    if (initial) return;
    const match = matchPublicRoute(pathname);
    if (!match) return;
    let cancelled = false;
    loadPageData(match, search, getClientApi())
      .then((result) => !cancelled && setLoaded({ key, result }))
      .catch(() => !cancelled && setLoaded({ key, result: { status: 404, data: { kind: "notFound" } } }));
    return () => {
      cancelled = true;
    };
  }, [initial, key, pathname, search]);

  if (initial) return <View data={initial} />;
  if (!matchPublicRoute(pathname)) return <View data={{ kind: "notFound" }} />;
  if (loaded?.key !== key) {
    const route = matchPublicRoute(pathname);
    return route ? <StorefrontLoading route={route} /> : null;
  }
  if (loaded.result.status === 301) return <Navigate to={loaded.result.redirect} replace />;
  return <View data={loaded.result.data} />;
}
