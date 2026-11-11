import { Link, useParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { StoreShell } from "../components/StoreShell";
import { MarketingShell } from "../layouts/MarketingLayout";
import { formatNaira } from "../lib/money";
import { productPath } from "../lib/routes";
import { buildStoreSeo } from "../lib/seo";
import { getProductsForStore, getStoreBySlug } from "../services/stores";
import NotFound from "./NotFound";

export default function Storefront() {
  const { storeSlug = "" } = useParams();
  const store = getStoreBySlug(storeSlug);

  if (!store) {
    return (
      <MarketingShell>
        <NotFound />
      </MarketingShell>
    );
  }

  const products = getProductsForStore(store.id);
  const place = [store.city, store.state].filter(Boolean).join(", ");

  return (
    <StoreShell store={store}>
      <Seo seo={buildStoreSeo(store, products)} />
      <section className="sf-hero">
        <div className="container">
          <span className="eyebrow">{[store.category, place].filter(Boolean).join(" · ").toUpperCase()}</span>
          <h1>{store.name}</h1>
          <p>{store.description}</p>
        </div>
      </section>
      <section className="container sf-products" aria-labelledby="sf-products-title">
        <h2 id="sf-products-title">Products</h2>
        {products.length === 0 ? (
          <p className="sf-empty">This store hasn't added products yet.</p>
        ) : (
          <ul className="sf-grid">
            {products.map((p, i) => (
              <li key={p.id}>
                <Link to={productPath(store.slug, p.slug)} className="sf-card">
                  <span className={`sf-img sf-img-${i % 3}`} aria-hidden="true" />
                  <h3>{p.name}</h3>
                  <span className="sf-price">{formatNaira(p.priceKobo)}</span>
                  {!p.isAvailable && <span className="sf-soldout">Sold out</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StoreShell>
  );
}
