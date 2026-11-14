import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { DocumentActions } from "../components/DocumentActions";
import { DocumentView } from "../components/DocumentView";
import { PAGE_META } from "../data/pageMeta";
import { receiptDoc } from "../lib/docContent";
import { createDocumentPdf } from "../lib/docPdf";
import { getReceipt, type Receipt } from "../services/sales";
import { builtInTemplate, loadTemplate, type StoredTemplate } from "../services/documents";

function ReceiptView({ orderId }: { orderId: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [design, setDesign] = useState<StoredTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getReceipt(orderId), loadTemplate("receipt")]).then(([r, t]) => {
      if (cancelled) return;
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setReceipt(r.data.receipt);
      // If the vendor's design can't be loaded for any reason, the built-in design still gives a correct receipt.
      setDesign(t.ok ? t.data : builtInTemplate("receipt"));
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const doc = useMemo(() => (receipt ? receiptDoc(receipt.snapshot, receipt.receipt_no, receipt.revision, receipt.created_at) : null), [receipt]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!receipt || !design || !doc) return <p className="auth-loading">Preparing receipt…</p>;
  const s = receipt.snapshot;
  const filename = `receipt-${receipt.receipt_no}${receipt.revision > 1 ? `-v${receipt.revision}` : ""}.pdf`;

  return (
    <>
      <DocumentActions
        filename={filename}
        makePdf={() => createDocumentPdf(doc, design.template)}
        shareTitle={`Receipt ${receipt.receipt_no}`}
        shareText={`Receipt from ${s.business.name}`}
        whatsappMessage={`Hi ${s.customer.name}, here is your receipt PDF for order ${s.order.reference}.`}
        customerPhone={s.customer.phone}
        backTo={`/dashboard/orders?o=${orderId}`}
        backLabel="Back to order"
        extra={
          s.totals.outstanding_kobo > 0 && s.order.status !== "cancelled" ? (
            <Link className="btn btn-outline" to={`/dashboard/invoice/${orderId}`}>
              <FileText size={16} aria-hidden="true" /> Create invoice
            </Link>
          ) : null
        }
      />
      {receipt.revision > 1 && (
        <p className="muted no-print">This is an updated receipt (version {receipt.revision}) reflecting payments recorded since the first one. Earlier versions are kept.</p>
      )}
      <article className="doc-page" aria-label={`Receipt ${receipt.receipt_no}`}>
        <DocumentView template={design.template} css={design.css} doc={doc} />
      </article>
      <p className="muted no-print doc-design-link">
        <Link to="/dashboard/templates">Change how your receipts look</Link>
      </p>
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
