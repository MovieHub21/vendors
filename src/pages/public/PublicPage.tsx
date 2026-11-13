import { useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getClientApi } from "../../data/clientApi";
import { MarketingShell } from "../../layouts/MarketingLayout";
import { loadPageData, matchPublicRoute, type LoadResult, type PageData } from "../../ssr/pageData";
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
    return (
      <MarketingShell>
        <div className="auth-loading" role="status">
          Loading…
        </div>
      </MarketingShell>
    );
  }
  if (loaded.result.status === 301) return <Navigate to={loaded.result.redirect} replace />;
  return <View data={loaded.result.data} />;
}
