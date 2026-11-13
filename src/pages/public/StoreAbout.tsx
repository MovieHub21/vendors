import { Link } from "react-router-dom";
import { Seo } from "../../components/Seo";
import { StoreShell } from "../../components/StoreShell";
import { directoryPath, storePath, storeProductsPath } from "../../lib/routes";
import { buildStoreAboutSeo } from "../../lib/seo";
import type { VendorStore } from "../../types/store";

export function StoreAbout({ store }: { store: VendorStore }) {
  return (
    <StoreShell store={store}>
      <Seo seo={buildStoreAboutSeo(store)} />
      <div className="container sf-product">
        <nav aria-label="Breadcrumb" className="sf-crumbs">
          <Link to={storePath(store.slug)}>{store.name}</Link> <span aria-hidden="true">/</span> <span>About</span>
        </nav>
        <h1 className="sf-h1">About {store.name}</h1>
        <p>{store.description}</p>
        <p>
          Category: <Link to={directoryPath(store.categorySlug)}>{store.category}</Link>
          {store.state && store.stateSlug && (
            <>
              {" · "}Location:{" "}
              <Link to={directoryPath(store.stateSlug)}>{[store.city, store.state].filter(Boolean).join(", ")}</Link>
            </>
          )}
        </p>
        <p>
          <Link to={storeProductsPath(store.slug)}>Browse all products</Link>
        </p>
      </div>
    </StoreShell>
  );
}
