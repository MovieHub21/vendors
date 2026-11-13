import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageCircle, Printer } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell, dateTime } from "../components/DashboardShell";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { channelLabel, methodLabel, PAYMENT_STATUS_LABEL, receiptText, whatsappLink } from "../lib/sales";
import { getReceipt, type Receipt } from "../services/sales";

function ReceiptView({ orderId }: { orderId: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getReceipt(orderId).then((r) => {
      if (cancelled) return;
      if (r.ok) setReceipt(r.data.receipt);
      else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!receipt) return <p className="auth-loading">Preparing receipt…</p>;
  const s = receipt.snapshot;
  const place = [s.business.city, s.business.state].filter(Boolean).join(", ");

  return (
    <>
      <div className="quick-actions no-print">
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print or save as PDF</button>
        <a className="btn btn-outline" target="_blank" rel="noopener noreferrer" href={whatsappLink(receiptText(receipt.receipt_no, receipt.revision, s), s.customer.phone)}>
          <MessageCircle size={16} aria-hidden="true" /> Share on WhatsApp
        </a>
        <Link className="btn btn-outline" to={`/dashboard/orders?o=${orderId}`}>Back to order</Link>
      </div>
      {receipt.revision > 1 && <p className="muted no-print">This is an updated receipt (version {receipt.revision}) reflecting payments recorded since the first one. Earlier versions are kept.</p>}
      <article className="receipt" aria-label={`Receipt ${receipt.receipt_no}`}>
        <header>
          {s.business.logo_url && <img src={s.business.logo_url} alt="" width={56} height={56} />}
          <div>
            <h2>{s.business.name}</h2>
            <p>{[place, s.business.phone, s.business.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="receipt-no">
            <b>Receipt {receipt.receipt_no}</b>
            {receipt.revision > 1 && <span>Updated · v{receipt.revision}</span>}
            <span>{dateTime(s.order.created_at)}</span>
          </div>
        </header>
        <section className="receipt-meta">
          <div><small>Customer</small><b>{s.customer.name}</b><span>{[s.customer.phone, s.customer.email, s.customer.address].filter(Boolean).join(" · ")}</span></div>
          <div><small>Order</small><b>{s.order.reference}</b><span>{channelLabel(s.order.channel)}</span></div>
        </section>
        <table className="dash-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>
            {s.items.map((i, n) => (
              <tr key={n}><td>{i.name}{i.variant ? ` (${i.variant})` : ""}</td><td>{i.quantity}</td><td>{formatNaira(i.unit_price_kobo)}</td><td>{formatNaira(i.line_total_kobo)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>Total</td><td>{formatNaira(s.totals.total_kobo)}</td></tr>
            <tr><td colSpan={3}>Amount paid</td><td>{formatNaira(s.totals.paid_kobo)}</td></tr>
            <tr><td colSpan={3}>Outstanding balance</td><td><b>{formatNaira(s.totals.outstanding_kobo)}</b></td></tr>
          </tfoot>
        </table>
        <section>
          <small>Payments ({PAYMENT_STATUS_LABEL[s.totals.payment_status]})</small>
          {s.payments.length === 0 ? <p>No payment received yet.</p> : (
            <ul>
              {s.payments.map((p, n) => (
                <li key={n}>{dateTime(p.recorded_at)} – {formatNaira(p.amount_kobo)} by {methodLabel(p.method)}</li>
              ))}
            </ul>
          )}
        </section>
        <footer>Thank you for your purchase.</footer>
      </article>
    </>
  );
}

export default function ReceiptPage() {
  const { orderId = "" } = useParams();
  return (
    <DashboardShell seo={PAGE_META.dashboardReceipt} title="Receipt">
      {() => <ReceiptView orderId={orderId} />}
    </DashboardShell>
  );
}
