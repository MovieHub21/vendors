import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveImage } from "../../components/ResponsiveImage";
import { AddToCartButton } from "../../components/AddToCartButton";
import { Seo } from "../../components/Seo";
import { StoreShell } from "../../components/StoreShell";
import { buildStoreSeo } from "../../lib/seo";
import { productPath, storeProductsPath } from "../../lib/routes";
import { formatNaira } from "../../lib/money";
import type { Product, VendorStore } from "../../types/store";

const categoriesOf = (products: Product[]) => [...new Set(products.map((product) => product.category?.trim()).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b));

export function ShowcaseStoreHome({ store, products, includeSeo = true }: { store: VendorStore; products: Product[]; includeSeo?: boolean }) {
  const categories = useMemo(() => categoriesOf(products), [products]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const visibleProducts = activeCategory ? products.filter((product) => product.category?.trim() === activeCategory) : products;
  const heroImage = store.coverUrl;
  const promoOneImage = store.promoOneImageUrl;
  const promoTwoImage = store.promoTwoImageUrl;

  return (
    <StoreShell store={store}>
      {includeSeo && <Seo seo={buildStoreSeo(store, products)} />}
      <section className="showcase-hero" style={heroImage ? { backgroundImage: `linear-gradient(90deg, rgb(9 20 40 / 82%) 0%, rgb(9 20 40 / 52%) 46%, rgb(9 20 40 / 8%) 100%), url("${heroImage.replace(/"/g, "%22")}")` } : undefined}>
        <div className="container showcase-hero-inner">
          <div className="showcase-hero-copy">
            <span className="showcase-eyebrow">{store.heroEyebrow || store.category || store.name}</span>
            <h1>{store.heroTitle || store.tagline || "Find your next favourite."}</h1>
            <p>{store.heroDescription || store.description || `Browse the latest collection from ${store.name}.`}</p>
            <a className="showcase-button" href="#showcase-products">{store.heroButtonText || "Shop the collection"}<span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="container showcase-categories" aria-labelledby="showcase-categories-title">
          <h2 id="showcase-categories-title">{store.categoryHeading || "Shop by category"}</h2>
          <label className="showcase-category-filter">
            <span className="sr-only">Filter products by category</span>
            <select value={activeCategory ?? ""} onChange={(e) => setActiveCategory(e.target.value || null)}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </section>
      )}

      <section id="showcase-products" className="container showcase-products" aria-labelledby="showcase-products-title">
        <div className="showcase-section-heading">
          <div><span>{store.category}</span><h2 id="showcase-products-title">{store.productsHeading || "Our collection"}</h2></div>
          {store.productCount > visibleProducts.length && <Link to={storeProductsPath(store.slug)}>View all products <span aria-hidden="true">→</span></Link>}
        </div>
        {visibleProducts.length ? <ul className="showcase-product-grid">
          {visibleProducts.slice(0, 12).map((product, index) => {
            const image = product.images[0];
            return <li key={product.id}><div className="showcase-product-card">
              <Link className="showcase-product-link-area" to={productPath(store.slug, product.slug)}><span className="showcase-product-image">{image ? <ResponsiveImage src={image.url} alt={image.alt || product.name} width={image.width} height={image.height} sizes="(max-width: 640px) 48vw, 220px" /> : <span className={`sf-img sf-img-${index % 3}`} aria-hidden="true" />}</span>
              {product.category && <small className="showcase-product-category">{product.category}</small>}
              <h3>{product.name}</h3><p>{formatNaira(product.priceKobo)}</p><span className="showcase-product-details">View details</span></Link>
              {!store.isDemo && <AddToCartButton storeSlug={store.slug} product={product} compact />}
            </div></li>;
          })}
        </ul> : <p className="sf-empty">No products in this category yet.</p>}
      </section>

      <section className="container showcase-promos" aria-label="Store highlights">
        <article className="showcase-promo showcase-promo-one" style={promoOneImage ? { backgroundImage: `linear-gradient(90deg, rgb(13 27 55 / 78%), rgb(13 27 55 / 15%)), url("${promoOneImage.replace(/"/g, "%22")}")` } : undefined}>
          <div><span>From {store.name}</span><h2>{store.promoOneTitle || "A little something special"}</h2><p>{store.promoOneText || "Discover a new favourite from our collection."}</p><a href="#showcase-products">{store.heroButtonText || "Explore collection"}<span aria-hidden="true">→</span></a></div>
        </article>
        <article className="showcase-promo showcase-promo-two" style={promoTwoImage ? { backgroundImage: `linear-gradient(90deg, rgb(20 26 39 / 10%), rgb(20 26 39 / 4%)), url("${promoTwoImage.replace(/"/g, "%22")}")` } : undefined}>
          <div><span>{store.category}</span><h2>{store.promoTwoTitle || "Picked for your everyday"}</h2><p>{store.promoTwoText || `See what is new at ${store.name}.`}</p><a href="#showcase-products">{store.heroButtonText || "Shop now"}<span aria-hidden="true">→</span></a></div>
        </article>
      </section>
    </StoreShell>
  );
}
