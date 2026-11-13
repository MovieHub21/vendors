import { Link } from "react-router-dom";
import { AddToCartButton } from "../../components/AddToCartButton";
import { ResponsiveImage } from "../../components/ResponsiveImage";
import { formatNaira } from "../../lib/money";
import { productPath } from "../../lib/routes";
import type { Product } from "../../types/store";

export function ProductCard({ product, index, allowCart = true }: { product: Product; index: number; allowCart?: boolean }) {
  const img = product.images[0];
  return (
    <div className="sf-card sf-product-card-wrap">
      <Link to={productPath(product.storeSlug, product.slug)} className="sf-card-link-area">
        {img ? (
          <ResponsiveImage src={img.url} alt={img.alt || product.name} width={img.width} height={img.height} sizes="(max-width: 760px) 50vw, 240px" />
        ) : <span className={`sf-img sf-img-${index % 3}`} aria-hidden="true" />}
        <h3>{product.name}</h3>
        <span className="sf-price">{formatNaira(product.priceKobo)}</span>
        {!product.isAvailable && <span className="sf-soldout">Sold out</span>}
      </Link>
      {allowCart && <div className="sf-card-cart"><AddToCartButton storeSlug={product.storeSlug} product={product} compact /></div>}
    </div>
  );
}
