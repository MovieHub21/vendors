// POST /functions/v1/update-store-seo  { seo_title?, seo_description?, og_image_url?, indexable?, category?, city?, ... }
// The store is ALWAYS the caller's own (looked up from their login), never an id sent by the browser.
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, requireUser, route } from "../_shared/runtime.ts";
import { parseStoreSeoUpdate } from "../_shared/seoFields.ts";

const COLUMNS =
  "id, slug, name, tagline, description, category, city, state, seo_title, seo_description, seo_keywords, og_image_url, logo_url, cover_url, indexable, is_published, status";

Deno.serve(
  route(["POST"], async (req) => {
    const user = await requireUser(req);
    const changes = parseStoreSeoUpdate(await readJsonObject(req));
    const db = adminClient();

    const { data, error } = await db
      .from("stores")
      .update(changes)
      .eq("owner_id", user.id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      if (error.code === "23514") throw new HttpError(422, "invalid_input", "One of the values isn't allowed.");
      throw new HttpError(500, "internal_error", error.message);
    }
    if (!data) throw new HttpError(404, "store_required", "Create your store first.");

    const status = await db.rpc("store_seo_status", { p_owner: user.id });
    if (status.error) throw new HttpError(500, "internal_error", status.error.message);
    return { store: data, seo_status: status.data };
  }),
);
