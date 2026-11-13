// GET/POST /functions/v1/me — everything the app needs to decide where to send a signed-in vendor.
import { adminClient, requireUser, route } from "../_shared/runtime.ts";

export type NextStep = "create_store" | "subscribe" | "done";

Deno.serve(
  route(["GET", "POST"], async (req) => {
    const user = await requireUser(req);
    const db = adminClient();

    const [profile, store, subscription, seo] = await Promise.all([
      db.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
      db
        .from("stores")
        .select(
          "id, slug, name, tagline, description, category, city, state, seo_title, seo_description, seo_keywords, og_image_url, logo_url, cover_url, storefront_layout, hero_eyebrow, hero_title, hero_description, hero_button_text, category_heading, products_heading, promo_one_title, promo_one_text, promo_one_image_url, promo_two_title, promo_two_text, promo_two_image_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url, threads_url, snapchat_url, pinterest_url, linkedin_url, other_social_label, other_social_url, indexable, contact_phone, contact_email, is_published, status",
        )
        .eq("owner_id", user.id)
        .maybeSingle(),
      db.from("subscriptions").select("plan_code, status, current_period_end").eq("owner_id", user.id).maybeSingle(),
      db.rpc("store_seo_status", { p_owner: user.id }),
    ]);
    for (const r of [profile, store, subscription, seo]) if (r.error) throw r.error;

    const active =
      subscription.data?.status === "active" && new Date(subscription.data.current_period_end).getTime() > Date.now();
    const next_step: NextStep = !store.data ? "create_store" : !active ? "subscribe" : "done";

    return {
      user: { id: user.id, email: user.email },
      profile: profile.data,
      store: store.data,
      subscription: subscription.data ? { ...subscription.data, active } : null,
      seo_status: seo.data,
      next_step,
    };
  }),
);
