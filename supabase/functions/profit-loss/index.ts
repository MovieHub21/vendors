// POST /functions/v1/profit-loss { period: today | month | all_time }
import { readJsonObject } from "../_shared/http.ts";
import { parseReportPeriod } from "../_shared/finance.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { rpcError } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const body = await readJsonObject(req);
    const period = parseReportPeriod(body.period);
    const { data, error } = await adminClient().rpc("profit_loss_report", { p_store_id: store.id, p_period: period });
    if (error) throw rpcError(error);
    return { report: data };
  }),
);
