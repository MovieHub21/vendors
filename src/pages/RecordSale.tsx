import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { Field } from "../components/Field";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { CHANNELS, PAYMENT_METHODS, koboToInput, nairaToKobo, previewSale, type Channel, type PaymentMethod } from "../lib/sales";
import { listCustomers, listProducts, type CustomerRow, type ProductRow } from "../services/vendorData";
import { recordSale, type SaleResult } from "../services/sales";

interface Line {
  key: number;
  productId: string; // "" = custom item
  name: string;
  qty: string;
  price: string; // naira text
}
let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, productId: "", name: "", qty: "1", price: "" });

function SaleForm() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<"existing" | "new">("new");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SaleResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listProducts(), listCustomers()]).then(([p, c]) => {
      if (cancelled) return;
      if (p.ok) setProducts(p.data.filter((x) => x.status !== "archived"));
      if (c.ok) setCustomers(c.data);
      if (!p.ok) setLoadError(p.message);
      else if (!c.ok) setLoadError(c.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  const matches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)).slice(0, 50);
  }, [customers, customerSearch]);

  const parsed = lines.map((l) => ({ ...l, qtyN: Number(l.qty), kobo: nairaToKobo(l.price) }));
  const totals = previewSale(
    parsed.map((l) => ({ quantity: Number.isInteger(l.qtyN) && l.qtyN > 0 ? l.qtyN : 0, unitKobo: l.kobo ?? 0 })),
    nairaToKobo(paid || "0") ?? 0,
  );

  function pick(key: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, productId, name: p?.name ?? "", price: p ? koboToInput(p.price_kobo) : l.price } : l)));
  }
  const patch = (key: number, change: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "existing" && !customerId) return setError("Choose a customer, or switch to “New customer”.");
    if (mode === "new" && name.trim().length < 2) return setError("Enter the customer's name.");
    const items = [];
    for (const [i, l] of parsed.entries()) {
      if (!Number.isInteger(l.qtyN) || l.qtyN < 1) return setError(`Line ${i + 1}: quantity must be a whole number, 1 or more.`);
      if (l.kobo === null) return setError(`Line ${i + 1}: enter a valid price, for example 25,000.`);
      if (l.productId) items.push({ product_id: l.productId, quantity: l.qtyN, unit_price_kobo: l.kobo });
      else if (l.name.trim().length < 1) return setError(`Line ${i + 1}: choose a product or type what you sold.`);
      else items.push({ name: l.name.trim(), quantity: l.qtyN, unit_price_kobo: l.kobo });
    }
    const paidKobo = nairaToKobo(paid || "0");
    if (paidKobo === null) return setError("Amount paid isn't valid. Use numbers only, or leave it empty if nothing was paid.");
    if (paidKobo > totals.total) return setError(`Amount paid is more than the total of ${formatNaira(totals.total)}.`);

    setBusy(true);
    const r = await recordSale({
      ...(mode === "existing"
        ? { customer_id: customerId }
        : { customer: { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, address: address.trim() || undefined } }),
      items,
      channel,
      paid_kobo: paidKobo,
      method: paidKobo > 0 ? method : undefined,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (r.ok) setDone(r.data.sale);
    else setError(r.message);
  }

  if (done) {
    return (
      <section className="dash-card sale-done" aria-live="polite">
        <h2>Sale recorded ✓</h2>
        <dl className="dash-facts">
          <div><dt>Reference</dt><dd>{done.reference}</dd></div>
          <div><dt>Total</dt><dd>{formatNaira(done.total_kobo)}</dd></div>
          <div><dt>Paid</dt><dd>{formatNaira(done.paid_kobo)}</dd></div>
          <div><dt>Outstanding</dt><dd>{formatNaira(done.outstanding_kobo)}</dd></div>
        </dl>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/dashboard/receipt/${done.order_id}`)}>View receipt</button>
          <Link className="btn btn-outline" to={`/dashboard/orders?o=${done.order_id}`}>Open order</Link>
          <button className="btn btn-outline" onClick={() => { setDone(null); setLines([blank()]); setPaid(""); setNote(""); setName(""); setPhone(""); setEmail(""); setAddress(""); }}>
            Record another sale
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="dash-card sale-form" onSubmit={submit} noValidate>
      {loadError && <Alert kind="error">{loadError}</Alert>}

      <h2>1. Customer</h2>
      <div className="seg" role="group" aria-label="Customer type">
        <button type="button" className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>New customer</button>
        <button type="button" className={mode === "existing" ? "on" : ""} onClick={() => setMode("existing")} disabled={customers.length === 0}>
          Existing customer{customers.length === 0 ? " (none yet)" : ""}
        </button>
      </div>
      {mode === "existing" ? (
        <div className="existing-customer-picker">
          {selectedCustomer ? (
            <div className="selected-customer-card">
              <div className="selected-customer-info">
                <span className="selected-customer-label">Selected Customer</span>
                <strong>{selectedCustomer.name}</strong>
                <span>{[selectedCustomer.phone, selectedCustomer.email].filter(Boolean).join(" · ") || "No phone number saved"}</span>
                {selectedCustomer.outstanding_kobo > 0 ? (
                  <span className="badge badge-pay-unpaid">Currently owes {formatNaira(selectedCustomer.outstanding_kobo)}</span>
                ) : (
                  <span className="badge badge-delivered">Balance clear</span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setCustomerId("")}
              >
                Change customer
              </button>
            </div>
          ) : (
            <>
              <Field
                label="Search by name or phone"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Type customer name or phone..."
              />
              <div className="field">
                <label htmlFor="sale-customer">Choose from list ({matches.length} found)</label>
                <div className="customer-selection-list" role="listbox">
                  {matches.length === 0 ? (
                    <div className="customer-item-empty">No customers found matching &quot;{customerSearch}&quot;.</div>
                  ) : (
                    matches.map((c) => {
                      const isSelected = c.id === customerId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`customer-select-item${isSelected ? " selected" : ""}`}
                          onClick={() => setCustomerId(c.id)}
                        >
                          <div className="customer-item-main">
                            <strong>{c.name}</strong>
                            <small>{c.phone ? c.phone : "No phone"}</small>
                          </div>
                          <div className="customer-item-meta">
                            {c.outstanding_kobo > 0 ? (
                              <span className="badge badge-pay-unpaid">Owes {formatNaira(c.outstanding_kobo)}</span>
                            ) : (
                              <span className="badge badge-delivered">₦0 owed</span>
                            )}
                            <span className="btn btn-outline btn-small customer-pick-btn">Select</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="field-row">
            <Field label="Customer name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            <Field label="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Returning customers are matched by phone." />
          </div>
          <div className="field-row">
            <Field label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </>
      )}

      <h2>2. What was sold</h2>
      {products.length === 0 && (
        <p className="empty">
          You haven't added products yet. You can type what you sold below, or <Link to="/dashboard/products?new=1">add a product</Link> to your catalogue first so stock updates automatically.
        </p>
      )}
      {lines.map((l, i) => (
        <div className="sale-line" key={l.key}>
          <div className="field">
            <label htmlFor={`p-${l.key}`}>Item {i + 1}</label>
            <select id={`p-${l.key}`} value={l.productId} onChange={(e) => pick(l.key, e.target.value)}>
              <option value="">Other item (type below)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatNaira(p.price_kobo)}{p.stock_quantity !== null ? ` · ${p.stock_quantity} in stock` : ""}
                </option>
              ))}
            </select>
            {!l.productId && <input aria-label={`Name of item ${i + 1}`} placeholder="What did you sell?" value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })} />}
          </div>
          <Field label="Qty" inputMode="numeric" value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value })} />
          <Field label="Price each (₦)" inputMode="decimal" value={l.price} onChange={(e) => patch(l.key, { price: e.target.value })} />
          {lines.length > 1 && (
            <button type="button" className="icon-btn" aria-label={`Remove item ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-outline" onClick={() => setLines((ls) => [...ls, blank()])}>
        <Plus size={15} aria-hidden="true" /> Add another item
      </button>

      <h2>3. Payment</h2>
      <div className="field-row">
        <div className="field">
          <label htmlFor="sale-channel">Where did this sale come from?</label>
          <select id="sale-channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <Field label="Amount paid so far (₦)" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} hint="Leave empty if nothing has been paid." />
      </div>
      {nairaToKobo(paid || "0") !== 0 && (
        <div className="field">
          <label htmlFor="sale-method">Paid by</label>
          <select id="sale-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}
      <Field label="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />

      <div className="sale-total" aria-live="polite">
        <div><span>Total</span><strong>{formatNaira(totals.total)}</strong></div>
        <div><span>Paid</span><strong>{formatNaira(totals.paid)}</strong></div>
        <div className={totals.outstanding > 0 ? "owing" : ""}><span>Outstanding</span><strong>{formatNaira(Math.max(0, totals.outstanding))}</strong></div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      <button className="btn btn-primary btn-large" disabled={busy}>{busy ? "Saving…" : "Save sale"}</button>
    </form>
  );
}

export default function RecordSale() {
  return (
    <DashboardShell seo={PAGE_META.dashboardSale} title="Record a sale">
      {() => <SaleForm />}
    </DashboardShell>
  );
}
