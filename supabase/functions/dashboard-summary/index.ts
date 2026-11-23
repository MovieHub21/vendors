// GET/POST /functions/v1/dashboard-summary  →  { summary }
// Every figure is computed in Postgres from THIS vendor's rows (store id from the login).
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { rpcError } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["GET", "POST"], async (req) => {
    const body = await readJsonObject(req);
    const { store } = await requireVendor(req, { needsSubscription: false });
    const db = adminClient();
    if (body.period !== undefined) {
      if (body.period !== "month" && body.period !== "all_time") {
        throw new HttpError(422, "invalid_input", "Choose this month or all time.");
      }
      const { data, error } = await db.rpc("dashboard_sales_range", { p_store_id: store.id, p_period: body.period });
      if (error) throw rpcError(error);
      return { sales: data };
    }
    const { data, error } = await db.rpc("dashboard_summary", { p_store_id: store.id });
    if (error) throw rpcError(error);
    return { summary: data };
  }),
);
