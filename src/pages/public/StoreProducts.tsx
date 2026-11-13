import { Link } from "react-router-dom";
import { Seo } from "../../components/Seo";
import { StoreShell } from "../../components/StoreShell";
import { storePath } from "../../lib/routes";
import { buildStoreProductsSeo } from "../../lib/seo";
import type { Product, VendorStore } from "../../types/store";
import { ProductCard } from "./ProductCard";

export function StoreProducts({ store, products }: { store: VendorStore; products: Product[] }) {
  return (
    <StoreShell store={store}>
      <Seo seo={buildStoreProductsSeo(store)} />
      <div className="container sf-products sf-products-page">
        <nav aria-label="Breadcrumb" className="sf-crumbs">
          <Link to={storePath(store.slug)}>{store.name}</Link> <span aria-hidden="true">/</span> <span>Products</span>
        </nav>
        <div className="sf-section-heading sf-products-page-heading">
          <div>
            <span className="sf-section-eyebrow">Browse the store</span>
            <h1 className="sf-h1">Products from {store.name}</h1>
            <p>Find something you’ll love from this collection.</p>
          </div>
          <span className="sf-product-count">{products.length} {products.length === 1 ? "item" : "items"}</span>
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
      </div>
    </StoreShell>
  );
}
