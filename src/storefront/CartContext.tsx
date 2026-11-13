import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "../types/store";

export interface CartLine {
  product_id: string;
  slug: string;
  name: string;
  price_kobo: number;
  image_url: string | null;
  quantity: number;
}
interface CartContextValue {
  linesFor: (storeSlug: string) => CartLine[];
  add: (storeSlug: string, product: Product) => void;
  setQuantity: (storeSlug: string, productId: string, quantity: number) => void;
  remove: (storeSlug: string, productId: string) => void;
  clear: (storeSlug: string) => void;
  count: (storeSlug: string) => number;
  total: (storeSlug: string) => number;
  openCart: (storeSlug: string) => void;
  closeCart: () => void;
  openFor: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "sellsharp-store-carts-v1";
type Carts = Record<string, CartLine[]>;

export function CartProvider({ children }: { children: ReactNode }) {
  const [carts, setCarts] = useState<Carts>({});
  const [ready, setReady] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Carts;
        if (parsed && typeof parsed === "object") setCarts(parsed);
      }
    } catch { /* Ignore unavailable or malformed local storage. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(carts)); } catch { /* Cart remains available until this tab closes. */ }
  }, [carts, ready]);

  const add = useCallback((storeSlug: string, product: Product) => setCarts((current) => {
    const currentLines = current[storeSlug] ?? [];
    const exists = currentLines.some((line) => line.product_id === product.id);
    const lines = exists
      ? currentLines.map((line) => line.product_id === product.id ? { ...line, quantity: Math.min(100, line.quantity + 1) } : line)
      : [...currentLines, { product_id: product.id, slug: product.slug, name: product.name, price_kobo: product.priceKobo, image_url: product.images[0]?.url ?? null, quantity: 1 }];
    return { ...current, [storeSlug]: lines };
  }), []);
  const setQuantity = useCallback((storeSlug: string, productId: string, quantity: number) => setCarts((current) => ({
    ...current,
    [storeSlug]: (current[storeSlug] ?? []).map((line) => line.product_id === productId ? { ...line, quantity: Math.max(1, Math.min(100, quantity)) } : line),
  })), []);
  const remove = useCallback((storeSlug: string, productId: string) => setCarts((current) => ({ ...current, [storeSlug]: (current[storeSlug] ?? []).filter((line) => line.product_id !== productId) })), []);
  const clear = useCallback((storeSlug: string) => setCarts((current) => ({ ...current, [storeSlug]: [] })), []);
  const value = useMemo<CartContextValue>(() => ({
    linesFor: (slug) => carts[slug] ?? [], add, setQuantity, remove, clear,
    count: (slug) => (carts[slug] ?? []).reduce((n, line) => n + line.quantity, 0),
    total: (slug) => (carts[slug] ?? []).reduce((n, line) => n + line.price_kobo * line.quantity, 0),
    openCart: setOpenFor,
    closeCart: () => setOpenFor(null),
    openFor,
  }), [add, carts, clear, openFor, remove, setQuantity]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
