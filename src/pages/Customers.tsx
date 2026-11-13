import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell, dateOnly, dateTime, PayBadge, StatusBadge } from "../components/DashboardShell";
import { PaymentForm } from "../components/PaymentForm";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { whatsappLink } from "../lib/sales";
import { listCustomers, listOrders, type CustomerRow, type OrderRow } from "../services/vendorData";

function Profile({ customer, storeName, onChanged }: { customer: CustomerRow; storeName: string; onChanged: () => void }) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await listOrders({ customerId: customer.id });
    if (r.ok) setOrders(r.data);
    else setError(r.message);
  }, [customer.id]);
  useEffect(() => {
    setOrders(null);
    setPayFor(null);
    void load();
  }, [load]);

  return (
    <section className="dash-card" aria-label={`Customer ${customer.name}`}>
      <h2>{customer.name}</h2>
      <p className="muted">
        {[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ") || "No contact details saved"}
      </p>
      <dl className="dash-facts">
        <div><dt>Orders</dt><dd>{customer.order_count}</dd></div>
        <div><dt>Total purchases</dt><dd>{formatNaira(customer.total_purchases_kobo)}</dd></div>
        <div><dt>Total paid</dt><dd>{formatNaira(customer.total_paid_kobo)}</dd></div>
        <div><dt>Outstanding</dt><dd><b>{formatNaira(customer.outstanding_kobo)}</b></dd></div>
        <div><dt>Last purchase</dt><dd>{customer.last_purchase_at ? dateOnly(customer.last_purchase_at) : "–"}</dd></div>
      </dl>
      {customer.phone && customer.outstanding_kobo > 0 && (
        <a
          className="btn btn-outline"
          target="_blank"
          rel="noopener noreferrer"
          href={whatsappLink(`Hello ${customer.name}, this is ${storeName}. A friendly reminder of your balance of ${formatNaira(customer.outstanding_kobo)}. Thank you!`, customer.phone)}
        >
          <MessageCircle size={16} aria-hidden="true" /> Send balance reminder
        </a>
      )}
      <h3>Purchase history</h3>
      {error && <Alert kind="error">{error}</Alert>}
      {!orders && !error && <p className="auth-loading">Loading…</p>}
      {orders && orders.length === 0 && <p className="empty">No orders for this customer yet.</p>}
      {orders && orders.length > 0 && (
        <ul className="dash-list">
          {orders.map((o) => {
            const owed = o.total_kobo - o.paid_kobo;
            const canPay = o.status !== "cancelled" && owed > 0;
            return (
              <li key={o.id} className="dash-list-block">
                <div className="dash-list-row">
                  <Link to={`/dashboard/orders?o=${o.id}`}>
                    <b>{o.reference}</b>
                    <small>{dateTime(o.created_at)}</small>
                  </Link>
                  <span className="dash-list-end">
                    {formatNaira(o.total_kobo)} <StatusBadge status={o.status} /> <PayBadge status={o.payment_status} />
                    {canPay && (
                      <button type="button" className="btn btn-outline btn-small" onClick={() => setPayFor(payFor === o.id ? null : o.id)}>
                        {payFor === o.id ? "Close" : `Record payment (${formatNaira(owed)} owed)`}
                      </button>
                    )}
                  </span>
                </div>
                {payFor === o.id && (
                  <PaymentForm
                    orderId={o.id}
                    outstandingKobo={owed}
                    onRecorded={() => {
                      setPayFor(null);
                      void load();
                      onChanged();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CustomersView({ storeName }: { storeName: string }) {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const owingOnly = params.get("owing") === "1";
  const selectedId = params.get("c");

  const load = useCallback(async () => {
    const r = await listCustomers();
    if (r.ok) setRows(r.data);
    else setError(r.message);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? [])
      .filter((c) => !owingOnly || c.outstanding_kobo > 0)
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.phone ?? "").includes(needle) || (c.email ?? "").toLowerCase().includes(needle))
      .sort((a, b) => (owingOnly ? b.outstanding_kobo - a.outstanding_kobo : a.name.localeCompare(b.name)));
  }, [rows, q, owingOnly]);
  const totalOwed = (rows ?? []).reduce((sum, c) => sum + c.outstanding_kobo, 0);
  const selected = rows?.find((c) => c.id === selectedId) ?? null;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="dash-filters">
        <div className="field"><label htmlFor="c-q">Search</label><input id="c-q" placeholder="Name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg" role="group" aria-label="Show">
          <button type="button" className={!owingOnly ? "on" : ""} onClick={() => setParam("owing", null)}>All customers</button>
          <button type="button" className={owingOnly ? "on" : ""} onClick={() => setParam("owing", "1")}>Owing money</button>
        </div>
      </div>
      {rows && <p className="dash-total-owed">Total owed to you: <b>{formatNaira(totalOwed)}</b> by {rows.filter((c) => c.outstanding_kobo > 0).length} customer(s)</p>}
      {error && <Alert kind="error">{error}</Alert>}
      {!rows && !error && <p className="auth-loading">Loading customers…</p>}
      {rows && shown.length === 0 && (
        <p className="empty dash-card">
          {rows.length === 0 ? "No customers yet. People who order from your store, and customers you add when you record a sale, appear here automatically." : owingOnly ? "Nobody owes you anything right now." : "No customers match your search."}
        </p>
      )}
      {shown.length > 0 && (
        <div className="dash-card table-scroll">
          <table className="dash-table dash-table-click">
            <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Purchases</th><th>Paid</th><th>Owes</th><th>Last purchase</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className={c.id === selectedId ? "selected" : undefined} onClick={() => setParam("c", c.id)}>
                  <td><button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); setParam("c", c.id); }}>{c.name}</button></td>
                  <td>{c.phone ?? "–"}</td>
                  <td>{c.order_count}</td>
                  <td>{formatNaira(c.total_purchases_kobo)}</td>
                  <td>{formatNaira(c.total_paid_kobo)}</td>
                  <td>{c.outstanding_kobo > 0 ? <b>{formatNaira(c.outstanding_kobo)}</b> : "–"}</td>
                  <td>{c.last_purchase_at ? dateOnly(c.last_purchase_at) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <Profile customer={selected} storeName={storeName} onChanged={() => void load()} />}
    </>
  );
}

export default function Customers() {
  return (
    <DashboardShell seo={PAGE_META.dashboardCustomers} title="Customers and debts">
      {(me) => <CustomersView storeName={me.store?.name ?? "your store"} />}
    </DashboardShell>
  );
}
