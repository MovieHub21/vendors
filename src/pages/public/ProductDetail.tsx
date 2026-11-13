import { Link } from "react-router-dom";
import { ResponsiveImage } from "../../components/ResponsiveImage";
import { Seo } from "../../components/Seo";
import { ProductOrderForm } from "../../components/ProductOrderForm";
import { ShareButton } from "../../components/ShareButton";
import { StoreShell } from "../../components/StoreShell";
import { formatNaira } from "../../lib/money";
import { directoryPath, productPath, storePath, storeProductsPath } from "../../lib/routes";
import { buildProductSeo, storeLocation } from "../../lib/seo";
import type { Product, VendorStore } from "../../types/store";
import { ProductCard } from "./ProductCard";

export function ProductDetail({
  store,
  product,
  related,
}: {
  store: VendorStore;
  product: Product;
  related: Product[];
}) {
  const [main, ...rest] = product.images;
  return (
    <StoreShell store={store}>
      <Seo seo={buildProductSeo(store, product)} />
      <div className="container sf-product">
        <nav aria-label="Breadcrumb" className="sf-crumbs">
          <Link to={storePath(store.slug)}>{store.name}</Link> <span aria-hidden="true">/</span>{" "}
          <Link to={storeProductsPath(store.slug)}>Products</Link> <span aria-hidden="true">/</span>{" "}
          <span>{product.name}</span>
        </nav>
        <div className="sf-product-layout">
          <div className="sf-gallery">
            {main ? (
              <ResponsiveImage
                src={main.url}
                alt={main.alt || product.name}
                width={main.width}
                height={main.height}
                priority
                sizes="(max-width: 760px) 100vw, 50vw"
              />
            ) : (
              <span className="sf-img sf-img-0 sf-img-large" aria-hidden="true" />
            )}
            {rest.length > 0 && (
              <ul className="sf-thumbs">
                {rest.map((img, i) => (
                  <li key={img.url}>
                    <ResponsiveImage
                      src={img.url}
                      alt={img.alt || `${product.name} – photo ${i + 2}`}
                      width={img.width}
                      height={img.height}
                      sizes="120px"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h1 className="sf-h1">{product.name}</h1>
            <p className="sf-price sf-price-large">{formatNaira(product.priceKobo)}</p>
            <p className={product.isAvailable ? "sf-stock" : "sf-soldout"}>
              {product.isAvailable ? "In stock" : "Out of stock"}
            </p>
            <p className="sf-vendor">
              Sold by <Link to={storePath(store.slug)}>{store.name}</Link> · {storeLocation(store)}
            </p>
            {product.description.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            {store.isDemo ? (
              <button className="btn btn-primary" type="button" disabled>
                Ordering is disabled on demo stores
              </button>
            ) : (
              <ProductOrderForm
                storeSlug={store.slug}
                storeName={store.name}
                productId={product.id}
                productName={product.name}
                priceKobo={product.priceKobo}
                available={product.isAvailable}
              />
            )}
            <ShareButton
              path={productPath(store.slug, product.slug)}
              kind="product"
              title={`${product.name} – ${store.name}`}
              text={`${product.name} from ${store.name}`}
            />
            <p className="sf-more">
              <Link to={storePath(store.slug)}>← Back to {store.name}</Link> ·{" "}
              <Link to={directoryPath(store.categorySlug)}>More {store.category.toLowerCase()} stores</Link>
            </p>
          </div>
        </div>
        {related.length > 0 && (
          <section aria-labelledby="related-title" className="sf-related">
            <h2 id="related-title">More from {store.name}</h2>
            <ul className="sf-grid">
              {related.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} index={i} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </StoreShell>
  );
}
