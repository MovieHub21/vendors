import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Seo } from "../../components/Seo";
import { StoreShell } from "../../components/StoreShell";
import { storePath } from "../../lib/routes";
import { buildStoreProductsSeo } from "../../lib/seo";
import type { Product, VendorStore } from "../../types/store";
import { ProductCard } from "./ProductCard";

export function StoreProducts({ store, products }: { store: VendorStore; products: Product[] }) {
  const [activeCategory, setActiveCategory] = useState("");
  const categories = useMemo(() => [...new Set(products.map((product) => product.category?.trim()).filter((category): category is string => Boolean(category)))].sort((a, b) => a.localeCompare(b)), [products]);
  const visibleProducts = activeCategory ? products.filter((product) => product.category?.trim() === activeCategory) : products;
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
          <div className="sf-products-filter">
            {categories.length > 0 && <label className="sf-category-filter"><span>Category</span>
              <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>}
            <span className="sf-product-count">{visibleProducts.length} {visibleProducts.length === 1 ? "item" : "items"}</span>
          </div>
        </div>
        {products.length === 0 ? (
          <p className="sf-empty">This store hasn't added products yet.</p>
        ) : visibleProducts.length === 0 ? (
          <p className="sf-empty">No products in this category yet.</p>
        ) : (
          <ul className="sf-grid">
            {visibleProducts.map((p, i) => (
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
