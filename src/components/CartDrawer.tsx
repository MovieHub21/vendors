import { useEffect, useState, type FormEvent } from "react";
import { Check, MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Alert } from "./AuthLayout";
import { Field } from "./Field";
import { PhoneNumberField, isCompletePhoneNumber } from "./PhoneNumberField";
import { formatNaira } from "../lib/money";
import { SITE } from "../lib/site";
import { whatsappLink, whatsappNumber } from "../lib/sales";
import { placeOrder, type PlacedOrder } from "../services/sales";
import type { VendorStore } from "../types/store";
import { useCart } from "../storefront/CartContext";

const FORM_ID = "cart-checkout-form";

/**
 * Cart + guest checkout. On phones it is a bottom sheet: items, then a short form, with the total and the order
 * button pinned to the bottom so the thumb never has to hunt for it. On larger screens it is a right-hand drawer.
 */
export function CartDrawer({ store }: { store: VendorStore }) {
  const cart = useCart();
  const lines = cart.linesFor(store.slug);
  const isOpen = cart.openFor === store.slug;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ order: PlacedOrder; whatsappUrl: string | null } | null>(null);

  function closeCart() {
    setPlaced(null);
    setError(null);
    cart.closeCart();
  }

  // Lock the page behind the sheet and let Escape close it.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlaced(null);
        setError(null);
        cart.closeCart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, cart]);

  if (!isOpen) return null;

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lines.length) return setError("Add a product to your cart first.");
    if (name.trim().length < 2) return setError("Enter your name so the seller knows who placed this order.");
    if (!isCompletePhoneNumber(phone)) return setError("Enter a valid phone number with the country code.");
    setBusy(true);
    const result = await placeOrder({
      store_slug: store.slug,
      customer: { name: name.trim(), phone, email: email.trim() || undefined, address: address.trim() || undefined },
      items: lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity })),
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    const order = result.data.order;
    const orderLines = lines;
    cart.clear(store.slug);
    if (!whatsappNumber(order.store_phone)) return setPlaced({ order, whatsappUrl: null });
    const vendorOrderUrl = `${SITE.url}/dashboard/orders?o=${encodeURIComponent(order.order_id)}`;
    const itemLines = orderLines.map((line) => `• ${line.name} × ${line.quantity} — ${formatNaira(line.price_kobo * line.quantity)}`);
    const message = [
      `New order ${order.reference} for ${order.store_name}`,
      `Customer: ${name.trim()} · ${phone}`,
      ...itemLines,
      `Order total: ${formatNaira(order.total_kobo)}`,
      address.trim() ? `Delivery address: ${address.trim()}` : "",
      email.trim() ? `Email: ${email.trim()}` : "",
      notes.trim() ? `Note: ${notes.trim()}` : "",
      "Payment is pending confirmation.",
      `Review and mark this order in your dashboard: ${vendorOrderUrl}`,
    ].filter(Boolean).join("\n");
    const whatsappUrl = whatsappLink(message, order.store_phone);
    setPlaced({ order, whatsappUrl });
    // Opens WhatsApp straight away; the button on the success screen is the fallback if the phone blocks it.
    window.location.assign(whatsappUrl);
  }

  return (
    <div className="cart-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) closeCart(); }}>
      <section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <span className="cart-grabber" aria-hidden="true" />
        <header className="cart-drawer-header">
          <div>
            <p className="cart-store-name">{store.name}</p>
            <h2 id="cart-title">{placed ? "Order sent" : `Your cart${itemCount ? ` (${itemCount})` : ""}`}</h2>
          </div>
          <button type="button" className="cart-close" onClick={closeCart} aria-label="Close cart"><X size={20} aria-hidden="true" /></button>
        </header>

        {placed ? (
          <div className="cart-scroll">
            <div className="cart-success">
              <span className="cart-success-icon" aria-hidden="true"><Check size={30} /></span>
              <h3>Order received</h3>
              <p>Order <b>{placed.order.reference}</b> for <b>{formatNaira(placed.order.total_kobo)}</b> is saved as pending.</p>
              {placed.whatsappUrl ? (
                <>
                  <p className="muted">WhatsApp should open with your order ready to send. If it didn’t, tap below, then press send.</p>
                  <a className="btn btn-primary cart-whatsapp" href={placed.whatsappUrl}><MessageCircle size={18} aria-hidden="true" /> Open WhatsApp</a>
                </>
              ) : (
                <Alert kind="info">The seller has not set a valid WhatsApp number. Your order is saved; contact the store directly.</Alert>
              )}
              <button className="btn btn-outline cart-continue" type="button" onClick={closeCart}>Continue shopping</button>
            </div>
          </div>
        ) : lines.length === 0 ? (
          <div className="cart-scroll">
            <div className="cart-empty"><ShoppingBag size={34} aria-hidden="true" /><b>Your cart is empty</b><span>Add products to place an order.</span><button className="btn btn-outline" type="button" onClick={closeCart}>Browse products</button></div>
          </div>
        ) : (
          <>
            <div className="cart-scroll">
              <ul className="cart-lines">
                {lines.map((line) => (
                  <li className="cart-line" key={line.product_id}>
                    {line.image_url ? <img src={line.image_url} alt="" /> : <span className="cart-line-image" aria-hidden="true" />}
                    <div className="cart-line-info">
                      <b>{line.name}</b>
                      <span>{formatNaira(line.price_kobo)}</span>
                      <div className="cart-line-actions">
                        <div className="cart-quantity" role="group" aria-label={`Quantity of ${line.name}`}>
                          <button type="button" aria-label={`Decrease quantity of ${line.name}`} disabled={line.quantity <= 1} onClick={() => cart.setQuantity(store.slug, line.product_id, line.quantity - 1)}><Minus size={16} aria-hidden="true" /></button>
                          <span aria-live="polite">{line.quantity}</span>
                          <button type="button" aria-label={`Increase quantity of ${line.name}`} onClick={() => cart.setQuantity(store.slug, line.product_id, line.quantity + 1)}><Plus size={16} aria-hidden="true" /></button>
                        </div>
                        <button className="cart-remove" type="button" aria-label={`Remove ${line.name}`} onClick={() => cart.remove(store.slug, line.product_id)}><Trash2 size={17} aria-hidden="true" /></button>
                      </div>
                    </div>
                    <b className="cart-line-total">{formatNaira(line.price_kobo * line.quantity)}</b>
                  </li>
                ))}
              </ul>

              <form id={FORM_ID} className="cart-checkout" onSubmit={submit} noValidate>
                <h3>Your details</h3>
                <Field label="Your name" autoComplete="name" enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} />
                <PhoneNumberField label="WhatsApp / phone number" value={phone} onChange={setPhone} required hint="Pick your country code, then type your number without the first 0." />
                <Field label="Delivery address (optional)" autoComplete="street-address" enterKeyHint="next" value={address} onChange={(e) => setAddress(e.target.value)} />
                <details className="cart-more">
                  <summary>Add email or a note for the seller</summary>
                  <div className="cart-more-fields">
                    <Field label="Email (optional)" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Field label="Note to the seller (optional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </details>
                <p className="cart-total-note">No payment now. The seller confirms the final price and how to pay on WhatsApp.</p>
                {error && <Alert kind="error">{error}</Alert>}
              </form>
            </div>

            <footer className="cart-footer">
              <div className="cart-footer-total"><span>Total</span><b>{formatNaira(cart.total(store.slug))}</b></div>
              <button className="btn btn-primary cart-submit" type="submit" form={FORM_ID} disabled={busy}>
                <MessageCircle size={18} aria-hidden="true" /> {busy ? "Preparing order…" : "Order on WhatsApp"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
