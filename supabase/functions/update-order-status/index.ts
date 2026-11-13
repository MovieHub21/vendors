// POST /functions/v1/update-order-status { order_id, status }
import { readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { parseStatusChange, rpcError } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const change = parseStatusChange(await readJsonObject(req));
    const { data, error } = await adminClient().rpc("set_order_status", {
      p_store_id: store.id,
      p_order_id: change.order_id,
      p_status: change.status,
    });
    if (error) throw rpcError(error);
    return { order: data };
  }),
);
