/** Typed wrappers around the sales edge functions. The browser sends what the vendor typed; the server decides totals, balances, stock and statuses. */
import type { Channel, OrderStatus, PaymentMethod, PaymentStatus, ReceiptSnapshot } from "../lib/sales";
import { call } from "./api";

export interface SaleLineInput {
  product_id?: string;
  name?: string;
  variant?: string;
  quantity: number;
  /** Kobo. Optional for catalogue products (the catalogue price is used); required for custom lines. */
  unit_price_kobo?: number;
}
export interface CustomerDetails {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}
export interface RecordSaleInput {
  customer_id?: string;
  customer?: CustomerDetails;
  items: SaleLineInput[];
  channel: Channel;
  paid_kobo?: number;
  method?: PaymentMethod;
  note?: string;
}
export interface SaleResult {
  order_id: string;
  reference: string;
  customer_id: string;
  total_kobo: number;
  paid_kobo: number;
  outstanding_kobo: number;
}
export interface PaymentResult {
  order_id: string;
  total_kobo: number;
  paid_kobo: number;
  outstanding_kobo: number;
  payment_status: PaymentStatus;
}
export interface Receipt {
  id: string;
  receipt_no: string;
  revision: number;
  snapshot: ReceiptSnapshot;
  created_at: string;
  created: boolean;
}
export interface DashboardSummary {
  total_sales_kobo: number;
  sales_today_kobo: number;
  sales_month_kobo: number;
  total_orders: number;
  pending_orders: number;
  awaiting_delivery: number;
  outstanding_kobo: number;
  debtors: number;
  total_customers: number;
  low_stock: { id: string; name: string; stock_quantity: number }[];
  recent_orders: {
    id: string;
    reference: string;
    customer_name: string;
    total_kobo: number;
    status: OrderStatus;
    payment_status: PaymentStatus;
    channel: Channel;
    created_at: string;
  }[];
  recent_transactions: {
    id: string;
    order_id: string;
    reference: string;
    customer_name: string;
    amount_kobo: number;
    method: string;
    source: "manual" | "paystack";
    recorded_at: string;
  }[];
}
export interface ProductInput {
  product_id?: string;
  name?: string;
  description?: string;
  price_kobo?: number;
  category?: string | null;
  status?: "draft" | "published" | "archived";
  is_available?: boolean;
  /** null = don't track stock for this product. */
  stock_quantity?: number | null;
  images?: { url: string; alt_text?: string | null }[];
}
export interface PublicOrderInput {
  store_slug: string;
  customer: { name: string; phone: string; email?: string; address?: string };
  items: { product_id: string; quantity: number; variant?: string }[];
  notes?: string;
}
export interface PlacedOrder {
  order_id: string;
  reference: string;
  total_kobo: number;
  store_name: string;
  store_phone: string | null;
}

export const recordSale = (input: RecordSaleInput) => call<{ sale: SaleResult }>("record-sale", { ...input });
export const updateOrderStatus = (orderId: string, status: OrderStatus) =>
  call<{ order: { order_id: string; status: OrderStatus } }>("update-order-status", { order_id: orderId, status });
export const recordOrderPayment = (orderId: string, amountKobo: number, method: PaymentMethod, note?: string) =>
  call<{ payment: PaymentResult }>("record-payment", { order_id: orderId, amount_kobo: amountKobo, method, note });
export const getReceipt = (orderId: string) => call<{ receipt: Receipt }>("order-receipt", { order_id: orderId });
export const getDashboardSummary = () => call<{ summary: DashboardSummary }>("dashboard-summary");
export const saveProduct = (input: ProductInput) => call<{ product: { id: string; slug: string; name: string } }>("save-product", { ...input });
export const productAction = (productId: string, action: "duplicate" | "hide" | "show" | "delete") =>
  call<{ product?: { id: string; name?: string; status: string }; deleted?: boolean }>("product-action", { product_id: productId, action });
/** Public: no login. The server prices the order from the catalogue and creates it as pending. */
export const placeOrder = (input: PublicOrderInput) => call<{ order: PlacedOrder }>("place-order", { ...input });
