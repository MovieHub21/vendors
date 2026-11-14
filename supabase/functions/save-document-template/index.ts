// POST /functions/v1/save-document-template { kind: "receipt" | "invoice", layout }  →  { template }
//      /functions/v1/save-document-template { kind, reset: true }                    →  { template: null }  (back to the default design)
// The browser sends the design as blocks (position, size, colours). It never sends CSS: the CSS is generated HERE from
// the validated blocks and stored beside them, so stored CSS can only contain declarations this code produced.
// The store is always the caller's own, looked up from their login.
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { requireVendor } from "../_shared/vendor.ts";
import { DOC_KINDS, TemplateError, templateToCss, validateTemplate, type DocKind } from "../_shared/docTemplate.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const body = await readJsonObject(req, 60_000);
    const kind = body.kind;
    if (typeof kind !== "string" || !DOC_KINDS.includes(kind as DocKind)) {
      throw new HttpError(422, "invalid_input", "Choose receipt or invoice.");
    }
    const db = adminClient();

    if (body.reset === true) {
      const { error } = await db.from("document_templates").delete().eq("store_id", store.id).eq("kind", kind);
      if (error) throw new HttpError(500, "internal_error", error.message);
      return { template: null };
    }

    let layout;
    try {
      layout = validateTemplate(body.layout);
    } catch (e) {
      if (e instanceof TemplateError) throw new HttpError(422, "invalid_template", e.message);
      throw e;
    }
    const { data, error } = await db
      .from("document_templates")
      .upsert({ store_id: store.id, kind, layout, css: templateToCss(layout) }, { onConflict: "store_id,kind" })
      .select("kind, layout, css, updated_at")
      .single();
    if (error) {
      if (error.code === "23514") throw new HttpError(422, "invalid_template", "That design contains something that isn't allowed.");
      throw new HttpError(500, "internal_error", error.message);
    }
    return { template: data };
  }),
);
