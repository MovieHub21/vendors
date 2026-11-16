import { useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { PAGE_META } from "../data/pageMeta";
import { useVendor } from "../hooks/useVendor";
import { downloadBlob } from "../lib/download";
import { supabase } from "../lib/supabase";
import { buildReportBlocks, type ReportData, type Row } from "../lib/reportContent";
import { renderReportPdf } from "../lib/reportPdf";

const PAGE_SIZE = 500;

async function readAll(table: string, storeId: string, columns: string, orderColumn: string): Promise<Row[]> {
  if (!supabase) throw new Error("The service isn't connected yet. Please try again later.");
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table as never)
      .select(columns)
      .eq("store_id", storeId)
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Couldn't export ${table.replace(/_/g, " ")}: ${error.message}`);
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function readOrderChildren(
  table: "order_items" | "order_payments",
  orderIds: string[],
  columns: string,
  orderColumn: string,
) {
  if (!supabase || !orderIds.length) return [] as Row[];
  const results: Row[] = [];
  for (let from = 0; from < orderIds.length; from += 100) {
    const ids = orderIds.slice(from, from + 100);
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in("order_id", ids)
      .order(orderColumn, { ascending: true });
    if (error) throw new Error(`Couldn't export ${table.replace(/_/g, " ")}: ${error.message}`);
    results.push(...((data ?? []) as unknown as Row[]));
  }
  return results;
}

async function loadReportData(storeId: string): Promise<ReportData> {
  const [customers, products, orders, payments, receipts] = await Promise.all([
    readAll(
      "customer_overview",
      storeId,
      "id, name, phone, email, address, created_at, order_count, total_purchases_kobo, total_paid_kobo, outstanding_kobo, last_purchase_at",
      "name",
    ),
    readAll(
      "products",
      storeId,
      "id, slug, name, description, price_kobo, category, status, is_available, stock_quantity, created_at, product_images(url, alt_text, position)",
      "created_at",
    ),
    readAll(
      "orders",
      storeId,
      "id, customer_id, reference, channel, status, total_kobo, paid_kobo, payment_status, delivery_address, notes, created_at",
      "created_at",
    ),
    readAll("order_payments", storeId, "id, order_id, amount_kobo, method, source, note, recorded_at", "recorded_at"),
    readAll("receipts", storeId, "id, order_id, receipt_no, revision, snapshot, created_at", "created_at"),
  ]);
  const items = await readOrderChildren(
    "order_items",
    orders.map((order) => order.id),
    "id, order_id, product_name, variant, unit_price_kobo, quantity, line_total_kobo",
    "order_id",
  );
  return { customers, products, orders, items, payments, receipts };
}

const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

function ExportPanel() {
  const { me } = useVendor();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ blob: Blob; filename: string; pages: number } | null>(null);

  async function exportPdf() {
    if (!me?.store || !supabase) return setError("Create your store and connect the service before exporting.");
    setBusy(true);
    setError(null);
    setReady(null);
    try {
      setStatus("Collecting your records…");
      const data = await loadReportData(me.store.id);
      let pages = 0;
      const blob = await renderReportPdf(buildReportBlocks(me.store, data), {
        footerText: `${me.store.name} · SellSharp business data export`,
        onProgress: (page, total) => {
          pages = total;
          setStatus(`Building your PDF… page ${page} of ${total}`);
        },
      });
      const filename = `${me.store.slug}-business-data-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(blob, filename); // saves the file directly. No print window.
      setReady({ blob, filename, pages });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't create the export. Please try again.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="dash-card business-export-card">
      <h2>Export your business data</h2>
      <p className="muted">
        Download a PDF with all your products, customers, orders, payment records and receipt snapshots. It is formatted
        for A4 and saved straight to your device.
      </p>
      <ul>
        <li>Every available record from this store</li>
        <li>Order details with item and payment breakdowns</li>
        <li>Customer totals, outstanding balances and contact details</li>
      </ul>
      {error && <Alert kind="error">{error}</Alert>}
      {status && (
        <p className="export-status" role="status">
          {status}
        </p>
      )}
      {ready && (
        <Alert kind="success">
          Your PDF is ready: {ready.pages} page{ready.pages === 1 ? "" : "s"}, {megabytes(ready.blob.size)}. It should
          have downloaded to your device. If it didn't, tap the button below.
        </Alert>
      )}
      <div className="export-actions">
        <button
          type="button"
          className="btn btn-primary export-pdf-btn"
          onClick={() => void exportPdf()}
          disabled={busy || !me?.store}
        >
          <Download size={22} aria-hidden="true" /> {busy ? "Preparing your PDF…" : "Download business data PDF"}
        </button>
        {ready && (
          <button
            type="button"
            className="btn btn-outline export-pdf-btn"
            onClick={() => downloadBlob(ready.blob, ready.filename)}
          >
            <Download size={22} aria-hidden="true" /> Download PDF again
          </button>
        )}
      </div>
      <p className="muted business-export-note">
        Your export contains private customer information. Store the downloaded file safely.
      </p>
    </div>
  );
}

export default function BusinessExport() {
  return (
    <DashboardShell seo={PAGE_META.dashboardExport} title="Export business data">
      {() => <ExportPanel />}
    </DashboardShell>
  );
}
