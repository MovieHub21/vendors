import { Link } from "react-router-dom";
import { ResponsiveImage } from "../../components/ResponsiveImage";
import { Seo } from "../../components/Seo";
import { ShareButton } from "../../components/ShareButton";
import { StoreShell } from "../../components/StoreShell";
import { directoryPath, storeAboutPath, storePath, storeProductsPath } from "../../lib/routes";
import { buildStoreSeo, storeLocation } from "../../lib/seo";
import type { Product, VendorStore } from "../../types/store";
import { ProductCard } from "./ProductCard";

export function StoreHome({ store, products }: { store: VendorStore; products: Product[] }) {
  const place = [store.city, store.state].filter(Boolean).join(", ");
  return (
    <StoreShell store={store}>
      <Seo seo={buildStoreSeo(store, products)} />
      <section className="sf-hero">
        <div className="container sf-hero-inner">
          {store.logoUrl && (
            <ResponsiveImage
              src={store.logoUrl}
              alt={`${store.name} logo`}
              width={160}
              height={160}
              priority
              className="sf-logo"
            />
          )}
          <div>
            <span className="eyebrow">
              <Link to={directoryPath(store.categorySlug)}>{store.category.toUpperCase()}</Link>
              {place && (
                <>
                  {" "}
                  ·{" "}
                  {store.stateSlug ? (
                    <Link to={directoryPath(store.stateSlug)}>{place.toUpperCase()}</Link>
                  ) : (
                    place.toUpperCase()
                  )}
                </>
              )}
            </span>
            <h1>{store.name}</h1>
            {store.tagline && <p className="sf-tagline">{store.tagline}</p>}
            <p>{store.description}</p>
            <ShareButton
              path={storePath(store.slug)}
              kind="store"
              title={store.name}
              text={`Shop ${store.category.toLowerCase()} from ${store.name} in ${storeLocation(store)}.`}
            />
          </div>
        </div>
        {store.coverUrl && (
          <div className="container sf-cover">
            <ResponsiveImage
              src={store.coverUrl}
              alt={`${store.name} banner`}
              width={1200}
              height={400}
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          </div>
        )}
      </section>
      <section className="container sf-products" aria-labelledby="sf-products-title">
        <h2 id="sf-products-title">Products</h2>
        {products.length === 0 ? (
          <p className="sf-empty">This store hasn't added products yet.</p>
        ) : (
          <ul className="sf-grid">
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} index={i} />
              </li>
            ))}
          </ul>
        )}
        <p className="sf-more">
          {store.productCount > products.length && (
            <Link to={storeProductsPath(store.slug)}>View all {store.productCount} products →</Link>
          )}{" "}
          <Link to={storeAboutPath(store.slug)}>About {store.name}</Link>
        </p>
      </section>
    </StoreShell>
  );
}
