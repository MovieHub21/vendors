// POST /functions/v1/update-order-item-prices { order_id, items: [{ order_item_id, unit_price_kobo }] }
// Saves the vendor's agreed item prices for this order. Product catalogue prices are not changed.
import { readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { parseOrderItemPrices, rpcError } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const prices = parseOrderItemPrices(await readJsonObject(req));
    const { data, error } = await adminClient().rpc("set_order_item_prices", {
      p_store_id: store.id,
      p_order_id: prices.order_id,
      p_items: prices.items,
    });
    if (error) throw rpcError(error);
    return { order: data };
  }),
);
