// POST /functions/v1/order-invoice { order_id }  →  { invoice: { invoice_no, issued_at, bank, snapshot } }
// A live invoice for an order that still has a balance (unpaid or part-paid). Nothing is stored: the figures are read
// from the order each time, so the invoice always shows what is still owed. Paid and cancelled orders are refused.
// Like receipts, invoices stay readable if the subscription has lapsed.
import { readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { rpcError, uuid } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req, { needsSubscription: false });
    const body = await readJsonObject(req);
    const { data, error } = await adminClient().rpc("get_invoice", {
      p_store_id: store.id,
      p_order_id: uuid(body.order_id, "order_id"),
    });
    if (error) throw rpcError(error);
    return { invoice: data };
  }),
);
