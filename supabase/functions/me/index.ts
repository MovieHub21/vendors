// GET/POST /functions/v1/me — everything the app needs to decide where to send a signed-in vendor.
import { adminClient, requireUser, route } from "../_shared/runtime.ts";

export type NextStep = "create_store" | "subscribe" | "done";

Deno.serve(
  route(["GET", "POST"], async (req) => {
    const user = await requireUser(req);
    const db = adminClient();

<<<<<<< HEAD
    const [profile, store, subscription, seo] = await Promise.all([
      db.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
      db
        .from("stores")
        .select(
          "id, slug, name, tagline, description, category, city, state, seo_title, seo_description, seo_keywords, og_image_url, logo_url, cover_url, indexable, contact_phone, contact_email, is_published, status",
        )
        .eq("owner_id", user.id)
        .maybeSingle(),
      db.from("subscriptions").select("plan_code, status, current_period_end").eq("owner_id", user.id).maybeSingle(),
      db.rpc("store_seo_status", { p_owner: user.id }),
    ]);
    for (const r of [profile, store, subscription, seo]) if (r.error) throw r.error;
=======
    const [profile, store, subscription] = await Promise.all([
      db.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
      db
        .from("stores")
        .select("id, slug, name, category, city, state, is_published, status")
        .eq("owner_id", user.id)
        .maybeSingle(),
      db.from("subscriptions").select("plan_code, status, current_period_end").eq("owner_id", user.id).maybeSingle(),
    ]);
    for (const r of [profile, store, subscription]) if (r.error) throw r.error;
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c

    const active =
      subscription.data?.status === "active" && new Date(subscription.data.current_period_end).getTime() > Date.now();
    const next_step: NextStep = !store.data ? "create_store" : !active ? "subscribe" : "done";

    return {
      user: { id: user.id, email: user.email },
      profile: profile.data,
      store: store.data,
      subscription: subscription.data ? { ...subscription.data, active } : null,
<<<<<<< HEAD
      seo_status: seo.data,
=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
      next_step,
    };
  }),
);
