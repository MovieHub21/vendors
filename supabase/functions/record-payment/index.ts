// POST /functions/v1/record-payment { order_id, amount_kobo, method, note? }
// A MANUAL payment (cash, transfer, POS…). It is stored with source 'manual' and can never be mistaken for a
// Paystack-verified payment (database constraint). The amount can't exceed what is still owed.
import { readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { parsePayment, rpcError } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const p = parsePayment(await readJsonObject(req));
    const { data, error } = await adminClient().rpc("record_order_payment", {
      p_store_id: store.id,
      p_order_id: p.order_id,
      p_amount_kobo: p.amount_kobo,
      p_method: p.method,
      p_note: p.note,
    });
    if (error) throw rpcError(error);
    return { payment: data };
  }),
);
