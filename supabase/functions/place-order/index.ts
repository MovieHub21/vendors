// POST /functions/v1/place-order { store_slug, customer{name,phone,email?,address?}, items[{product_id,quantity,variant?}], notes?, address? }
// PUBLIC (verify_jwt = false in config.toml): customers check out without an account. Prices come from the database,
// the order is created as PENDING, stock is not touched and no payment is recorded.
import { readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { parsePublicOrder, rpcError } from "../_shared/sales.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const order = parsePublicOrder(await readJsonObject(req));
    const { data, error } = await adminClient().rpc("place_store_order", {
      p_store_slug: order.store_slug,
      p_customer: order.customer,
      p_items: order.items,
      p_notes: order.notes,
      p_address: order.address,
    });
    if (error) throw rpcError(error);
    return { order: data };
  }),
);
