/**
 * Input validation for orders, sales and payments, and the mapping from database errors to HTTP errors.
 * Pure (no Deno APIs) so it is unit-tested in Node. Money is always integer kobo.
 * The database re-checks everything that matters (prices, stock, balances); this layer rejects bad input early
 * and keeps error messages friendly.
 */
import { HttpError } from "./http.ts";
import { cleanPhone, cleanText } from "./seoFields.ts";

export const CHANNELS = ["store", "whatsapp", "instagram", "facebook", "walk_in", "other"] as const;
export const MANUAL_METHODS = ["cash", "bank_transfer", "pos", "other"] as const;
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready_for_pickup",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type Channel = (typeof CHANNELS)[number];
export type PaymentMethod = (typeof MANUAL_METHODS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MAX_KOBO = 10_000_000_000; // ₦100,000,000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

export function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(422, "invalid_input", `${field} is not valid`);
  return value.toLowerCase();
}

/** Whole kobo, 0 … ₦100,000,000. JSON numbers only (a string like "5000" is refused). */
export function kobo(value: unknown, field: string, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > MAX_KOBO) {
    throw new HttpError(422, "invalid_input", `${field} must be a whole amount in kobo`);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new HttpError(422, "invalid_input", `${field} is not valid`);
  }
  return value as T;
}

export interface CustomerInput {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export function parseCustomer(raw: unknown, { phoneRequired }: { phoneRequired: boolean }): CustomerInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new HttpError(422, "invalid_customer", "Customer details are required");
  }
  const c = raw as Record<string, unknown>;
  const name = cleanText(c.name, "Name", 120, 2);
  if (name === null) throw new HttpError(422, "invalid_customer", "Customer name is required");
  const phone = cleanPhone(c.phone, "Phone number");
  if (phoneRequired && phone === null) throw new HttpError(422, "invalid_customer", "A phone number is required");
  if (phone !== null && phone.replace(/\D/g, "").length < 7) {
    throw new HttpError(422, "invalid_customer", "Phone number is too short");
  }
  const email = cleanText(c.email, "Email", 120);
  if (email !== null && !EMAIL.test(email)) throw new HttpError(422, "invalid_input", "Email must be a valid address");
  return { name, phone, email, address: cleanText(c.address, "Address", 300) };
}

export interface LineItem {
  product_id?: string;
  name?: string;
  variant?: string;
  quantity: number;
  unit_price_kobo?: number;
}

/**
 * mode "public": catalogue products only; any price in the request is DROPPED (the database uses its own price).
 * mode "vendor": catalogue product (optional price override) or a custom line (name + price).
 */
export function parseItems(raw: unknown, mode: "public" | "vendor"): LineItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(422, "no_items", "Add at least one product");
  if (raw.length > 50) throw new HttpError(422, "too_many_items", "A sale can have at most 50 lines");
  return raw.map((r, i) => {
    if (typeof r !== "object" || r === null || Array.isArray(r)) throw new HttpError(422, "invalid_item", `Item ${i + 1} is not valid`);
    const it = r as Record<string, unknown>;
    const quantity = it.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
      throw new HttpError(422, "invalid_item", `Item ${i + 1}: quantity must be a whole number from 1 to 10,000`);
    }
    const out: LineItem = { quantity };
    const variant = cleanText(it.variant, "Variation", 60);
    if (variant) out.variant = variant;
    if (it.product_id !== undefined && it.product_id !== null) out.product_id = uuid(it.product_id, "product_id");
    if (mode === "vendor") {
      if (it.unit_price_kobo !== undefined && it.unit_price_kobo !== null) {
        out.unit_price_kobo = kobo(it.unit_price_kobo, `Item ${i + 1} price`);
      }
      if (!out.product_id) {
        const name = cleanText(it.name, "Item name", 120, 1);
        if (name === null) throw new HttpError(422, "invalid_item", `Item ${i + 1}: choose a product or type a name`);
        if (out.unit_price_kobo === undefined) throw new HttpError(422, "invalid_item", `Item ${i + 1}: enter a price`);
        out.name = name;
      }
    } else if (!out.product_id) {
      throw new HttpError(422, "invalid_item", `Item ${i + 1}: choose a product`);
    }
    return out;
  });
}

