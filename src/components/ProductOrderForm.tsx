import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { Alert } from "./AuthLayout";
import { Field } from "./Field";
import { formatNaira } from "../lib/money";
import { whatsappLink } from "../lib/sales";
import { placeOrder, type PlacedOrder } from "../services/sales";

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
    const message = `Hello ${placed.store_name}, I just placed order ${placed.reference} for ${productName} (${formatNaira(placed.total_kobo)}).`;
    return (
      <div className="sf-order sf-order-done" role="status">
        <h2>Order received ✓</h2>
        <p>
          Your order reference is <b>{placed.reference}</b> ({formatNaira(placed.total_kobo)}). {placed.store_name} will confirm it with you. You haven't paid anything yet.
        </p>
        {placed.store_phone && (
          <a className="btn btn-primary" target="_blank" rel="noopener noreferrer" href={whatsappLink(message, placed.store_phone)}>
            <MessageCircle size={16} aria-hidden="true" /> Message the seller on WhatsApp
          </a>
        )}
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
    if (phone.replace(/\D/g, "").length < 7) return setError("Please enter a phone number the seller can reach you on.");
    setBusy(true);
    const r = await placeOrder({
      store_slug: storeSlug,
      customer: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, address: address.trim() || undefined },
      items: [{ product_id: productId, quantity: q }],
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (r.ok) setPlaced(r.data.order);
    else setError(r.message);
  }

  return (
    <form className="sf-order" onSubmit={submit} noValidate>
      <h2>Order from {storeName}</h2>
      <p className="muted">No account needed. You pay the seller directly once they confirm your order.</p>
      <Field label="Quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Field label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Phone number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Field label="Email (optional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="Delivery address (if needed)" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Field label="Note to the seller (optional)" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
      {error && <Alert kind="error">{error}</Alert>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : `Place order · ${formatNaira(priceKobo * (Number.isInteger(Number(qty)) && Number(qty) > 0 ? Number(qty) : 1))}`}</button>
    </form>
  );
}
