import { useState, type FormEvent } from "react";
import { Alert } from "./AuthLayout";
import { Field } from "./Field";
import { PhoneNumberField, isCompletePhoneNumber } from "./PhoneNumberField";
import { formatNaira } from "../lib/money";
import { SITE } from "../lib/site";
import { whatsappLink, whatsappNumber } from "../lib/sales";
import { placeOrder, type PlacedOrder } from "../services/sales";
import type { VendorStore } from "../types/store";
import { useCart } from "../storefront/CartContext";

export function CartDrawer({ store }: { store: VendorStore }) {
  const cart = useCart();
  const lines = cart.linesFor(store.slug);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  function closeCart() {
    setPlaced(null);
    setError(null);
    cart.closeCart();
  }

  if (cart.openFor !== store.slug) return null;

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
    cart.clear(store.slug);
    setPlaced(order);
    if (!whatsappNumber(order.store_phone)) return;
    const vendorOrderUrl = `${SITE.url}/dashboard/orders?o=${encodeURIComponent(order.order_id)}`;
    const itemLines = lines.map((line) => `• ${line.name} × ${line.quantity} — ${formatNaira(line.price_kobo * line.quantity)}`);
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
    window.location.assign(whatsappLink(message, order.store_phone));
  }

  return (
    <div className="cart-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCart(); }}>
      <section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header className="cart-drawer-header"><div><p className="store-design-preview-label">{store.name}</p><h2 id="cart-title">Your cart</h2></div><button type="button" className="btn btn-outline cart-close" onClick={closeCart}>Close</button></header>
        {placed ? <div className="cart-success"><h3>Order sent to the seller</h3><p>Order <b>{placed.reference}</b> is saved as pending for {formatNaira(placed.total_kobo)}.</p>{!whatsappNumber(placed.store_phone) ? <Alert kind="info">The seller has not set a valid WhatsApp number. Your order is saved; contact the store directly.</Alert> : <p className="muted">WhatsApp should open with your full order ready to send.</p>}<button className="btn btn-primary" type="button" onClick={closeCart}>Continue shopping</button></div> : (
          <>
            {lines.length === 0 ? <p className="cart-empty">Your cart is empty. Add products to place an order.</p> : <ul className="cart-lines">{lines.map((line) => <li className="cart-line" key={line.product_id}>
              {line.image_url ? <img src={line.image_url} alt="" /> : <span className="cart-line-image" aria-hidden="true" />}
              <div className="cart-line-info"><b>{line.name}</b><span>{formatNaira(line.price_kobo)}</span><div className="cart-quantity"><button type="button" aria-label={`Decrease quantity of ${line.name}`} disabled={line.quantity <= 1} onClick={() => cart.setQuantity(store.slug, line.product_id, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Increase quantity of ${line.name}`} onClick={() => cart.setQuantity(store.slug, line.product_id, line.quantity + 1)}>+</button><button className="cart-remove" type="button" onClick={() => cart.remove(store.slug, line.product_id)}>Remove</button></div></div>
              <b className="cart-line-total">{formatNaira(line.price_kobo * line.quantity)}</b>
            </li>)}</ul>}
            <div className="cart-subtotal"><span>Estimated total</span><b>{formatNaira(cart.total(store.slug))}</b></div>
            <p className="cart-total-note">The seller confirms the final order and any negotiated amount in WhatsApp.</p>
            <form className="cart-checkout" onSubmit={submit}>
              <h3>Delivery and contact</h3>
              <Field label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              <PhoneNumberField label="Your phone number" value={phone} onChange={setPhone} required hint="Choose your country code, then enter your number without the first 0." />
              <Field label="Email (optional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field label="Delivery address (optional)" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Field label="Note to the seller (optional)" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
              {error && <Alert kind="error">{error}</Alert>}
              <button className="btn btn-primary cart-submit" type="submit" disabled={busy || lines.length === 0}>{busy ? "Preparing order…" : "Send order to vendor’s WhatsApp"}</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
