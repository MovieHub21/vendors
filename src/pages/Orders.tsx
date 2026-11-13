import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageCircle, Receipt } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell, dateTime, PayBadge, StatusBadge } from "../components/DashboardShell";
import { PaymentForm } from "../components/PaymentForm";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { channelLabel, methodLabel, ORDER_STATUSES, whatsappLink, type OrderStatus } from "../lib/sales";
import { updateOrderStatus } from "../services/sales";
import { getOrder, listOrders, type OrderDetail, type OrderRow } from "../services/vendorData";

function Detail({ id, storeName, onChanged }: { id: string; storeName: string; onChanged: () => void }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await getOrder(id);
    if (r.ok) {
      setOrder(r.data);
      setError(null);
    } else setError(r.message);
  }, [id]);
  useEffect(() => {
    setOrder(null);
    setNotice(null);
    void load();
  }, [load]);

  async function setStatus(status: OrderStatus) {
    if (!order || status === order.status) return;
    if (status === "cancelled" && !window.confirm("Cancel this order? Stock will be returned and it can't be reopened.")) return;
    setBusy(true);
    setNotice(null);
    const r = await updateOrderStatus(order.id, status);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setError(null);
    setNotice("Status updated.");
    await load();
    onChanged();
  }

  if (error && !order) return <Alert kind="error">{error}</Alert>;
  if (!order) return <p className="auth-loading">Loading order…</p>;
  const outstanding = order.total_kobo - order.paid_kobo;
  const phone = order.customers?.phone;
  const cancelled = order.status === "cancelled";

  return (
    <section className="dash-card order-detail" aria-label={`Order ${order.reference}`}>
      <div className="dash-head-row">
        <h2>{order.reference}</h2>
        <StatusBadge status={order.status} /> <PayBadge status={order.payment_status} />
      </div>
      <p className="muted">
        {dateTime(order.created_at)} · {channelLabel(order.channel)} · <Link to={`/dashboard/customers?c=${order.customer_id}`}>{order.customers?.name}</Link>
        {phone ? ` · ${phone}` : ""}
      </p>
      {order.delivery_address && <p>Deliver to: {order.delivery_address}</p>}
      {order.notes && <p>Note: {order.notes}</p>}
      {order.status === "pending" && <Alert kind="info">This order is waiting for you. Confirm it to count it as a sale; stock is reduced at that point.</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <table className="dash-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id}>
              <td>{i.product_name}{i.variant ? ` (${i.variant})` : ""}</td>
              <td>{i.quantity}</td>
              <td>{formatNaira(i.unit_price_kobo)}</td>
              <td>{formatNaira(i.line_total_kobo)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Total</td><td>{formatNaira(order.total_kobo)}</td></tr>
          <tr><td colSpan={3}>Paid</td><td>{formatNaira(order.paid_kobo)}</td></tr>
          <tr><td colSpan={3}>Outstanding</td><td><b>{formatNaira(outstanding)}</b></td></tr>
        </tfoot>
      </table>

      <div className="field">
        <label htmlFor="order-status">Order status</label>
        <select id="order-status" value={order.status} disabled={busy || cancelled} onChange={(e) => void setStatus(e.target.value as OrderStatus)}>
          {ORDER_STATUSES.filter((s) => s.value !== "pending" || order.status === "pending").map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <h3>Payments</h3>
      {order.payments.length === 0 ? (
        <p className="empty">No payment recorded yet.</p>
      ) : (
        <ul className="dash-list">
          {order.payments.map((p) => (
            <li key={p.id}>
              <span>
                <b>{formatNaira(p.amount_kobo)}</b> · {methodLabel(p.method)}
                <small>{p.source === "paystack" ? "Verified by Paystack" : "Recorded by you"} · {dateTime(p.recorded_at)}{p.note ? ` · ${p.note}` : ""}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!cancelled && outstanding > 0 && (
        <PaymentForm
          orderId={order.id}
          outstandingKobo={outstanding}
          onRecorded={() => {
            setNotice("Payment saved.");
            void load();
            onChanged();
          }}
        />
      )}

      <div className="quick-actions">
        <Link className="btn btn-primary" to={`/dashboard/receipt/${order.id}`}>
          <Receipt size={16} aria-hidden="true" /> Receipt
        </Link>
        {phone && (
          <a
            className="btn btn-outline"
            target="_blank"
            rel="noopener noreferrer"
            href={whatsappLink(`Hello ${order.customers?.name}, this is ${storeName} about your order ${order.reference}.`, phone)}
          >
            <MessageCircle size={16} aria-hidden="true" /> Message on WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}

function OrdersView({ storeName }: { storeName: string }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("o");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [payment, setPayment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listOrders({ status, payment, from, to });
    if (r.ok) {
      setRows(r.data);
      setError(null);
    } else setError(r.message);
  }, [status, payment, from, to]);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return (rows ?? []).filter(
      (o) => o.reference.toLowerCase().includes(needle) || (o.customers?.name ?? "").toLowerCase().includes(needle) || (o.customers?.phone ?? "").includes(needle),
    );
  }, [rows, q]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("o", id);
    else next.delete("o");
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="dash-filters">
        <div className="field"><label htmlFor="o-q">Search</label><input id="o-q" placeholder="Reference, customer or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="o-s">Status</label>
          <select id="o-s" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="o-p">Payment</label>
          <select id="o-p" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">All</option><option value="unpaid">Unpaid</option><option value="partial">Part-paid</option><option value="paid">Paid</option>
          </select>
        </div>
        <div className="field"><label htmlFor="o-f">From</label><input id="o-f" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="o-t">To</label><input id="o-t" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {!rows && !error && <p className="auth-loading">Loading orders…</p>}
      {shown && shown.length === 0 && (
        <p className="empty dash-card">
          {rows && rows.length === 0 && !status && !payment && !from && !to
            ? "No orders yet. Orders from your store link appear here, and you can record sales from WhatsApp, Instagram or in person with “Record sale”."
            : "No orders match these filters."}
        </p>
      )}
      {shown && shown.length > 0 && (
        <div className="dash-card table-scroll">
          <table className="dash-table dash-table-click">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Owed</th><th>Status</th><th>Payment</th></tr></thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className={o.id === selected ? "selected" : undefined} onClick={() => select(o.id)}>
                  <td><button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); select(o.id); }}>{o.reference}</button></td>
                  <td>{o.customers?.name}</td>
                  <td>{dateTime(o.created_at)}</td>
                  <td>{formatNaira(o.total_kobo)}</td>
                  <td>{o.status === "cancelled" ? "–" : formatNaira(o.total_kobo - o.paid_kobo)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><PayBadge status={o.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows && rows.length >= 300 && <p className="muted">Showing the latest 300 orders. Use the filters to narrow down.</p>}
        </div>
      )}
      {selected && <Detail id={selected} storeName={storeName} onChanged={() => void load()} />}
    </>
  );
}

export default function Orders() {
  return (
    <DashboardShell
      seo={PAGE_META.dashboardOrders}
      title="Orders"
      actions={<Link className="btn btn-primary" to="/dashboard/sale">Record sale</Link>}
    >
      {(me) => <OrdersView storeName={me.store?.name ?? "your store"} />}
    </DashboardShell>
  );
}
