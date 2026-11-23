// POST /functions/v1/expenses { action: list | save | delete, ... }
// Vendors can only read and change expenses belonging to their own store.
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { parseExpense } from "../_shared/finance.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { uuid } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

const COLUMNS = "id, amount_kobo, category, description, incurred_on, created_at, updated_at";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const body = await readJsonObject(req);
    const db = adminClient();

    if (body.action === "list") {
      const { data, error } = await db.from("business_expenses").select(COLUMNS).eq("store_id", store.id)
        .order("incurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500);
      if (error) throw new HttpError(500, "internal_error", error.message);
      return { expenses: data ?? [] };
    }

    if (body.action === "delete") {
      const id = uuid(body.id, "Expense id");
      const { data, error } = await db.from("business_expenses").delete().eq("id", id).eq("store_id", store.id).select("id").maybeSingle();
      if (error) throw new HttpError(500, "internal_error", error.message);
      if (!data) throw new HttpError(404, "expense_not_found", "That expense wasn't found.");
      return { deleted: true };
    }

    if (body.action !== "save") throw new HttpError(422, "invalid_input", "Choose a valid expense action.");
    const input = parseExpense(body);
    const fields = {
      amount_kobo: input.amount_kobo,
      category: input.category,
      description: input.description,
      incurred_on: input.incurred_on,
    };
    if (input.id) {
      const { data, error } = await db.from("business_expenses").update(fields).eq("id", input.id).eq("store_id", store.id).select(COLUMNS).maybeSingle();
      if (error) throw new HttpError(422, "invalid_input", error.message);
      if (!data) throw new HttpError(404, "expense_not_found", "That expense wasn't found.");
      return { expense: data };
    }

    const { data, error } = await db.from("business_expenses").insert({ ...fields, store_id: store.id }).select(COLUMNS).single();
    if (error) throw new HttpError(422, "invalid_input", error.message);
    return { expense: data };
  }),
);
