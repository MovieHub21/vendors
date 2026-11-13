import { Link } from "react-router-dom";
import { Seo } from "../../components/Seo";
import { StoreShell } from "../../components/StoreShell";
import { directoryPath, storePath } from "../../lib/routes";
import { buildStoreAboutSeo } from "../../lib/seo";
import type { VendorStore } from "../../types/store";

export function StoreAbout({ store }: { store: VendorStore }) {
  return (
    <StoreShell store={store}>
      <Seo seo={buildStoreAboutSeo(store)} />
      <div className="container sf-product sf-about-page">
        <nav aria-label="Breadcrumb" className="sf-crumbs">
          <Link to={storePath(store.slug)}>{store.name}</Link> <span aria-hidden="true">/</span> <span>About</span>
        </nav>
        <article className="sf-about-card">
          <span className="sf-section-eyebrow">About the store</span>
          <h1 className="sf-h1">{store.name}</h1>
          <p className="sf-about-description">{store.description}</p>
          <p className="sf-about-facts">
          Category: <Link to={directoryPath(store.categorySlug)}>{store.category}</Link>
          {store.state && store.stateSlug && (
            <>
              {" · "}Location:{" "}
              <Link to={directoryPath(store.stateSlug)}>{[store.city, store.state].filter(Boolean).join(", ")}</Link>
            </>
          )}
          </p>
          <Link className="btn btn-primary" to={storePath(store.slug)}>View products</Link>
        </article>
      </div>
    </StoreShell>
  );
}
