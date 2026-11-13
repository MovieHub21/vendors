// GET/POST /functions/v1/dashboard-summary  →  { summary }
// Every figure is computed in Postgres from THIS vendor's rows (store id from the login).
import { adminClient, route } from "../_shared/runtime.ts";
import { rpcError } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["GET", "POST"], async (req) => {
    const { store } = await requireVendor(req, { needsSubscription: false });
    const { data, error } = await adminClient().rpc("dashboard_summary", { p_store_id: store.id });
    if (error) throw rpcError(error);
    return { summary: data };
  }),
);
