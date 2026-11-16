import { Link } from "react-router-dom";
import { Seo } from "../../components/Seo";
import { AddToCartButton } from "../../components/AddToCartButton";
import { ShareButton } from "../../components/ShareButton";
import { StoreShell } from "../../components/StoreShell";
import { formatNaira } from "../../lib/money";
import { productPath, storePath, storeProductsPath } from "../../lib/routes";
import { buildProductSeo, storeLocation } from "../../lib/seo";
import type { Product, VendorStore } from "../../types/store";
import { ProductCard } from "./ProductCard";
import { ProductGallery } from "./ProductGallery";

export function ProductDetail({
  store,
  product,
  related,
}: {
  store: VendorStore;
  product: Product;
  related: Product[];
}) {
  return (
    <StoreShell store={store}>
      <Seo seo={buildProductSeo(store, product)} />
      <div className="container sf-product">
        <Link to={storePath(store.slug)} className="sf-product-back">← Back to {store.name}</Link>
        <nav aria-label="Breadcrumb" className="sf-crumbs">
          <Link to={storePath(store.slug)}>{store.name}</Link> <span aria-hidden="true">/</span>{" "}
          <Link to={storeProductsPath(store.slug)}>Products</Link> <span aria-hidden="true">/</span>{" "}
          <span>{product.name}</span>
        </nav>
        <div className="sf-product-layout">
          <ProductGallery images={product.images} name={product.name} isAvailable={product.isAvailable} />
          <div className="sf-product-info">
            <h1 className="sf-h1">{product.name}</h1>
            <p className="sf-price sf-price-large">{formatNaira(product.priceKobo)}</p>
            <p className="sf-vendor">
              Sold by <Link to={storePath(store.slug)}>{store.name}</Link> · {storeLocation(store)}
            </p>
            {product.description && <p className="sf-product-description">{product.description}</p>}
            {store.isDemo ? (
              <button className="btn btn-primary" type="button" disabled>
                Ordering is disabled on demo stores
              </button>
            ) : (
              <AddToCartButton storeSlug={store.slug} product={product} />
            )}
            <ShareButton
              path={productPath(store.slug, product.slug)}
              kind="product"
              title={`${product.name} – ${store.name}`}
              text={`${product.name} from ${store.name}`}
            />
          </div>
        </div>
        {related.length > 0 && (
          <section aria-labelledby="related-title" className="sf-related">
            <h2 id="related-title">More from {store.name}</h2>
            <ul className="sf-grid">
              {related.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} index={i} allowCart={!store.isDemo} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </StoreShell>
  );
}