export interface SaleInput {
  customer_id: string | null;
  customer: CustomerInput | null;
  items: LineItem[];
  channel: Channel;
  paid_kobo: number;
  method: PaymentMethod | null;
  note: string | null;
}

export function parseSale(body: Record<string, unknown>): SaleInput {
  const customer_id = body.customer_id ? uuid(body.customer_id, "customer_id") : null;
  const customer = customer_id ? null : parseCustomer(body.customer, { phoneRequired: false });
  const paid_kobo = body.paid_kobo === undefined || body.paid_kobo === null ? 0 : kobo(body.paid_kobo, "Amount paid");
  const method = paid_kobo > 0 ? oneOf(body.method, MANUAL_METHODS, "Payment method") : null;
  return {
    customer_id,
    customer,
    items: parseItems(body.items, "vendor"),
    channel: oneOf(body.channel ?? "walk_in", CHANNELS, "Sales channel"),
    paid_kobo,
    method,
    note: cleanText(body.note, "Note", 500),
  };
}

export interface PublicOrderInput {
  store_slug: string;
  customer: CustomerInput;
  items: LineItem[];
  notes: string | null;
  address: string | null;
}

export function parsePublicOrder(body: Record<string, unknown>): PublicOrderInput {
  const slug = typeof body.store_slug === "string" ? body.store_slug.trim().toLowerCase() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 30) throw new HttpError(422, "store_not_found", "Store not found");
  const customer = parseCustomer(body.customer, { phoneRequired: true });
  return {
    store_slug: slug,
    customer,
    items: parseItems(body.items, "public"),
    notes: cleanText(body.notes, "Order notes", 500),
    address: cleanText(body.address ?? customer.address, "Delivery address", 300),
  };
}

export function parsePayment(body: Record<string, unknown>) {
  return {
    order_id: uuid(body.order_id, "order_id"),
    amount_kobo: kobo(body.amount_kobo, "Amount", 1),
    method: oneOf(body.method, MANUAL_METHODS, "Payment method"),
    note: cleanText(body.note, "Note", 300),
  };
}

export function parseStatusChange(body: Record<string, unknown>) {
  return { order_id: uuid(body.order_id, "order_id"), status: oneOf(body.status, ORDER_STATUSES, "Status") };
}

const RPC_ERRORS: Record<string, [number, string, string]> = {
  insufficient_stock: [409, "insufficient_stock", "There isn't enough stock for one of these products."],
  product_not_found: [422, "product_not_found", "One of the products no longer exists in your catalogue."],
  product_unavailable: [409, "product_unavailable", "One of the products is no longer available."],
  store_not_found: [404, "store_not_found", "This store isn't available."],
  customer_not_found: [404, "customer_not_found", "That customer wasn't found."],
  order_not_found: [404, "order_not_found", "That order wasn't found."],
  order_cancelled: [409, "order_cancelled", "This order is cancelled."],
  invalid_transition: [409, "invalid_transition", "That status change isn't allowed."],
  overpayment: [409, "overpayment", "That is more than the customer still owes."],
  invalid_payment: [422, "invalid_payment", "Please check the payment details."],
  invalid_customer: [422, "invalid_customer", "Please check the customer details."],
  invalid_item: [422, "invalid_item", "Please check the products and quantities."],
  no_items: [422, "no_items", "Add at least one product."],
  too_many_items: [422, "too_many_items", "A sale can have at most 50 lines."],
  invalid_channel: [422, "invalid_channel", "Choose where the sale came from."],
  invalid_status: [422, "invalid_status", "That status isn't valid."],
  too_many_orders: [429, "too_many_orders", "Too many orders from this number. Please wait a while or contact the store."],
};

/** Turns a Postgres error raised by one of the sales functions into an HttpError. Unknown errors become a 500. */
export function rpcError(error: { message: string }): HttpError {
  for (const [needle, [status, code, message]] of Object.entries(RPC_ERRORS)) {
    if (error.message.includes(needle)) return new HttpError(status, code, message);
  }
  return new HttpError(500, "internal_error", error.message);
}
