// Administrative reads and mutations. Admin access is checked against explicit platform_admins membership on every call.
import { readJsonObject, HttpError } from "../_shared/http.ts";
import { adminClient, requireUser, route } from "../_shared/runtime.ts";

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const failDb = (error: { message: string } | null) => { if (error) throw new HttpError(500, "admin_data_error", error.message); };
const ADMIN_PAGES = ["overview", "vendors", "payments", "support", "activity"] as const;
const PAGE_FOR_ACTION: Record<string, string> = {
  overview: "overview",
  vendors: "vendors", set_store_status: "vendors",
  payments: "payments",
  support: "support", update_support: "support",
  activity: "activity",
};
function membershipRpcError(error: { code?: string; message: string } | null): never | void {
  if (!error) return;
  if (error.code === "P0002" && error.message.includes("admin_user_not_found")) throw new HttpError(404, "admin_user_not_found", "No SellSharp account exists with that email yet.");
  if (error.code === "P0002") throw new HttpError(404, "admin_account_not_found", "That admin account was not found.");
  if (error.code === "23505") throw new HttpError(409, "admin_already_exists", "That account already has admin access.");
  if (error.code === "22023" && error.message.includes("admin_permissions")) throw new HttpError(400, "invalid_admin_permissions", "Select at least one valid page permission.");
  if (error.code === "22023") throw new HttpError(400, "invalid_admin_action", "Enter a reason of at least 5 characters.");
  if (error.code === "42501") throw new HttpError(403, "super_admin_required", "Only a super admin can manage admin accounts.");
  failDb(error);
}

