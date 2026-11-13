/** Deno-side: resolves the signed-in vendor, their ONE store and their subscription. Ids never come from the browser. */
import type { User } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";
import { adminClient, requireUser } from "./runtime.ts";

export interface Vendor {
  user: User;
  store: { id: string; slug: string; name: string };
}

/**
 * Every vendor write goes through this. Reads happen in the browser under Row Level Security, so an expired vendor
 * can still SEE their records (nothing is deleted); only creating and changing them needs an active subscription.
 */
export async function requireVendor(req: Request, { needsSubscription = true } = {}): Promise<Vendor> {
  const user = await requireUser(req);
  const db = adminClient();
  const [store, sub] = await Promise.all([
    db.from("stores").select("id, slug, name, status").eq("owner_id", user.id).maybeSingle(),
    db.from("subscriptions").select("status, current_period_end").eq("owner_id", user.id).maybeSingle(),
  ]);
  if (store.error) throw new HttpError(500, "internal_error", store.error.message);
  if (sub.error) throw new HttpError(500, "internal_error", sub.error.message);
  if (!store.data) throw new HttpError(409, "store_required", "Create your store first.");
  if (store.data.status === "suspended") throw new HttpError(403, "store_suspended", "Your store is suspended.");
  const active = sub.data?.status === "active" && new Date(sub.data.current_period_end).getTime() > Date.now();
  if (needsSubscription && !active) {
    throw new HttpError(
      402,
      "subscription_required",
      "Your subscription has ended, so you can view your records but not change them. Renew to continue.",
    );
  }
  return { user, store: { id: store.data.id, slug: store.data.slug, name: store.data.name } };
}
