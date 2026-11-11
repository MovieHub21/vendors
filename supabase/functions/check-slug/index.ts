// POST /functions/v1/check-slug  { slug }  →  { slug, available, reason? }
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, requireUser, route } from "../_shared/runtime.ts";
import { normaliseSlug, slugFormatProblem } from "../_shared/validation.ts";

Deno.serve(
  route(["POST"], async (req) => {
    await requireUser(req);
    const body = await readJsonObject(req);
    const slug = normaliseSlug(body.slug);

    const format = slugFormatProblem(slug);
    if (format) return { slug, available: false, reason: format };

    const db = adminClient();
    const { data: problem, error } = await db.rpc("slug_problem", { p_slug: slug });
    if (error) throw new HttpError(500, "internal_error", error.message);
    if (problem) return { slug, available: false, reason: problem as string };

    const { data: taken, error: takenError } = await db.from("stores").select("id").eq("slug", slug).maybeSingle();
    if (takenError) throw new HttpError(500, "internal_error", takenError.message);
    return taken ? { slug, available: false, reason: "taken" } : { slug, available: true };
  }),
);
