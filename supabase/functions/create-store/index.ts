// POST /functions/v1/create-store  { name, slug, category, city?, state? }  →  { store }
// Stores are created here (never from the browser) so the username rules and one-store-per-vendor rule are enforced.
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, requireUser, route } from "../_shared/runtime.ts";
import { parseStoreInput } from "../_shared/validation.ts";

const COLUMNS = "id, slug, name, category, city, state, is_published, status";

Deno.serve(
  route(["POST"], async (req) => {
    const user = await requireUser(req);
    const input = parseStoreInput(await readJsonObject(req));
    const db = adminClient();

    const existing = await db.from("stores").select(COLUMNS).eq("owner_id", user.id).maybeSingle();
    if (existing.error) throw new HttpError(500, "internal_error", existing.error.message);
    if (existing.data) throw new HttpError(409, "store_exists", "You already have a store.");

    const problem = await db.rpc("slug_problem", { p_slug: input.slug });
    if (problem.error) throw new HttpError(500, "internal_error", problem.error.message);
    if (problem.data) throw new HttpError(422, "invalid_slug", String(problem.data));

    const { data, error } = await db
      .from("stores")
      .insert({
        owner_id: user.id,
        name: input.name,
        slug: input.slug,
        category: input.category,
        city: input.city,
        state: input.state,
        is_published: false, // goes live when the first payment is confirmed
      })
      .select(COLUMNS)
      .single();

    if (error) {
      // Two vendors can pass the check at the same moment; the unique index decides.
      if (error.code === "23505" && error.message.includes("owner_id")) throw new HttpError(409, "store_exists");
      if (error.code === "23505") throw new HttpError(409, "slug_taken", "That username is already taken.");
      if (error.message.includes("slug_reserved")) throw new HttpError(422, "invalid_slug", "reserved");
      throw new HttpError(500, "internal_error", error.message);
    }
    return { store: data };
  }),
);
