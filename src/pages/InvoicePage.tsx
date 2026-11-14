import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Receipt as ReceiptIcon } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { DocumentActions } from "../components/DocumentActions";
import { DocumentView } from "../components/DocumentView";
import { PAGE_META } from "../data/pageMeta";
import { invoiceDoc, invoiceText } from "../lib/docContent";
import { createDocumentPdf } from "../lib/docPdf";
import { builtInTemplate, getInvoice, loadTemplate, type InvoiceRecord, type StoredTemplate } from "../services/documents";

function InvoiceView({ orderId }: { orderId: string }) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [design, setDesign] = useState<StoredTemplate | null>(null);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getInvoice(orderId), loadTemplate("invoice")]).then(([i, t]) => {
      if (cancelled) return;
      if (!i.ok) {
        setProblem({ code: i.code, message: i.message });
        return;
      }
      setInvoice(i.data.invoice);
      setDesign(t.ok ? t.data : builtInTemplate("invoice"));
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const doc = useMemo(() => (invoice ? invoiceDoc(invoice.snapshot, invoice.invoice_no, invoice.issued_at, invoice.bank) : null), [invoice]);

  if (problem) {
    return (
      <>
        <Alert kind="error">{problem.message}</Alert>
        <div className="receipt-actions no-print">
          {problem.code === "order_paid" && (
            <Link className="btn btn-primary" to={`/dashboard/receipt/${orderId}`}>
              <ReceiptIcon size={16} aria-hidden="true" /> Open receipt
            </Link>
          )}
          <Link className="btn btn-outline" to={`/dashboard/orders?o=${orderId}`}>Back to order</Link>
        </div>
      </>
    );
  }
  if (!invoice || !design || !doc) return <p className="auth-loading">Preparing invoice…</p>;
  const s = invoice.snapshot;

  return (
    <>
      {!invoice.bank && (
        <Alert kind="info">
          Your invoice doesn't show where to pay yet. <Link to="/dashboard/templates#payment">Add your account details</Link> and they will appear on every invoice.
        </Alert>
      )}
      <DocumentActions
        filename={`invoice-${invoice.invoice_no}.pdf`}
        makePdf={() => createDocumentPdf(doc, design.template)}
        shareTitle={`Invoice ${invoice.invoice_no}`}
        shareText={invoiceText(doc)}
        whatsappMessage={invoiceText(doc)}
        customerPhone={s.customer.phone}
        backTo={`/dashboard/orders?o=${orderId}`}
        backLabel="Back to order"
      />
      <article className="doc-page" aria-label={`Invoice ${invoice.invoice_no}`}>
        <DocumentView template={design.template} css={design.css} doc={doc} />
      </article>
      <p className="muted no-print doc-design-link">
        <Link to="/dashboard/templates">Change how your invoices look</Link> · The balance updates each time you open this page.
      </p>
    </>
  );
}

export default function InvoicePage() {
  const { orderId = "" } = useParams();
  return (
    <DashboardShell seo={PAGE_META.dashboardInvoice} title="Invoice">
      {() => <InvoiceView orderId={orderId} />}
    </DashboardShell>
  );
}
