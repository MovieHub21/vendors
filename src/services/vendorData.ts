/**
 * Reads for the vendor dashboard. These go straight from the browser to Supabase under Row Level Security: the
 * database only returns the signed-in vendor's own rows, whatever is asked for. Writes never happen here (see sales.ts).
 */
import { supabase } from "../lib/supabase";
import type { Channel, OrderStatus, PaymentStatus } from "../lib/sales";
import { fail, ok, type Result } from "./result";

export interface OrderRow {
  id: string;
  reference: string;
  channel: Channel;
  status: OrderStatus;
  total_kobo: number;
  paid_kobo: number;
  payment_status: PaymentStatus;
  created_at: string;
  customer_id: string;
  customers: { name: string; phone: string | null } | null;
}
export interface OrderDetail extends OrderRow {
  notes: string | null;
  delivery_address: string | null;
  items: { id: string; product_name: string; variant: string | null; unit_price_kobo: number; quantity: number; line_total_kobo: number }[];
  payments: { id: string; amount_kobo: number; method: string; source: "manual" | "paystack"; note: string | null; recorded_at: string }[];
}
export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  order_count: number;
  total_purchases_kobo: number;
  total_paid_kobo: number;
  outstanding_kobo: number;
  last_purchase_at: string | null;
}
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_kobo: number;
  category: string | null;
  status: "draft" | "published" | "archived";
  is_available: boolean;
  stock_quantity: number | null;
  product_images: { url: string; alt_text: string | null; position: number }[];
}
export interface OrderFilters {
  status?: string;
  payment?: string;
  from?: string;
  to?: string;
  customerId?: string;
}

const NOT_CONFIGURED = "The service isn't connected yet. Please try again later.";
const FAILED = "We couldn't load this. Please refresh and try again.";

const ORDER_COLUMNS =
  "id, reference, channel, status, total_kobo, paid_kobo, payment_status, created_at, customer_id, customers(name, phone)";

// PostgREST returns int8 columns as JSON numbers, which is safe for kobo amounts well below 2^53.
export async function listOrders(f: OrderFilters = {}): Promise<Result<OrderRow[]>> {
  if (!supabase) return fail("not_configured", NOT_CONFIGURED);
  let q = supabase.from("orders").select(ORDER_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (f.status) q = q.eq("status", f.status);
  if (f.payment) q = q.eq("payment_status", f.payment);
  if (f.customerId) q = q.eq("customer_id", f.customerId);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+01:00`); // Nigerian time (WAT, UTC+1)
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59+01:00`);
  const { data, error } = await q;
  return error ? fail("request_failed", FAILED) : ok((data ?? []) as unknown as OrderRow[]);
}

export async function getOrder(id: string): Promise<Result<OrderDetail>> {
  if (!supabase) return fail("not_configured", NOT_CONFIGURED);
  const [order, items, payments] = await Promise.all([
    supabase.from("orders").select(`${ORDER_COLUMNS}, notes, delivery_address`).eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id, product_name, variant, unit_price_kobo, quantity, line_total_kobo").eq("order_id", id).order("line_total_kobo", { ascending: false }),
    supabase.from("order_payments").select("id, amount_kobo, method, source, note, recorded_at").eq("order_id", id).order("recorded_at"),
  ]);
  if (order.error || items.error || payments.error) return fail("request_failed", FAILED);
  if (!order.data) return fail("order_not_found", "That order wasn't found.");
  return ok({ ...(order.data as unknown as OrderRow & { notes: string | null; delivery_address: string | null }), items: items.data ?? [], payments: (payments.data ?? []) as OrderDetail["payments"] });
}

export async function listCustomers(): Promise<Result<CustomerRow[]>> {
  if (!supabase) return fail("not_configured", NOT_CONFIGURED);
  const { data, error } = await supabase
    .from("customer_overview")
    .select("id, name, phone, email, address, order_count, total_purchases_kobo, total_paid_kobo, outstanding_kobo, last_purchase_at")
    .order("name")
    .limit(1000);
  return error ? fail("request_failed", FAILED) : ok((data ?? []) as unknown as CustomerRow[]);
}

export async function listProducts(): Promise<Result<ProductRow[]>> {
  if (!supabase) return fail("not_configured", NOT_CONFIGURED);
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, description, price_kobo, category, status, is_available, stock_quantity, product_images(url, alt_text, position)")
    .order("created_at", { ascending: false })
    .limit(1000);
  return error ? fail("request_failed", FAILED) : ok((data ?? []) as unknown as ProductRow[]);
}