Deno.serve(route(["POST"], async (req) => {
  const user = await requireUser(req);
  const db = adminClient();
  const { data: membership, error: membershipError } = await db.from("platform_admins").select("user_id, role, permissions").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new HttpError(500, "admin_data_error", membershipError.message);
  if (!membership) throw new HttpError(403, "admin_required", "This account does not have platform admin access.");

  const body = await readJsonObject(req);
  const action = text(body.action, 40);
  const isSuperAdmin = membership.role === "super_admin";
  const permissions = isSuperAdmin ? [...ADMIN_PAGES] : membership.permissions ?? [];
  if (action === "access") return { role: membership.role, permissions, is_super_admin: isSuperAdmin };
  if (["admins", "list_admins", "add_admin", "update_admin", "remove_admin"].includes(action) && !isSuperAdmin) {
    throw new HttpError(403, "admin_permission_required", "Admin account management is reserved for super admins.");
  }
  const requiredPage = PAGE_FOR_ACTION[action];
  if (requiredPage && !isSuperAdmin && !permissions.includes(requiredPage)) {
    throw new HttpError(403, "admin_permission_required", `Your admin account does not have access to the ${requiredPage} page.`);
  }
  if (!requiredPage && !["admins", "list_admins", "add_admin", "update_admin", "remove_admin"].includes(action)) {
    throw new HttpError(400, "invalid_input", "Choose a valid admin action.");
  }
  if (action === "overview") {
    const { data, error } = await db.rpc("admin_platform_metrics", { p_actor: user.id });
    failDb(error);
    return { metrics: data };
  }
  if (action === "vendors") {
    const search = text(body.search, 120);
    const page = Math.max(0, Math.floor(Number(body.page) || 0));
    const { data, error } = await db.rpc("admin_search_vendors", { p_actor: user.id, p_search: search, p_limit: 50, p_offset: page * 50 });
    failDb(error);
    return { vendors: data ?? [], page, page_size: 50 };
  }
  if (action === "set_store_status") {
    const storeId = text(body.store_id, 50);
    const status = text(body.status, 20);
    const reason = text(body.reason, 1000);
    if (!/^[0-9a-f-]{36}$/i.test(storeId) || !["active", "suspended"].includes(status) || reason.length < 5) {
      throw new HttpError(400, "invalid_admin_action", "Choose a status and enter a reason of at least 5 characters.");
    }
    const { data, error } = await db.rpc("admin_set_store_status", { p_actor: user.id, p_store_id: storeId, p_status: status, p_reason: reason });
    if (error?.code === "P0002") throw new HttpError(404, "store_not_found");
    failDb(error);
    return { result: data };
  }
  if (action === "payments") {
    const [payments, events] = await Promise.all([
      db.from("payments").select("id, owner_id, plan_code, reference, amount_kobo, currency, status, channel, paid_at, created_at, paystack_transaction_id").order("created_at", { ascending: false }).limit(100),
      db.from("webhook_events").select("id, provider, event, reference, received_at, processed_at").order("received_at", { ascending: false }).limit(100),
    ]);
    failDb(payments.error); failDb(events.error);
    const ownerIds = [...new Set((payments.data ?? []).map((row) => row.owner_id))];
    const { data: stores, error: storesError } = ownerIds.length
      ? await db.from("stores").select("owner_id, name, slug").in("owner_id", ownerIds)
      : { data: [], error: null };
    failDb(storesError);
    const names = new Map<string, { name: string; slug: string }>((stores ?? []).map((store) => [store.owner_id, { name: store.name, slug: store.slug }] as const));
    return { payments: (payments.data ?? []).map((row) => ({ ...row, store: names.get(row.owner_id) ?? null })), webhook_events: events.data ?? [] };
  }
  if (action === "support") {
    const status = text(body.status, 20);
    let query = db.from("support_requests").select("id, requester_user_id, name, email, phone, topic, message, request_type, reported_store_id, reported_store_name, reported_store_slug, status, admin_note, created_at, updated_at, resolved_at").order("created_at", { ascending: false }).limit(100);
    if (["open", "in_progress", "resolved", "closed"].includes(status)) query = query.eq("status", status);
    const { data, error } = await query;
    failDb(error);
    return { requests: data ?? [] };
  }
  if (action === "update_support") {
    const requestId = text(body.request_id, 50);
    const status = text(body.status, 20);
    const note = text(body.note, 2000);
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["open", "in_progress", "resolved", "closed"].includes(status)) {
      throw new HttpError(400, "invalid_admin_action", "Choose a valid support status.");
    }
    const { data, error } = await db.rpc("admin_update_support_request", { p_actor: user.id, p_request_id: requestId, p_status: status, p_note: note });
    if (error?.code === "P0002") throw new HttpError(404, "support_request_not_found");
    failDb(error);
    return { result: data };
  }
  if (action === "activity") {
    const { data, error } = await db.from("admin_audit_log").select("id, actor_id, action, target_type, target_id, reason, details, created_at").order("created_at", { ascending: false }).limit(100);
    failDb(error);
    const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter(Boolean))] as string[];
    const { data: profiles, error: profilesError } = actorIds.length
      ? await db.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [], error: null };
    failDb(profilesError);
    const actorNames = new Map<string, string>((profiles ?? []).map((profile) => [profile.id, profile.full_name] as const));
    return { actions: (data ?? []).map((row) => ({ ...row, actor_name: actorNames.get(row.actor_id) || "Platform admin" })) };
  }
  if (action === "admins" || action === "list_admins") {
    const { data, error } = await db.rpc("admin_list_memberships", { p_actor: user.id });
    membershipRpcError(error);
    return { admins: data ?? [] };
  }
  if (["add_admin", "update_admin", "remove_admin"].includes(action)) {
    const operation = action === "add_admin" ? "add" : action === "update_admin" ? "update_permissions" : "remove";
    const email = text(body.email, 254).toLowerCase();
    const validPages = Array.isArray(body.permissions)
      ? [...new Set(body.permissions.filter((entry): entry is string => typeof entry === "string" && ADMIN_PAGES.includes(entry as typeof ADMIN_PAGES[number])))]
      : [];
    const reason = text(body.reason, 1000);
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email) || reason.length < 5) {
      throw new HttpError(400, "invalid_admin_action", "Enter a valid account email and an audit reason of at least 5 characters.");
    }
    const { data, error } = await db.rpc("admin_manage_membership", {
      p_actor: user.id, p_operation: operation, p_email: email,
      p_permissions: validPages, p_reason: reason,
    });
    membershipRpcError(error);
    return { result: data };
  }
  throw new HttpError(400, "invalid_input", "Choose a valid admin action.");
}));
