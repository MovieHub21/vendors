import type { Product } from "../types/store";
import { useCart } from "../storefront/CartContext";

export function AddToCartButton({ storeSlug, product, compact = false }: { storeSlug: string; product: Product; compact?: boolean }) {
  const cart = useCart();
  return <button className={`btn ${compact ? "btn-outline showcase-add-button" : "btn-primary"}`} type="button" disabled={!product.isAvailable} onClick={() => { cart.add(storeSlug, product); cart.openCart(storeSlug); }}>
    {product.isAvailable ? "Add to cart" : "Out of stock"}
  </button>;
}
