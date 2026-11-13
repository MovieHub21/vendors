import { Link } from "react-router-dom";
import { ResponsiveImage } from "../../components/ResponsiveImage";
import { formatNaira } from "../../lib/money";
import { productPath } from "../../lib/routes";
import type { Product } from "../../types/store";

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const img = product.images[0];
  return (
    <Link to={productPath(product.storeSlug, product.slug)} className="sf-card">
      {img ? (
        <ResponsiveImage
          src={img.url}
          alt={img.alt || product.name}
          width={img.width}
          height={img.height}
          sizes="(max-width: 760px) 50vw, 240px"
        />
      ) : (
        <span className={`sf-img sf-img-${index % 3}`} aria-hidden="true" />
      )}
      <h3>{product.name}</h3>
      <span className="sf-price">{formatNaira(product.priceKobo)}</span>
      {!product.isAvailable && <span className="sf-soldout">Sold out</span>}
    </Link>
  );
}
