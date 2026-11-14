/**
 * What goes inside each block of a receipt or invoice. The screen renderer (DocumentView) and the PDF renderer
 * (docPdf) both read from here, so they always say the same thing; only how it is drawn differs.
 */
import type { Block, DocKind } from "./docTemplate";
import { formatNaira } from "./money";
import { channelLabel, methodLabel, PAYMENT_STATUS_LABEL, type ReceiptSnapshot } from "./sales";

export interface BankDetails {
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  extra_note: string | null;
}

export interface DocData {
  kind: DocKind;
  /** RC-000012 for receipts, INV-<order reference> for invoices. */
  number: string;
  revision: number;
  issuedAt: string;
  snapshot: ReceiptSnapshot;
  bank: BankDetails | null;
}

export type Tone = "normal" | "strong" | "muted" | "label";
export interface Line {
  text: string;
  tone: Tone;
}

const dateShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateLong = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const join = (parts: (string | null | undefined)[], sep: string) => parts.filter(Boolean).join(sep);

export const locationOf = (s: ReceiptSnapshot) => join([s.business.city, s.business.state], ", ");

// ------------------------------------------------------------------ {{tags}} for free text

export const TAGS = [
  ["store_name", "Store name"],
  ["store_location", "City, State"],
  ["customer_name", "Customer name"],
  ["order_ref", "Order reference"],
  ["doc_number", "Receipt / invoice number"],
  ["date", "Date"],
  ["total", "Total"],
  ["paid", "Amount paid"],
  ["balance", "Balance"],
  ["bank_name", "Bank name"],
  ["account_name", "Account name"],
  ["account_number", "Account number"],
] as const;

function tagValues(doc: DocData): Record<string, string> {
  const { snapshot: s, bank } = doc;
  return {
    store_name: s.business.name,
    store_location: locationOf(s),
    customer_name: s.customer.name,
    order_ref: s.order.reference,
    doc_number: doc.number,
    date: dateLong(doc.kind === "invoice" ? doc.issuedAt : s.order.created_at),
    total: formatNaira(s.totals.total_kobo),
    paid: formatNaira(s.totals.paid_kobo),
    balance: formatNaira(s.totals.outstanding_kobo),
    bank_name: bank?.bank_name ?? "",
    account_name: bank?.account_name ?? "",
    account_number: bank?.account_number ?? "",
  };
}

