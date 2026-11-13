// POST /functions/v1/order-receipt { order_id }  →  { receipt }
// Creates the receipt for an order, or a new revision when payments changed. Earlier revisions are never edited.
// Receipts are a record of what happened, so they stay available even if the subscription has lapsed.
import { readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { rpcError, uuid } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req, { needsSubscription: false });
    const body = await readJsonObject(req);
    const { data, error } = await adminClient().rpc("generate_receipt", {
      p_store_id: store.id,
      p_order_id: uuid(body.order_id, "order_id"),
    });
    if (error) throw rpcError(error);
    return { receipt: data };
  }),
);
