import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { getClientApi } from "../../data/clientApi";
import { cleanSearchTerm } from "../../data/publicApi";
import { rankProductResults } from "../../lib/productSearch";
import type { Product, VendorStore } from "../../types/store";
import { ProductCard } from "./ProductCard";

function placeholderForStore(store: VendorStore): string {
  const type = `${store.category} ${store.categorySlug}`.toLowerCase();
  if (/phone|mobile|gadget|electronic|smartphone/.test(type)) return "iPhone 18 Pro Max";
  if (/cloth|clothing|fashion|apparel|wear|tailor|fabric/.test(type)) return "Ankara dress";
  if (/beauty|cosmetic|skin.?care|make.?up/.test(type)) return "Vitamin C serum";
  if (/shoe|footwear|sneaker/.test(type)) return "Leather sandals";
  if (/food|grocery|grocer|restaurant|bakery/.test(type)) return "Fresh tomatoes";
  if (/home|furniture|decor|interior/.test(type)) return "Modern lounge chair";
  return "Find products";
}

export function StoreProductSearch({ store }: { store: VendorStore }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = cleanSearchTerm(input);
    if (!term) {
      setInput("");
      setQuery("");
      setResults(null);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const products = await getClientApi().searchProducts(store.slug, term);
      setQuery(term);
      setResults(rankProductResults(products, term));
      setVisibleLimit(12);
    } catch {
      setError("We couldn’t search products right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setInput("");
    setQuery("");
    setResults(null);
    setVisibleLimit(12);
    setError("");
  }

  return (
    <section className="container sf-home-search" aria-label={`Search products at ${store.name}`}>
      <form className="sf-product-search" role="search" onSubmit={(event) => void submit(event)}>
        <label htmlFor={`store-product-search-${store.slug}`}>Search this store</label>
        <div className="sf-product-search-control">
          <Search size={18} aria-hidden="true" />
          <input id={`store-product-search-${store.slug}`} type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholderForStore(store)} maxLength={80} />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Search size={16} aria-hidden="true" /> {busy ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="sf-product-search-meta">
          <small>Search products by name, category or description.</small>
          {query && <button type="button" onClick={clear}><X size={14} aria-hidden="true" /> Clear search</button>}
        </div>
      </form>
      {error && <p className="sf-product-search-error" role="alert">{error}</p>}
      {results && (
        <div className="sf-home-search-results" aria-live="polite">
          <div className="sf-section-heading">
            <div><span className="sf-section-eyebrow">Search results</span><h2>Results for “{query}”</h2></div>
            <span className="sf-product-count">{results.length} {results.length === 1 ? "match" : "matches"}</span>
          </div>
          {results.length ? <>
            <ul className="sf-grid">
              {results.slice(0, visibleLimit).map((product, index) => <li key={product.id}><ProductCard product={product} index={index} allowCart={!store.isDemo} /></li>)}
            </ul>
            {results.length > visibleLimit && <button className="btn btn-outline sf-search-more" type="button" onClick={() => setVisibleLimit((current) => current + 12)}>Show more results</button>}
          </> : <p className="sf-empty">No products matched “{query}”. Try a different phrase or a few keywords.</p>}
        </div>
      )}
    </section>
  );
}