/** Swaps {{customer_name}}, {{balance}} and the other known tags for real values. Unknown tags are left as typed. */
export function fillTags(text: string, doc: DocData): string {
  const values = tagValues(doc);
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

// ------------------------------------------------------------------ block content

const label = (text: string): Line => ({ text: text.toUpperCase(), tone: "label" });
const defaultTitle = (kind: DocKind) => (kind === "invoice" ? "INVOICE" : "PAYMENT RECEIPT");

/** Lines for the text-like blocks. Returns [] for blocks that draw something else (brand, table, totals, ...). */
export function textLines(block: Block, doc: DocData): Line[] {
  const { snapshot: s } = doc;
  const heading = block.text?.trim();
  switch (block.type) {
    case "store": {
      const lines: Line[] = [{ text: s.business.name, tone: "strong" }];
      const place = locationOf(s);
      if (place) lines.push({ text: place, tone: "normal" });
      const contact = join([s.business.phone, s.business.email], " · ");
      if (contact) lines.push({ text: contact, tone: "muted" });
      return lines;
    }
    case "title": {
      const lines: Line[] = [label(heading || defaultTitle(doc.kind)), { text: `No. ${doc.number}`, tone: "strong" }];
      if (doc.kind === "invoice") {
        lines.push({ text: `Issued ${dateShort(doc.issuedAt)} · ${PAYMENT_STATUS_LABEL[s.totals.payment_status]}`, tone: "muted" });
      } else {
        lines.push({ text: doc.revision > 1 ? `Updated · v${doc.revision}` : "Original", tone: "muted" });
      }
      return lines;
    }
    case "order":
      return [
        label(heading || "Order details"),
        { text: s.order.reference, tone: "strong" },
        { text: `${channelLabel(s.order.channel)} · ${dateShort(s.order.created_at)}`, tone: "muted" },
      ];
    case "customer": {
      const lines: Line[] = [label(heading || "Billed to"), { text: s.customer.name, tone: "strong" }];
      const contact = join([s.customer.phone, s.customer.email], " · ");
      if (contact) lines.push({ text: contact, tone: "muted" });
      if (s.customer.address) lines.push({ text: s.customer.address, tone: "muted" });
      return lines;
    }
    case "bank": {
      const b = doc.bank;
      if (!b) return [];
      const lines: Line[] = [];
      if (b.bank_name) lines.push({ text: b.bank_name, tone: "strong" });
      if (b.account_name) lines.push({ text: `Account name: ${b.account_name}`, tone: "normal" });
      if (b.account_number) lines.push({ text: `Account number: ${b.account_number}`, tone: "strong" });
      if (b.extra_note) lines.push({ text: b.extra_note, tone: "muted" });
      return lines.length ? [label(heading || "Pay to"), ...lines] : [];
    }
    case "text":
      return fillTags(block.text ?? "", doc)
        .split("\n")
        .map((text) => ({ text, tone: "normal" as const }));
    default:
      return [];
  }
}

export interface ItemRow {
  name: string;
  qty: string;
  price: string;
  amount: string;
}
export const ITEM_HEADERS = { name: "Item", qty: "Qty", price: "Price", amount: "Amount" } as const;

export function itemRows(doc: DocData): ItemRow[] {
  return doc.snapshot.items.map((i) => ({
    name: `${i.name}${i.variant ? ` (${i.variant})` : ""}`,
    qty: String(i.quantity),
    price: formatNaira(i.unit_price_kobo),
    amount: formatNaira(i.line_total_kobo),
  }));
}

export interface TotalRow {
  label: string;
  amount: string;
  strong: boolean;
}
export function totalRows(doc: DocData): TotalRow[] {
  const t = doc.snapshot.totals;
  const invoice = doc.kind === "invoice";
  return [
    { label: "Total", amount: formatNaira(t.total_kobo), strong: true },
    { label: invoice ? "Paid so far" : "Amount paid", amount: formatNaira(t.paid_kobo), strong: false },
    { label: invoice ? "Balance due" : "Outstanding balance", amount: formatNaira(t.outstanding_kobo), strong: true },
  ];
}

export interface PaymentsContent {
  heading: string;
  rows: { left: string; right: string }[];
  empty: string | null;
}
export function paymentsContent(block: Block, doc: DocData): PaymentsContent {
  const { payments, totals } = doc.snapshot;
  return {
    heading: (block.text?.trim() || `Payments · ${PAYMENT_STATUS_LABEL[totals.payment_status]}`).toUpperCase(),
    rows: payments.map((p) => ({ left: `${dateShort(p.recorded_at)} · ${methodLabel(p.method)}`, right: formatNaira(p.amount_kobo) })),
    empty: payments.length === 0 ? "No payment received yet." : null,
  };
}

// ------------------------------------------------------------------ building a DocData

export function receiptDoc(snapshot: ReceiptSnapshot, receiptNo: string, revision: number, issuedAt = snapshot.issued_at): DocData {
  return { kind: "receipt", number: receiptNo, revision, issuedAt, snapshot, bank: null };
}

export function invoiceDoc(snapshot: ReceiptSnapshot, invoiceNo: string, issuedAt: string, bank: BankDetails | null): DocData {
  return { kind: "invoice", number: invoiceNo, revision: 1, issuedAt, snapshot, bank };
}

/** Plain-text invoice for WhatsApp, including where to pay. */
export function invoiceText(doc: DocData): string {
  const s = doc.snapshot;
  const lines = s.items.map((i) => `• ${i.name}${i.variant ? ` (${i.variant})` : ""} × ${i.quantity} – ${formatNaira(i.line_total_kobo)}`);
  const pay = textLines({ id: "x", type: "bank", x: 0, y: 0, w: 1, h: 1, style: {} }, doc)
    .filter((l) => l.tone !== "label")
    .map((l) => l.text);
  return [
    `${s.business.name} – Invoice ${doc.number}`,
    `Hello ${s.customer.name}, here is your invoice for order ${s.order.reference}:`,
    ...lines,
    `Total: ${formatNaira(s.totals.total_kobo)}`,
    `Paid: ${formatNaira(s.totals.paid_kobo)}`,
    `Balance due: ${formatNaira(s.totals.outstanding_kobo)}`,
    ...(pay.length ? ["", "Pay to:", ...pay] : []),
  ].join("\n");
}

/** Made-up order used by the designer so vendors see a realistic page while they work. */
export function sampleDoc(kind: DocKind, bank: BankDetails | null): DocData {
  const now = new Date().toISOString();
  const unpaid = kind === "invoice";
  const snapshot: ReceiptSnapshot = {
    business: { name: "Your Store Name", logo_url: null, phone: "0801 234 5678", email: "hello@yourstore.ng", city: "Uromi", state: "Edo", slug: "your-store" },
    customer: { name: "Ada Okafor", phone: "0803 555 0101", email: null, address: "12 Market Road, Benin City" },
    order: { reference: "SS-1042", channel: "whatsapp", status: "confirmed", created_at: now },
    items: [
      { name: "Wireless Earbuds Pro", variant: "Black", quantity: 1, unit_price_kobo: 3_750_000, line_total_kobo: 3_750_000 },
      { name: "Phone Case", variant: null, quantity: 2, unit_price_kobo: 350_000, line_total_kobo: 700_000 },
      { name: "Fast Charger 30W", variant: null, quantity: 1, unit_price_kobo: 450_000, line_total_kobo: 450_000 },
    ],
    totals: unpaid
      ? { total_kobo: 4_900_000, paid_kobo: 1_000_000, outstanding_kobo: 3_900_000, payment_status: "partial" }
      : { total_kobo: 4_900_000, paid_kobo: 4_900_000, outstanding_kobo: 0, payment_status: "paid" },
    payments: unpaid
      ? [{ amount_kobo: 1_000_000, method: "bank_transfer", source: "manual", recorded_at: now }]
      : [
          { amount_kobo: 2_000_000, method: "bank_transfer", source: "manual", recorded_at: now },
          { amount_kobo: 2_900_000, method: "cash", source: "manual", recorded_at: now },
        ],
    issued_at: now,
  };
  const sampleBank: BankDetails = bank ?? { bank_name: "Your Bank", account_name: "Your Store Name", account_number: "0123456789", extra_note: "Use your order number as the narration." };
  return kind === "invoice" ? invoiceDoc(snapshot, "INV-SS-1042", now, sampleBank) : receiptDoc(snapshot, "RC-000042", 1, now);
}
