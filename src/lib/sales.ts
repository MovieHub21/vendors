/**
 * Display helpers for orders, sales and payments. Money is integer kobo everywhere.
 * Nothing here decides a total, a balance or a payment status: the database does (supabase/migrations/…0600_sales.sql).
 * These helpers only format values, parse what a vendor types, and build WhatsApp links.
 */
import { formatNaira } from "./money";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export const CHANNELS = [
  { value: "walk_in", label: "Walk-in" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "store", label: "SellSharp Store" },
  { value: "other", label: "Other" },
] as const;
export type Channel = (typeof CHANNELS)[number]["value"];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "pos", label: "POS" },
  { value: "other", label: "Other" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];
export type PaymentStatus = "unpaid" | "partial" | "paid";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { unpaid: "Unpaid", partial: "Part-paid", paid: "Paid" };

const find = <T extends { value: string; label: string }>(list: readonly T[], value: string) =>
  list.find((x) => x.value === value)?.label ?? value;
export const channelLabel = (v: string) => find(CHANNELS, v);
export const methodLabel = (v: string) => (v === "paystack" ? "Paystack" : find(PAYMENT_METHODS, v));
export const statusLabel = (v: string) => find(ORDER_STATUSES, v);

/** Statuses that mean "the vendor still has something to do". Used for the dashboard shortcuts and filters. */
export const AWAITING_DELIVERY: readonly OrderStatus[] = ["confirmed", "processing", "ready_for_pickup", "shipped"];

/**
 * "75,000" / "₦75000.50" / "75000" → kobo (7500000), or null if it isn't a valid amount.
 * Parsed from text, never through floating point, so ₦0.10 + ₦0.20 style errors can't creep in.
 */
export function nairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const kobo = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return Number.isSafeInteger(kobo) && kobo <= 10_000_000_000 ? kobo : null;
}

/** Kobo → what goes back into an amount box ("25000" or "25000.50"). */
export const koboToInput = (kobo: number): string => (kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2));

/** Preview shown while the vendor types. The saved figures always come from the server. */
export function previewSale(lines: { quantity: number; unitKobo: number }[], paidKobo: number) {
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitKobo, 0);
  return { total, paid: paidKobo, outstanding: total - paidKobo };
}

/** Normalize local or international numbers to the digits WhatsApp expects after wa.me/. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, raw.startsWith("+") ? undefined : "NG");
  if (parsed?.isPossible()) return `${parsed.countryCallingCode}${parsed.nationalNumber}`;
  const digits = raw.replace(/\D/g, "");
  if (digits && !digits.startsWith("0")) {
    const international = parsePhoneNumberFromString(`+${digits}`);
    if (international?.isPossible()) return `${international.countryCallingCode}${international.nationalNumber}`;
  }
  return null;
}

/** https://wa.me/<number>?text=… to message one person, or https://wa.me/?text=… to pick a contact in WhatsApp. */
export function whatsappLink(message: string, phone?: string | null): string {
  const n = whatsappNumber(phone);
  return n
    ? `https://wa.me/${n}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export const productShareMessage = (name: string, priceKobo: number, url: string) =>
  `${name} – ${formatNaira(priceKobo)}\nOrder here: ${url}`;

export const storeShareMessage = (storeName: string, url: string) => `Shop at ${storeName}: ${url}`;

export interface ReceiptSnapshot {
  business: { name: string; logo_url: string | null; phone: string | null; email: string | null; city: string | null; state: string | null; slug: string };
  customer: { name: string; phone: string | null; email: string | null; address: string | null };
  order: { reference: string; channel: string; status: string; created_at: string };
  items: { name: string; variant: string | null; quantity: number; unit_price_kobo: number; line_total_kobo: number }[];
  totals: { total_kobo: number; paid_kobo: number; outstanding_kobo: number; payment_status: PaymentStatus };
  payments: { amount_kobo: number; method: string; source: "manual" | "paystack"; recorded_at: string }[];
  issued_at: string;
}

/** Plain-text receipt for WhatsApp. Receipts are private, so they are shared as text rather than as a public link. */
export function receiptText(receiptNo: string, revision: number, s: ReceiptSnapshot): string {
  const lines = s.items.map(
    (i) => `• ${i.name}${i.variant ? ` (${i.variant})` : ""} × ${i.quantity} – ${formatNaira(i.line_total_kobo)}`,
  );
  const owing = s.totals.outstanding_kobo > 0 ? [`Balance: ${formatNaira(s.totals.outstanding_kobo)}`] : ["Fully paid. Thank you!"];
  return [
    `${s.business.name} – Receipt ${receiptNo}${revision > 1 ? ` (updated)` : ""}`,
    `Hello ${s.customer.name}, here is your receipt for order ${s.order.reference}:`,
    ...lines,
    `Total: ${formatNaira(s.totals.total_kobo)}`,
    `Paid: ${formatNaira(s.totals.paid_kobo)}`,
    ...owing,
  ].join("\n");
}
