import { useState } from "react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { supabase } from "../lib/supabase";
import { useVendor } from "../hooks/useVendor";

type Row = Record<string, any>;
const PAGE_SIZE = 500;

async function readAll(table: string, storeId: string, columns: string, orderColumn: string): Promise<Row[]> {
  if (!supabase) throw new Error("The service isn't connected yet. Please try again later.");
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table as never).select(columns).eq("store_id", storeId).order(orderColumn, { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Couldn't export ${table.replace(/_/g, " ")}: ${error.message}`);
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function readOrderChildren(table: "order_items" | "order_payments", orderIds: string[], columns: string, orderColumn: string) {
  if (!supabase || !orderIds.length) return [] as Row[];
  const results: Row[] = [];
  for (let from = 0; from < orderIds.length; from += 100) {
    const ids = orderIds.slice(from, from + 100);
    const { data, error } = await supabase.from(table).select(columns).in("order_id", ids).order(orderColumn, { ascending: true });
    if (error) throw new Error(`Couldn't export ${table.replace(/_/g, " ")}: ${error.message}`);
    results.push(...((data ?? []) as unknown as Row[]));
  }
  return results;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
function amount(value: number | null | undefined) { return formatNaira(Number(value || 0)); }
function cell(value: unknown) { return `<td>${escapeHtml(value === undefined || value === null || value === "" ? "—" : value)}</td>`; }

function reportHtml(store: NonNullable<ReturnType<typeof useVendor>["me"]>["store"], data: { customers: Row[]; products: Row[]; orders: Row[]; items: Row[]; payments: Row[]; receipts: Row[] }) {
  if (!store) throw new Error("Create your store before exporting business data.");
  const { customers, products, orders, items, payments, receipts } = data;
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const itemsByOrder = new Map<string, Row[]>();
  for (const item of items) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  const paymentsByOrder = new Map<string, Row[]>();
  for (const payment of payments) paymentsByOrder.set(payment.order_id, [...(paymentsByOrder.get(payment.order_id) ?? []), payment]);
  const moneyTotal = orders.reduce((sum, order) => sum + Number(order.total_kobo || 0), 0);
  const paidTotal = orders.reduce((sum, order) => sum + Number(order.paid_kobo || 0), 0);
  const generated = new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
  const productRows = products.map((product) => `<tr><td><b>${escapeHtml(product.name)}</b><br><span class="muted">${escapeHtml(product.slug)}</span><br>${escapeHtml(product.description || "")}${product.product_images?.length ? `<br><span class="muted">Images: ${product.product_images.map((image: Row) => escapeHtml(image.url)).join(" · ")}</span>` : ""}</td>${cell(product.category)}${cell(product.status)}${cell(product.is_available ? "Available" : "Unavailable")}${cell(product.stock_quantity ?? "Not tracked")}${cell(amount(product.price_kobo))}${cell(date(product.created_at))}</tr>`).join("");
  const customerBlocks = customers.map((customer) => `<article class="customer"><h3>${escapeHtml(customer.name)} <span>${escapeHtml(date(customer.created_at))}</span></h3><div class="facts"><div><b>Phone</b>${escapeHtml(customer.phone || "—")}</div><div><b>Email</b>${escapeHtml(customer.email || "—")}</div><div><b>Address</b>${escapeHtml(customer.address || "—")}</div><div><b>Orders</b>${escapeHtml(customer.order_count ?? 0)}</div><div><b>Total purchases</b>${escapeHtml(amount(customer.total_purchases_kobo))}</div><div><b>Paid</b>${escapeHtml(amount(customer.total_paid_kobo))}</div><div><b>Outstanding</b>${escapeHtml(amount(customer.outstanding_kobo))}</div></div></article>`).join("");
  const orderSections = orders.map((order) => {
    const customer = customersById.get(order.customer_id);
    const itemRows = (itemsByOrder.get(order.id) ?? []).map((item) => `<tr>${cell(item.product_name)}${cell(item.variant)}${cell(item.quantity)}${cell(amount(item.unit_price_kobo))}${cell(amount(item.line_total_kobo))}</tr>`).join("");
    const paymentRows = (paymentsByOrder.get(order.id) ?? []).map((payment) => `<tr>${cell(date(payment.recorded_at))}${cell(payment.method)}${cell(payment.source)}${cell(amount(payment.amount_kobo))}${cell(payment.note)}</tr>`).join("");
    return `<article class="order"><h3>${escapeHtml(order.reference)} <span>${escapeHtml(date(order.created_at))}</span></h3><div class="facts"><div><b>Customer</b>${escapeHtml(customer?.name || "Customer")} · ${escapeHtml(customer?.phone || "No phone")}</div><div><b>Channel / status</b>${escapeHtml(order.channel)} · ${escapeHtml(order.status)}</div><div><b>Payment</b>${escapeHtml(order.payment_status)} · ${amount(order.paid_kobo)} paid of ${amount(order.total_kobo)}</div><div><b>Delivery address</b>${escapeHtml(order.delivery_address || "—")}</div><div><b>Notes</b>${escapeHtml(order.notes || "—")}</div></div><h4>Items</h4><table><thead><tr><th>Product</th><th>Variant</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>${itemRows || `<tr><td colspan="5">No item details recorded</td></tr>`}</tbody></table><h4>Payments</h4><table><thead><tr><th>Date</th><th>Method</th><th>Source</th><th>Amount</th><th>Note</th></tr></thead><tbody>${paymentRows || `<tr><td colspan="5">No payment recorded</td></tr>`}</tbody></table></article>`;
  }).join("");
  const receiptBlocks = receipts.map((receipt) => {
    const snapshot = receipt.snapshot || {};
    const receiptItems = (snapshot.items || []).map((item: Row) => `<tr>${cell(item.name)}${cell(item.variant)}${cell(item.quantity)}${cell(amount(item.unit_price_kobo))}${cell(amount(item.line_total_kobo))}</tr>`).join("");
    const receiptPayments = (snapshot.payments || []).map((payment: Row) => `<tr>${cell(date(payment.recorded_at))}${cell(payment.method)}${cell(amount(payment.amount_kobo))}</tr>`).join("");
    return `<article class="order"><h3>${escapeHtml(receipt.receipt_no)} · revision ${escapeHtml(receipt.revision)} <span>${escapeHtml(date(receipt.created_at))}</span></h3><p><b>Order:</b> ${escapeHtml(snapshot.order?.reference || orders.find((order) => order.id === receipt.order_id)?.reference || receipt.order_id)} · <b>Customer:</b> ${escapeHtml(snapshot.customer?.name || "—")} · <b>Business:</b> ${escapeHtml(snapshot.business?.name || store.name)}</p><h4>Items</h4><table><thead><tr><th>Product</th><th>Variant</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>${receiptItems || `<tr><td colspan="5">No item snapshot</td></tr>`}</tbody></table><p><b>Total:</b> ${escapeHtml(amount(snapshot.totals?.total_kobo))} · <b>Paid:</b> ${escapeHtml(amount(snapshot.totals?.paid_kobo))} · <b>Outstanding:</b> ${escapeHtml(amount(snapshot.totals?.outstanding_kobo))} · <b>Status:</b> ${escapeHtml(snapshot.totals?.payment_status || "—")}</p><h4>Payments</h4><table><thead><tr><th>Date</th><th>Method</th><th>Amount</th></tr></thead><tbody>${receiptPayments || `<tr><td colspan="3">No payment snapshot</td></tr>`}</tbody></table></article>`;
  }).join("");
  const socialLinks = [["Facebook", store.facebook_url], ["Instagram", store.instagram_url], ["TikTok", store.tiktok_url], ["YouTube", store.youtube_url], ["X", store.x_url], ["Threads", store.threads_url], ["Snapchat", store.snapchat_url], ["Pinterest", store.pinterest_url], ["LinkedIn", store.linkedin_url], [store.other_social_label || "Other", store.other_social_url]].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(store.name)} business data</title><style>
    @page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:10pt/1.45 Arial,sans-serif;color:#172033;margin:0}h1{font-size:25pt;margin:0 0 4mm}h2{font-size:17pt;margin:0 0 4mm;padding-bottom:2mm;border-bottom:1px solid #dce2eb;break-after:avoid}h3{font-size:12pt;margin:0 0 3mm}h4{font-size:9pt;margin:4mm 0 1.5mm;color:#566176}p{margin:1mm 0}.cover{padding:22mm 0 12mm;break-after:page}.muted{color:#687386}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:8mm 0}.stat{border:1px solid #dce2eb;border-radius:3mm;padding:4mm}.stat b{display:block;font-size:15pt;margin-top:1mm}.section{margin:0 0 10mm;break-before:page}.section.first{break-before:auto}.table-wrap{width:100%}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt;margin:2mm 0 4mm}th,td{padding:2mm;border:1px solid #dce2eb;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f2f5f9;font-weight:700}tr{break-inside:avoid}.order,.customer{padding:4mm 0;border-bottom:1px solid #ccd4e0;break-inside:avoid}.order h3,.customer h3{display:flex;justify-content:space-between}.order h3 span,.customer h3 span{font-weight:400;color:#687386;font-size:8pt}.facts{display:grid;grid-template-columns:1fr 1fr;gap:2mm 5mm}.facts b{display:block;color:#687386;font-size:7.5pt}footer{margin-top:8mm;color:#687386;font-size:8pt}.small{font-size:8pt}.toolbar{position:sticky;top:0;padding:12px;background:#172033;color:white;display:flex;justify-content:space-between;align-items:center}.toolbar button{border:0;border-radius:7px;padding:10px 16px;background:#f6c453;font-weight:700;cursor:pointer}@media print{.toolbar{display:none}.cover{padding-top:0}} 
  </style></head><body><div class="toolbar"><span>Business data export · ${escapeHtml(store.name)}</span><button onclick="window.print()">Save as PDF</button></div><section class="cover"><p class="muted">SELLSHARP · BUSINESS DATA EXPORT</p><h1>${escapeHtml(store.name)}</h1><p>${escapeHtml([store.category, store.city, store.state].filter(Boolean).join(" · "))}</p><p class="muted">Generated ${escapeHtml(generated)} · Contains all available records for this store.</p><div class="summary"><div class="stat">Products<b>${products.length}</b></div><div class="stat">Customers<b>${customers.length}</b></div><div class="stat">Orders<b>${orders.length}</b></div><div class="stat">Order value<b>${escapeHtml(amount(moneyTotal))}</b></div><div class="stat">Recorded payments<b>${escapeHtml(amount(paidTotal))}</b></div><div class="stat">Receipts<b>${receipts.length}</b></div></div><p><b>Store:</b> ${escapeHtml(store.slug)} · <b>Contact:</b> ${escapeHtml(store.contact_phone || "—")} · <b>Email:</b> ${escapeHtml(store.contact_email || "—")}</p><footer>Keep this report secure. It contains customer contact details and your business records.</footer></section>
    <section class="section first"><h2>Store profile and social links</h2><p><b>Store name:</b> ${escapeHtml(store.name)} · <b>Tagline:</b> ${escapeHtml(store.tagline || "—")} · <b>Description:</b> ${escapeHtml(store.description || "—")}</p><p><b>Layout:</b> ${escapeHtml(store.storefront_layout || "showcase")} · <b>WhatsApp:</b> ${escapeHtml(store.contact_phone || "—")} · <b>Email:</b> ${escapeHtml(store.contact_email || "—")}</p><p><b>Cover image:</b> ${escapeHtml(store.cover_url || "—")} · <b>Logo:</b> ${escapeHtml(store.logo_url || "—")}</p><h4>Follow us links</h4><ul>${socialLinks.map(([label, href]) => `<li>${escapeHtml(label)}: ${escapeHtml(href)}</li>`).join("") || "<li>No social links configured</li>"}</ul></section>
    <section class="section"><h2>Products (${products.length})</h2><table><thead><tr><th>Product details, image URLs</th><th>Category</th><th>Status</th><th>Availability</th><th>Stock</th><th>Price</th><th>Added</th></tr></thead><tbody>${productRows || `<tr><td colspan="7">No products recorded</td></tr>`}</tbody></table></section>
    <section class="section"><h2>Customers (${customers.length})</h2>${customerBlocks || `<p>No customers recorded.</p>`}</section>
    <section class="section"><h2>Orders (${orders.length})</h2>${orderSections || `<p>No orders recorded.</p>`}</section>
    <section class="section"><h2>Receipt snapshots (${receipts.length})</h2>${receiptBlocks || `<p>No receipts recorded.</p>`}<p class="muted small">Receipt details are shown from the saved snapshot for each revision.</p></section>
  </body></html>`;
}

function ExportPanel() {
  const { me } = useVendor();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function exportPdf() {
    if (!me?.store || !supabase) return setError("Create your store and connect the service before exporting.");
    const report = window.open("", "_blank");
    if (!report) return setError("Allow pop-ups for this site to open the print-ready report.");
    report.document.write("<!doctype html><title>Preparing business data…</title><p style='font:16px Arial;padding:24px'>Preparing your business data report…</p>");
    report.document.close();
    setBusy(true); setError(null); setNotice(null);
    try {
      const storeId = me.store.id;
      const [customers, products, orders, payments, receipts] = await Promise.all([
        readAll("customer_overview", storeId, "id, name, phone, email, address, created_at, order_count, total_purchases_kobo, total_paid_kobo, outstanding_kobo, last_purchase_at", "name"),
        readAll("products", storeId, "id, slug, name, description, price_kobo, category, status, is_available, stock_quantity, created_at, product_images(url, alt_text, position)", "created_at"),
        readAll("orders", storeId, "id, customer_id, reference, channel, status, total_kobo, paid_kobo, payment_status, delivery_address, notes, created_at", "created_at"),
        readAll("order_payments", storeId, "id, order_id, amount_kobo, method, source, note, recorded_at", "recorded_at"),
        readAll("receipts", storeId, "id, order_id, receipt_no, revision, snapshot, created_at", "created_at"),
      ]);
      const items = await readOrderChildren("order_items", orders.map((order) => order.id), "id, order_id, product_name, variant, unit_price_kobo, quantity, line_total_kobo", "order_id");
      report.document.open(); report.document.write(reportHtml(me.store, { customers, products, orders, items, payments, receipts })); report.document.close();
      report.document.title = `${me.store.name} business data`;
      setNotice("Your report is ready. Choose Save as PDF in the print window to download it.");
    } catch (cause) {
      report.close();
      setError(cause instanceof Error ? cause.message : "We couldn't create the export. Please try again.");
    } finally { setBusy(false); }
  }
  return <div className="dash-card business-export-card"><h2>Export your business data</h2><p className="muted">Create a print-ready report with all your products, customers, orders, payment records and receipt snapshots. The report is paginated and formatted for A4 so it stays readable when saved as a PDF.</p><ul><li>Every available record from this store</li><li>Order details with item and payment breakdowns</li><li>Customer totals, outstanding balances and contact details</li></ul>{error && <Alert kind="error">{error}</Alert>}{notice && <Alert kind="success">{notice}</Alert>}<button type="button" className="btn btn-primary" onClick={() => void exportPdf()} disabled={busy || !me?.store}>{busy ? "Preparing your report…" : "Export business data PDF"}</button><p className="muted business-export-note">Your export contains private customer information. Store the downloaded file safely.</p></div>;
}

export default function BusinessExport() {
  return <DashboardShell seo={PAGE_META.dashboardExport} title="Export business data">{() => <ExportPanel />}</DashboardShell>;
}
