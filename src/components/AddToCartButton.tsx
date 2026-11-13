import type { Product } from "../types/store";
import { useCart } from "../storefront/CartContext";

export function AddToCartButton({ storeSlug, product, compact = false }: { storeSlug: string; product: Product; compact?: boolean }) {
  const cart = useCart();
  const line = cart.linesFor(storeSlug).find((item) => item.product_id === product.id);
  if (line) {
    return (
      <div className={`cart-stepper${compact ? " is-compact" : ""}`} role="group" aria-label={`${product.name} quantity in cart`}>
        <button
          type="button"
          aria-label={line.quantity === 1 ? `Remove ${product.name} from cart` : `Decrease quantity of ${product.name}`}
          onClick={() => line.quantity === 1 ? cart.remove(storeSlug, product.id) : cart.setQuantity(storeSlug, product.id, line.quantity - 1)}
        >−</button>
        <span aria-live="polite">{line.quantity}</span>
        <button
          type="button"
          aria-label={`Increase quantity of ${product.name}`}
          disabled={!product.isAvailable || line.quantity >= 100}
          onClick={() => cart.add(storeSlug, product)}
        >+</button>
      </div>
    );
  }
  return <button className={`btn ${compact ? "btn-outline showcase-add-button" : "btn-primary"}`} type="button" disabled={!product.isAvailable} onClick={() => cart.add(storeSlug, product)}>
    {product.isAvailable ? "Add to cart" : "Out of stock"}
  </button>;
}
