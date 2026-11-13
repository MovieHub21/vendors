import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { Alert } from "./AuthLayout";
import { Field } from "./Field";
import { PhoneNumberField, isCompletePhoneNumber } from "./PhoneNumberField";
import { formatNaira } from "../lib/money";
import { whatsappLink, whatsappNumber } from "../lib/sales";
import { placeOrder, type PlacedOrder } from "../services/sales";
import { SITE } from "../lib/site";

/**
 * Guest checkout for one product: no account. Nothing here sets a price or a payment status; the server prices the
 * order from the catalogue and creates it as PENDING. The page renders the same on the server (collapsed button).
 */
export function ProductOrderForm({ storeSlug, storeName, productId, productName, priceKobo, available }: {
  storeSlug: string;
  storeName: string;
  productId: string;
  productName: string;
  priceKobo: number;
  available: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  if (!available) {
    return <button className="btn btn-primary" type="button" disabled>Out of stock</button>;
  }
  if (placed) {
    const sellerCanReceiveWhatsapp = Boolean(whatsappNumber(placed.store_phone));
    const vendorOrderUrl = `${SITE.url}/dashboard/orders?o=${encodeURIComponent(placed.order_id)}`;
    const message = [
      `New order ${placed.reference} for ${placed.store_name}`,
      `Customer: ${name.trim()} · ${phone.trim()}`,
      `Item: ${productName} × ${qty}`,
      `Order total: ${formatNaira(placed.total_kobo)}`,
      address.trim() ? `Delivery address: ${address.trim()}` : "",
      email.trim() ? `Email: ${email.trim()}` : "",
      notes.trim() ? `Note: ${notes.trim()}` : "",
      "Payment is pending confirmation.",
      `Review and mark this order in your dashboard: ${vendorOrderUrl}`,
    ].filter(Boolean).join("\n");
    return (
      <div className="sf-order sf-order-done" role="status">
        <h2>Order received ✓</h2>
        <p>Your order <b>{placed.reference}</b> ({formatNaira(placed.total_kobo)}) is pending. The seller will confirm the details and payment with you.</p>
        {sellerCanReceiveWhatsapp && (
          <a className="btn btn-primary" target="_blank" rel="noopener noreferrer" href={whatsappLink(message, placed.store_phone)}>
            <MessageCircle size={16} aria-hidden="true" /> Send order to seller on WhatsApp
          </a>
        )}
        {!sellerCanReceiveWhatsapp && <p className="field-error">Your order is saved as pending, but the seller has not set a valid WhatsApp number yet.</p>}
      </div>
    );
  }
  if (!open) {
    return <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>Order this product</button>;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const q = Number(qty);
    if (!Number.isInteger(q) || q < 1 || q > 100) return setError("Quantity must be a whole number from 1 to 100.");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!isCompletePhoneNumber(phone)) return setError("Enter a valid phone number with your country code.");
    setBusy(true);
    const r = await placeOrder({
      store_slug: storeSlug,
      customer: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, address: address.trim() || undefined },
      items: [{ product_id: productId, quantity: q }],
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (r.ok) {
      const order = r.data.order;
      if (whatsappNumber(order.store_phone)) {
        const vendorOrderUrl = `${SITE.url}/dashboard/orders?o=${encodeURIComponent(order.order_id)}`;
        const message = [
          `New order ${order.reference} for ${order.store_name}`,
          `Customer: ${name.trim()} · ${phone.trim()}`,
          `Item: ${productName} × ${q}`,
          `Order total: ${formatNaira(order.total_kobo)}`,
          address.trim() ? `Delivery address: ${address.trim()}` : "",
          email.trim() ? `Email: ${email.trim()}` : "",
          notes.trim() ? `Note: ${notes.trim()}` : "",
          "Payment is pending confirmation.",
          `Review and mark this order in your dashboard: ${vendorOrderUrl}`,
        ].filter(Boolean).join("\n");
        // Same-tab navigation is not blocked after the async order save; WhatsApp opens with the final order reference/link.
        window.location.assign(whatsappLink(message, order.store_phone));
      } else setPlaced(order);
    } else setError(r.message);
  }

  return (
    <form className="sf-order" onSubmit={submit} noValidate>
      <h2>Order from {storeName}</h2>
      <p className="muted">No account needed. You pay the seller directly once they confirm your order.</p>
      <Field label="Quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Field label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <PhoneNumberField label="Your phone number" value={phone} onChange={setPhone} required hint="Choose your country code, then enter your number without the first 0." />
      <Field label="Email (optional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="Delivery address (if needed)" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Field label="Note to the seller (optional)" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
      {error && <Alert kind="error">{error}</Alert>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Sending order…" : "Send order to vendor’s WhatsApp"}</button>
    </form>
  );
}
