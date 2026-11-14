// Public support intake; messages are stored server-side and only the admin console can read them.
import { bearerToken, HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

Deno.serve(route(["POST"], async (req) => {
  const body = await readJsonObject(req);
  const name = text(body.name, 120);
  const email = text(body.email, 254).toLowerCase();
  const topic = text(body.topic, 80);
  const message = text(body.message, 5000);
  const phone = text(body.phone, 30);
  const requestType = text(body.request_type, 32) || "general";
  if (name.length < 1 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email) || !topic || message.length < 5) {
    throw new HttpError(400, "invalid_input", "Enter your name, a valid email, a topic and a message of at least 5 characters.");
  }
  if (!["general", "store_report", "vendor_complaint"].includes(requestType)) throw new HttpError(400, "invalid_input", "Choose a valid request type.");
  if (requestType !== "general" && (!/^\+?[0-9 ()-]{5,30}$/.test(phone) || phone.replace(/\D/g, "").length < 5)) {
    throw new HttpError(400, "invalid_input", "Enter a valid phone number with its country code.");
  }
  let requesterUserId: string | null = null;
  const token = bearerToken(req);
  if (token) {
    const { data, error } = await adminClient().auth.getUser(token);
    // An unauthenticated Supabase client can send its public API key as a bearer value.
    // Keep the support form public; only attach an account when the token is a real user session.
    if (!error && data.user) requesterUserId = data.user.id;
  }
  let reportedStore: { id: string; name: string; slug: string } | null = null;
  const storeSlug = text(body.store_slug, 30).toLowerCase();
  if (requestType === "store_report") {
    if (!storeSlug) throw new HttpError(400, "invalid_input", "The store being reported is missing.");
    const { data, error } = await adminClient().from("stores").select("id, name, slug").eq("slug", storeSlug).maybeSingle();
    if (error) throw new HttpError(500, "support_submit_failed", "We couldn't send your report. Please try again.");
    if (!data) throw new HttpError(404, "store_not_found", "This store could not be found.");
    reportedStore = data;
  }
  if (requestType === "vendor_complaint") {
    if (!requesterUserId) throw new HttpError(401, "unauthorized", "Sign in to send a vendor complaint.");
    const { data, error } = await adminClient().from("stores").select("id, name, slug").eq("owner_id", requesterUserId).maybeSingle();
    if (error) throw new HttpError(500, "support_submit_failed", "We couldn't send your message. Please try again.");
    reportedStore = data;
  }
  const { data, error } = await adminClient().from("support_requests").insert({
    requester_user_id: requesterUserId, name, email, phone: phone || null, topic, message,
    request_type: requestType,
    reported_store_id: reportedStore?.id ?? null,
    reported_store_name: reportedStore?.name ?? null,
    reported_store_slug: reportedStore?.slug ?? null,
  }).select("id").single();
  if (error) throw new HttpError(500, "support_submit_failed", "We couldn't send your message. Please try again.");
  return { request_id: data.id };
}));
