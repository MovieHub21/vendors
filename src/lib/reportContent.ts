import { formatNaira } from "./money";
import type { Block } from "./reportLayout";

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface ReportData {
  customers: Row[];
  products: Row[];
  orders: Row[];
  items: Row[];
  payments: Row[];
  receipts: Row[];
}

const dash = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : String(v));
const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
const money = (v: number | null | undefined) => formatNaira(Number(v || 0));

/** Turns a store's records into the blocks of the PDF. Everything the old print report contained is still here. */
export function buildReportBlocks(store: Row, data: ReportData, now = new Date()): Block[] {
  const { customers, products, orders, items, payments, receipts } = data;
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const itemsByOrder = new Map<string, Row[]>();
  for (const item of items) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  const paymentsByOrder = new Map<string, Row[]>();
  for (const payment of payments)
    paymentsByOrder.set(payment.order_id, [...(paymentsByOrder.get(payment.order_id) ?? []), payment]);

  const orderValue = orders.reduce((sum, o) => sum + Number(o.total_kobo || 0), 0);
  const paidValue = orders.reduce((sum, o) => sum + Number(o.paid_kobo || 0), 0);
  const generated = now.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  const social = [
    ["Facebook", store.facebook_url],
    ["Instagram", store.instagram_url],
    ["TikTok", store.tiktok_url],
    ["YouTube", store.youtube_url],
    ["X", store.x_url],
    ["Threads", store.threads_url],
    ["Snapchat", store.snapchat_url],
    ["Pinterest", store.pinterest_url],
    ["LinkedIn", store.linkedin_url],
    [store.other_social_label || "Other", store.other_social_url],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const blocks: Block[] = [
    {
      type: "title",
      eyebrow: "SELLSHARP · BUSINESS DATA EXPORT",
      title: store.name,
      subtitle: [store.category, store.city, store.state].filter(Boolean).join(" · "),
      meta: `Generated ${generated} · Contains all available records for this store.`,
    },
    {
      type: "stats",
      items: [
        { label: "Products", value: String(products.length) },
        { label: "Customers", value: String(customers.length) },
        { label: "Orders", value: String(orders.length) },
        { label: "Order value", value: money(orderValue) },
        { label: "Recorded payments", value: money(paidValue) },
        { label: "Receipts", value: String(receipts.length) },
      ],
    },
    {
      type: "text",
      text: `Store: ${store.slug} · Contact: ${dash(store.contact_phone)} · Email: ${dash(store.contact_email)}`,
    },
    {
      type: "text",
      small: true,
      muted: true,
      text: "Keep this report secure. It contains customer contact details and your business records.",
    },

    { type: "h2", text: "Store profile and social links", pageBreak: true },
    { type: "text", text: `Store name: ${store.name} · Tagline: ${dash(store.tagline)}` },
    { type: "text", text: `Description: ${dash(store.description)}` },
    {
      type: "text",
      text: `Layout: ${store.storefront_layout || "showcase"} · WhatsApp: ${dash(store.contact_phone)} · Email: ${dash(store.contact_email)}`,
    },
    {
      type: "text",
      small: true,
      muted: true,
      text: `Cover image: ${dash(store.cover_url)} · Logo: ${dash(store.logo_url)}`,
    },
    { type: "h4", text: "Follow us links" },
    {
      type: "text",
      text: social.length
        ? social.map(([label, href]) => `${label}: ${href}`).join("\n")
        : "No social links configured",
    },

    { type: "h2", text: `Products (${products.length})`, pageBreak: true },
    {
      type: "table",
      columns: [
        { label: "Product details and image links", weight: 4.2 },
        { label: "Category", weight: 1.3 },
        { label: "Status", weight: 1.1 },
        { label: "Availability", weight: 1.3 },
        { label: "Stock", weight: 1 },
        { label: "Price", weight: 1.4, align: "right" },
        { label: "Added", weight: 1.6 },
      ],
      emptyText: "No products recorded",
      rows: products.map((p) =>
        [
          [
            p.name,
            p.slug,
            p.description,
            p.product_images?.length ? `Images: ${p.product_images.map((i: Row) => i.url).join(" · ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          dash(p.category),
          dash(p.status),
          p.is_available ? "Available" : "Unavailable",
          p.stock_quantity ?? "Not tracked",
          money(p.price_kobo),
          date(p.created_at),
        ].map(String),
      ),
    },

    { type: "h2", text: `Customers (${customers.length})`, pageBreak: true },
    ...(customers.length
      ? customers.map((c): Block => ({
          type: "group",
          blocks: [
            { type: "h3", left: dash(c.name), right: date(c.created_at) },
            {
              type: "facts",
              items: [
                { label: "Phone", value: dash(c.phone) },
                { label: "Email", value: dash(c.email) },
                { label: "Address", value: dash(c.address) },
                { label: "Orders", value: String(c.order_count ?? 0) },
                { label: "Total purchases", value: money(c.total_purchases_kobo) },
                { label: "Paid", value: money(c.total_paid_kobo) },
                { label: "Outstanding", value: money(c.outstanding_kobo) },
              ],
            },
          ],
        }))
      : [{ type: "text", text: "No customers recorded." } as Block]),

    { type: "h2", text: `Orders (${orders.length})`, pageBreak: true },
    ...(orders.length
      ? orders.map((o): Block => {
          const customer = customersById.get(o.customer_id);
          return {
            type: "group",
            blocks: [
              { type: "h3", left: dash(o.reference), right: date(o.created_at) },
              {
                type: "facts",
                items: [
                  { label: "Customer", value: `${customer?.name || "Customer"} · ${customer?.phone || "No phone"}` },
                  { label: "Channel / status", value: `${dash(o.channel)} · ${dash(o.status)}` },
                  {
                    label: "Payment",
                    value: `${dash(o.payment_status)} · ${money(o.paid_kobo)} paid of ${money(o.total_kobo)}`,
                  },
                  { label: "Delivery address", value: dash(o.delivery_address) },
                  { label: "Notes", value: dash(o.notes) },
                ],
              },
              { type: "h4", text: "Items" },
              {
                type: "table",
                columns: [
                  { label: "Product", weight: 3 },
                  { label: "Variant", weight: 1.6 },
                  { label: "Qty", weight: 0.8, align: "right" },
                  { label: "Unit price", weight: 1.6, align: "right" },
                  { label: "Line total", weight: 1.7, align: "right" },
                ],
                emptyText: "No item details recorded",
                rows: (itemsByOrder.get(o.id) ?? []).map((i) => [
                  dash(i.product_name),
                  dash(i.variant),
                  String(i.quantity ?? ""),
                  money(i.unit_price_kobo),
                  money(i.line_total_kobo),
                ]),
              },
              { type: "h4", text: "Payments" },
              {
                type: "table",
                columns: [
                  { label: "Date", weight: 2 },
                  { label: "Method", weight: 1.4 },
                  { label: "Source", weight: 1.4 },
                  { label: "Amount", weight: 1.5, align: "right" },
                  { label: "Note", weight: 2.2 },
                ],
                emptyText: "No payment recorded",
                rows: (paymentsByOrder.get(o.id) ?? []).map((p) => [
                  date(p.recorded_at),
                  dash(p.method),
                  dash(p.source),
                  money(p.amount_kobo),
                  dash(p.note),
                ]),
              },
            ],
          };
        })
      : [{ type: "text", text: "No orders recorded." } as Block]),

    { type: "h2", text: `Receipt snapshots (${receipts.length})`, pageBreak: true },
    ...(receipts.length
      ? receipts.map((r): Block => {
          const snap = r.snapshot || {};
          return {
            type: "group",
            blocks: [
              { type: "h3", left: `${dash(r.receipt_no)} · revision ${dash(r.revision)}`, right: date(r.created_at) },
              {
                type: "text",
                text: `Order: ${snap.order?.reference || orders.find((o) => o.id === r.order_id)?.reference || r.order_id} · Customer: ${dash(snap.customer?.name)} · Business: ${snap.business?.name || store.name}`,
              },
              { type: "h4", text: "Items" },
              {
                type: "table",
                columns: [
                  { label: "Product", weight: 3 },
                  { label: "Variant", weight: 1.6 },
                  { label: "Qty", weight: 0.8, align: "right" },
                  { label: "Unit price", weight: 1.6, align: "right" },
                  { label: "Line total", weight: 1.7, align: "right" },
                ],
                emptyText: "No item snapshot",
                rows: (snap.items || []).map((i: Row) => [
                  dash(i.name),
                  dash(i.variant),
                  String(i.quantity ?? ""),
                  money(i.unit_price_kobo),
                  money(i.line_total_kobo),
                ]),
              },
              {
                type: "text",
                text: `Total: ${money(snap.totals?.total_kobo)} · Paid: ${money(snap.totals?.paid_kobo)} · Outstanding: ${money(snap.totals?.outstanding_kobo)} · Status: ${dash(snap.totals?.payment_status)}`,
              },
              { type: "h4", text: "Payments" },
              {
                type: "table",
                columns: [
                  { label: "Date", weight: 2.4 },
                  { label: "Method", weight: 1.6 },
                  { label: "Amount", weight: 1.6, align: "right" },
                ],
                emptyText: "No payment snapshot",
                rows: (snap.payments || []).map((p: Row) => [
                  date(p.recorded_at),
                  dash(p.method),
                  money(p.amount_kobo),
                ]),
              },
            ],
          };
        })
      : [{ type: "text", text: "No receipts recorded." } as Block]),
    {
      type: "text",
      small: true,
      muted: true,
      text: "Receipt details are shown from the saved snapshot for each revision.",
    },
  ];
  // A little air after every customer / order / receipt card.
  return blocks.map((block): Block =>
    block.type === "group" ? { ...block, blocks: [...block.blocks, { type: "gap", px: 26 }] } : block,
  );
}
