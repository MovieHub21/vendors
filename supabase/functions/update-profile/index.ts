// POST /functions/v1/update-profile { phone }
// Profile changes are always scoped to the authenticated user's own account.
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, requireUser, route } from "../_shared/runtime.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const user = await requireUser(req);
    const body = await readJsonObject(req);
    if (typeof body.phone !== "string" && body.phone !== null) {
      throw new HttpError(422, "invalid_input", "Enter a valid phone number.");
    }

    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    if (phone && (phone.length > 30 || !/^\+?[0-9 ()-]{5,30}$/.test(phone) || phone.replace(/\D/g, "").length < 5)) {
      throw new HttpError(422, "invalid_input", "Enter a valid phone number with at least 5 digits.");
    }

    const { data, error } = await adminClient()
      .from("profiles")
      .upsert({ id: user.id, phone }, { onConflict: "id" })
      .select("full_name, phone")
      .single();
    if (error) throw new HttpError(500, "internal_error", error.message);
    return { profile: data };
  }),
);
