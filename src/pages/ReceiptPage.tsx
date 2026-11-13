import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell, dateTime } from "../components/DashboardShell";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { channelLabel, methodLabel, PAYMENT_STATUS_LABEL, whatsappLink } from "../lib/sales";
import { createReceiptPdf } from "../lib/receiptPdf";
import { getReceipt, type Receipt } from "../services/sales";

function ReceiptView({ orderId }: { orderId: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareFallback, setShareFallback] = useState<string | null>(null);
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
  const filename = `receipt-${receipt.receipt_no}${receipt.revision > 1 ? `-v${receipt.revision}` : ""}.pdf`;
  const downloadPdf = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const saveAsPdf = () => {
    downloadPdf(createReceiptPdf(s, receipt.receipt_no, receipt.revision));
  };
  const sharePdf = async () => {
    const blob = createReceiptPdf(s, receipt.receipt_no, receipt.revision);
    const file = new File([blob], filename, { type: "application/pdf" });
    const shareApi = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
    };
    if (shareApi.share && shareApi.canShare?.({ files: [file] })) {
      try {
        await shareApi.share({ files: [file], title: `Receipt ${receipt.receipt_no}`, text: `Receipt from ${s.business.name}` });
        setShareFallback(null);
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        downloadPdf(blob);
        setShareFallback(whatsappLink(`Hi ${s.customer.name}, here is your receipt PDF for order ${s.order.reference}.`, s.customer.phone));
      }
      return;
    }
    downloadPdf(blob);
    setShareFallback(whatsappLink(`Hi ${s.customer.name}, here is your receipt PDF for order ${s.order.reference}.`, s.customer.phone));
  };

  return (
    <>
      <div className="receipt-actions no-print">
        <button className="btn btn-primary" onClick={saveAsPdf}>Save as PDF</button>
        <button className="btn btn-outline" onClick={() => void sharePdf()}>
          <MessageCircle size={16} aria-hidden="true" /> Share PDF on WhatsApp
        </button>
        <Link className="btn btn-outline" to={`/dashboard/orders?o=${orderId}`}>Back to order</Link>
      </div>
      {shareFallback && (
        <p className="receipt-share-fallback no-print" role="status">
          The PDF is saved to your device. Open WhatsApp and attach <b>{filename}</b> to send it.
          <a href={shareFallback} target="_blank" rel="noopener noreferrer"> Open WhatsApp</a>
        </p>
      )}
      {receipt.revision > 1 && <p className="muted no-print">This is an updated receipt (version {receipt.revision}) reflecting payments recorded since the first one. Earlier versions are kept.</p>}
      <article className="receipt receipt-document" aria-label={`Receipt ${receipt.receipt_no}`}>
        <header className="receipt-header">
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
        <table className="dash-table receipt-table">
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
        <section className="receipt-payment-section">
          <small>Payments ({PAYMENT_STATUS_LABEL[s.totals.payment_status]})</small>
          {s.payments.length === 0 ? <p>No payment received yet.</p> : (
            <ul>
              {s.payments.map((p, n) => (
                <li key={n}>{dateTime(p.recorded_at)} – {formatNaira(p.amount_kobo)} by {methodLabel(p.method)}</li>
              ))}
            </ul>
          )}
        </section>
        <footer className="receipt-thanks">Thank you for your purchase.</footer>
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
