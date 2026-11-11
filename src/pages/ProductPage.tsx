import { Link, useParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { StoreShell } from "../components/StoreShell";
import { MarketingShell } from "../layouts/MarketingLayout";
import { formatNaira } from "../lib/money";
import { storePath } from "../lib/routes";
import { buildProductSeo } from "../lib/seo";
import { getProduct } from "../services/stores";
import NotFound from "./NotFound";

export default function ProductPage() {
  const { storeSlug = "", productSlug = "" } = useParams();
  const found = getProduct(storeSlug, productSlug);

  if (!found) {
    return (
      <MarketingShell>
        <NotFound />
      </MarketingShell>
    );
  }

  const { store, product } = found;
  return (
    <StoreShell store={store}>
      <Seo seo={buildProductSeo(store, product)} />
      <div className="container sf-product">
        <nav aria-label="Breadcrumb" className="sf-crumbs">
          <Link to={storePath(store.slug)}>{store.name}</Link> <span aria-hidden="true">/</span>{" "}
          <span>{product.name}</span>
        </nav>
        <div className="sf-product-layout">
          <span className="sf-img sf-img-0 sf-img-large" aria-hidden="true" />
          <div>
            <h1>{product.name}</h1>
            <p className="sf-price sf-price-large">{formatNaira(product.priceKobo)}</p>
            <p>{product.description}</p>
            <p className={product.isAvailable ? "sf-stock" : "sf-soldout"}>
              {product.isAvailable ? "In stock" : "Sold out"}
            </p>
            <button className="btn btn-primary" type="button" disabled>
              Checkout opens in Phase 4
            </button>
          </div>
        </div>
      </div>
    </StoreShell>
  );
}
