import { Link } from "react-router-dom";
import { ResponsiveImage } from "../../components/ResponsiveImage";
import { Seo } from "../../components/Seo";
import { ShareButton } from "../../components/ShareButton";
import { StoreShell } from "../../components/StoreShell";
import { directoryPath, storePath, storeProductsPath } from "../../lib/routes";
import { buildStoreSeo, storeLocation } from "../../lib/seo";
import type { Product, VendorStore } from "../../types/store";
import { ProductCard } from "./ProductCard";
import { ShowcaseStoreHome } from "./ShowcaseStoreHome";

export function StoreHome({ store, products, preview = false }: { store: VendorStore; products: Product[]; preview?: boolean }) {
  if (store.storefrontLayout === "showcase") return <ShowcaseStoreHome store={store} products={products} includeSeo={!preview} />;
  const place = [store.city, store.state].filter(Boolean).join(", ");
  return (
    <StoreShell store={store}>
      {!preview && <Seo seo={buildStoreSeo(store, products)} />}
      <section className={`sf-store-hero sf-layout-${store.storefrontLayout ?? "showcase"}`}>
        <div className="sf-store-banner">
          {store.coverUrl ? (
            <ResponsiveImage
              src={store.coverUrl}
              alt={`${store.name} banner`}
              width={1600}
              height={560}
              priority
              sizes="100vw"
              className="sf-store-banner-image"
            />
          ) : <div className="sf-store-banner-fallback" />}
          <div className="sf-store-banner-shade" />
        </div>
        <div className="container sf-profile-wrap">
          <div className="sf-profile-card">
            {store.logoUrl ? (
              <ResponsiveImage
                src={store.logoUrl}
                alt={`${store.name} logo`}
                width={160}
                height={160}
                priority
                className="sf-logo"
              />
            ) : <span className="sf-logo sf-logo-placeholder" aria-hidden="true">{store.name.slice(0, 1).toUpperCase()}</span>}
            <div className="sf-profile-copy">
              <span className="sf-store-kicker">
                <Link to={directoryPath(store.categorySlug)}>{store.category}</Link>
                {place && <><span aria-hidden="true">·</span>{store.stateSlug ? <Link to={directoryPath(store.stateSlug)}>{place}</Link> : place}</>}
              </span>
              <h1>{store.name}</h1>
              {store.tagline && <p className="sf-tagline">{store.tagline}</p>}
              <p className="sf-store-description">{store.description}</p>
              <div className="sf-store-actions">
                <ShareButton
                  path={storePath(store.slug)}
                  kind="store"
                  title={store.name}
                  text={`Shop ${store.category.toLowerCase()} from ${store.name} in ${storeLocation(store)}.`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="container sf-products" aria-labelledby="sf-products-title">
        <div className="sf-section-heading">
          <div>
            <span className="sf-section-eyebrow">The collection</span>
            <h2 id="sf-products-title">Shop the collection</h2>
            <p>Thoughtfully selected by {store.name}.</p>
          </div>
          {store.productCount > products.length && <Link className="sf-view-all" to={storeProductsPath(store.slug)}>View all products <span aria-hidden="true">→</span></Link>}
        </div>
        {products.length === 0 ? (
          <p className="sf-empty">This store hasn't added products yet.</p>
        ) : (
          <ul className="sf-grid">
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} index={i} allowCart={!store.isDemo} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </StoreShell>
  );
}
