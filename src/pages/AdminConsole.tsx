import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminCall } from "../services/api";
import { Seo } from "../components/Seo";

type Tab = "overview" | "vendors" | "payments" | "support" | "activity" | "admins";
type AdminPage = Exclude<Tab, "admins">;
type AdminMember = { user_id: string; email: string; role: "super_admin" | "admin"; permissions: AdminPage[]; added_at: string; added_by: string | null };
type Metrics = Record<string, number>;
type Vendor = {
  store_id: string; owner_id: string; store_name: string; slug: string; category: string; store_status: string;
  is_published: boolean; store_created_at: string; full_name: string; email: string;
  subscription_status: string | null; plan_code: string | null; current_period_end: string | null;
};
type SupportRequest = {
  id: string; name: string; email: string; phone: string | null; topic: string; message: string; status: string; admin_note: string;
  request_type: string; reported_store_name: string | null; reported_store_slug: string | null;
  created_at: string; resolved_at: string | null;
};
type Payment = {
  id: string; owner_id: string; plan_code: string; reference: string; amount_kobo: number; currency: string;
  status: string; channel: string | null; paid_at: string | null; created_at: string; paystack_transaction_id: number | null;
  store: { name: string; slug: string } | null;
};
type WebhookEvent = { id: string; provider: string; event: string; reference: string | null; received_at: string; processed_at: string | null };
type AuditEntry = { id: string; actor_name: string; action: string; target_type: string; target_id: string; reason: string; details: Record<string, unknown>; created_at: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "vendors", label: "Vendors" }, { id: "payments", label: "Payments" },
  { id: "support", label: "Support" }, { id: "activity", label: "Admin activity" }, { id: "admins", label: "Admin access" },
];
const ADMIN_PERMISSION_OPTIONS: { id: AdminPage; label: string; description: string }[] = [
  { id: "overview", label: "Overview", description: "Platform totals and activity metrics" },
  { id: "vendors", label: "Vendors", description: "Search accounts and suspend or reactivate stores" },
  { id: "payments", label: "Payments", description: "Subscription payment attempts and provider events" },
  { id: "support", label: "Support", description: "Read and manage customer and vendor requests" },
  { id: "activity", label: "Admin activity", description: "Review administrative action history" },
];
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
const money = (kobo: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(kobo / 100);
const title = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminConsole() {
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [admins, setAdmins] = useState<AdminMember[]>([]);
  const [adminDrafts, setAdminDrafts] = useState<Record<string, { permissions: AdminPage[]; reason: string }>>({});
  const [accountEmail, setAccountEmail] = useState("");
  const [newPermissions, setNewPermissions] = useState<AdminPage[]>([]);
  const [adminReason, setAdminReason] = useState("");
  const [removeTarget, setRemoveTarget] = useState<AdminMember | null>(null);
  const [role, setRole] = useState<"super_admin" | "admin" | null>(null);
  const [permissions, setPermissions] = useState<AdminPage[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState<Vendor | null>(null);
  const [pendingStoreStatus, setPendingStoreStatus] = useState<"active" | "suspended">("suspended");
  const [reason, setReason] = useState("");
  const [supportDraft, setSupportDraft] = useState<Record<string, { status: string; note: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void adminCall<{ role: "super_admin" | "admin"; permissions: AdminPage[] }>("access").then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoading(false); setError(result.message); setForbidden(result.code === "admin_required");
        return;
      }
      setRole(result.data.role);
      setPermissions(result.data.permissions);
      const available = TABS.filter((item) => item.id === "admins" ? result.data.role === "super_admin" : result.data.role === "super_admin" || result.data.permissions.includes(item.id));
      setTab(available[0]?.id ?? "overview");
    });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const result = await adminCall<Record<string, unknown>>(tab, {
      search: submittedSearch, page, status: statusFilter === "all" ? "" : statusFilter,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      setForbidden(result.code === "admin_required");
      return;
    }
    setForbidden(false);
    if (tab === "overview") setMetrics(result.data.metrics as Metrics);
    if (tab === "vendors") setVendors((result.data.vendors ?? []) as Vendor[]);
    if (tab === "payments") { setPayments((result.data.payments ?? []) as Payment[]); setWebhooks((result.data.webhook_events ?? []) as WebhookEvent[]); }
    if (tab === "support") {
      const rows = (result.data.requests ?? []) as SupportRequest[];
      setRequests(rows);
      setSupportDraft((current) => Object.fromEntries(rows.map((row) => [row.id, current[row.id] ?? { status: row.status, note: row.admin_note }])));
    }
    if (tab === "activity") setActivity((result.data.actions ?? []) as AuditEntry[]);
    if (tab === "admins") {
      const rows = (result.data.admins ?? []) as AdminMember[];
      setAdmins(rows);
      setAdminDrafts((current) => Object.fromEntries(rows.map((row) => [row.user_id, current[row.user_id] ?? { permissions: row.permissions, reason: "" }])));
    }
  }, [tab, submittedSearch, page, statusFilter]);

  useEffect(() => { if (role) void load(); }, [load, role]);

  const isSuperAdmin = role === "super_admin";
  const visibleTabs = TABS.filter((item) => item.id === "admins" ? isSuperAdmin : isSuperAdmin || permissions.includes(item.id));

  const updateStore = async (store: Vendor, status: "active" | "suspended") => {
    setBusy(store.store_id); setError("");
    const result = await adminCall("set_store_status", { store_id: store.store_id, status, reason });
    setBusy("");
    if (!result.ok) { setError(result.message); return; }
    setSuspendTarget(null); setReason(""); await load();
  };

  const updateTicket = async (event: FormEvent<HTMLFormElement>, request: SupportRequest) => {
    event.preventDefault();
    const draft = supportDraft[request.id] ?? { status: request.status, note: request.admin_note };
    setBusy(request.id); setError("");
    const result = await adminCall("update_support", { request_id: request.id, status: draft.status, note: draft.note });
    setBusy("");
    if (!result.ok) { setError(result.message); return; }
    await load();
  };

  const setAdminPage = (current: AdminPage[], pageName: AdminPage) =>
    current.includes(pageName) ? current.filter((value) => value !== pageName) : [...current, pageName];

  const addAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPermissions.length || adminReason.trim().length < 5) return;
    setBusy("new-admin"); setError("");
    const result = await adminCall("add_admin", { email: accountEmail, permissions: newPermissions, reason: adminReason });
    setBusy("");
    if (!result.ok) { setError(result.message); return; }
    setAccountEmail(""); setNewPermissions([]); setAdminReason(""); await load();
  };

  const saveAdminPermissions = async (member: AdminMember) => {
    const draft = adminDrafts[member.user_id] ?? { permissions: member.permissions, reason: "" };
    setBusy(member.user_id); setError("");
    const result = await adminCall("update_admin", { email: member.email, permissions: draft.permissions, reason: draft.reason });
    setBusy("");
    if (!result.ok) { setError(result.message); return; }
    setAdminDrafts((current) => ({ ...current, [member.user_id]: { ...draft, reason: "" } })); await load();
  };

  const removeAdmin = async (member: AdminMember) => {
    const draft = adminDrafts[member.user_id] ?? { permissions: member.permissions, reason: "" };
    setBusy(member.user_id); setError("");
    const result = await adminCall("remove_admin", { email: member.email, reason: draft.reason });
    setBusy("");
    if (!result.ok) { setError(result.message); return; }
    setRemoveTarget(null); await load();
  };

  return (
    <main className="admin-app">
      <Seo seo={{ title: "SellSharp Management", description: "Private SellSharp platform management console.", path: "/management", noindex: true, nofollow: true }} />
      <header className="admin-topbar">
        <Link to="/" className="admin-brand"><span className="admin-brand-mark">S</span><span>SellSharp <small>ADMIN</small></span></Link>
        <div className="admin-top-actions"><span>Platform operations</span><Link to="/">Back to website</Link></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <p>PLATFORM</p>
          <nav>{visibleTabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? "is-active" : ""} onClick={() => { setTab(item.id); setPage(0); }}>{item.label}</button>)}</nav>
          <small>Access is limited to approved administrators.</small>
        </aside>
        <section className="admin-main">
          <div className="admin-heading">
            <div><p>SELLSHARP CONTROL</p><h1>{TABS.find((item) => item.id === tab)?.label}</h1></div>
            <button className="admin-button admin-button-quiet" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
          </div>
          {error && <div className={forbidden ? "admin-notice" : "admin-error"} role="alert">{error}{forbidden && <p>Sign in with an account that has been added to <code>platform_admins</code>.</p>}</div>}
          {loading && <div className="admin-loading">Loading platform data…</div>}

          {!loading && !forbidden && tab === "overview" && metrics && <>
            <p className="admin-intro">A high level view of vendor activity, subscriptions and support.</p>
            <div className="admin-metrics">
              {[
                ["Vendor accounts", metrics.vendors], ["Live stores", metrics.published_stores], ["Active subscriptions", metrics.active_subscriptions],
                ["Expired subscriptions", metrics.expired_subscriptions], ["Suspended stores", metrics.suspended_stores], ["Orders this month", metrics.orders_this_month],
                ["Payment attempts · 30 days", metrics.payments_last_30_days], ["Open support requests", metrics.open_support_requests],
              ].map(([label, value]) => <article className="admin-metric" key={String(label)}><span>{label}</span><strong>{Number(value ?? 0).toLocaleString()}</strong></article>)}
            </div>
            <div className="admin-panel admin-overview-note"><h2>Operations</h2><p>Use Vendors to review account and renewal status. Every store status change requires a reason and is recorded. Subscription payment attempts and provider webhook deliveries are available under Payments.</p></div>
          </>}

          {!loading && !forbidden && tab === "vendors" && <>
            <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setSubmittedSearch(search.trim()); setPage(0); }}>
              <label htmlFor="admin-vendor-search">Search vendors<input id="admin-vendor-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Store, owner, email or category" /></label>
              <button className="admin-button" type="submit">Search</button>
            </form>
            {vendors.length === 0 ? <div className="admin-panel admin-empty">No vendor accounts match this search.</div> : <div className="admin-vendor-list">
              {vendors.map((vendor) => <article className="admin-panel admin-vendor" key={vendor.store_id}>
                <div className="admin-vendor-main"><div><h2>{vendor.store_name}</h2><a href={`/${encodeURIComponent(vendor.slug)}`} target="_blank" rel="noreferrer">/{vendor.slug}</a></div><span className={`admin-status ${vendor.store_status === "suspended" ? "is-danger" : "is-good"}`}>{title(vendor.store_status)}</span></div>
                <div className="admin-vendor-grid">
                  <div><small>Vendor</small><b>{vendor.full_name || "Name not provided"}</b><span>{vendor.email}</span></div>
                  <div><small>Subscription</small><b>{vendor.subscription_status ? title(vendor.subscription_status) : "No subscription"} · {vendor.plan_code ?? "—"}</b><span>Renews / ends {date(vendor.current_period_end)}</span></div>
                  <div><small>Store</small><b>{vendor.category || "Uncategorised"}</b><span>{vendor.is_published ? "Published" : "Unpublished"} · Joined {date(vendor.store_created_at)}</span></div>
                </div>
                {suspendTarget?.store_id === vendor.store_id ? <form className="admin-reason-form" onSubmit={(event) => { event.preventDefault(); void updateStore(vendor, pendingStoreStatus); }}>
                  <label htmlFor={`suspend-reason-${vendor.store_id}`}>Reason for {pendingStoreStatus === "suspended" ? "suspending" : "reactivating"} this vendor/store</label>
                  <textarea id={`suspend-reason-${vendor.store_id}`} minLength={5} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add a clear reason for the audit record" />
                  <div><button className={`admin-button ${pendingStoreStatus === "suspended" ? "admin-button-danger" : ""}`} type="submit" disabled={busy === vendor.store_id || reason.trim().length < 5}>{busy === vendor.store_id ? "Saving…" : `Confirm ${pendingStoreStatus === "suspended" ? "suspension" : "reactivation"}`}</button><button className="admin-button admin-button-quiet" type="button" onClick={() => { setSuspendTarget(null); setReason(""); }}>Cancel</button></div>
                </form> : <div className="admin-vendor-actions">{vendor.store_status === "suspended" ? <button className="admin-button" type="button" onClick={() => { setPendingStoreStatus("active"); setSuspendTarget(vendor); setReason(""); }}>Reactivate store</button> : <button className="admin-button admin-button-danger-outline" type="button" onClick={() => { setPendingStoreStatus("suspended"); setSuspendTarget(vendor); setReason(""); }}>Suspend vendor/store</button>}</div>}
              </article>)}
            </div>}
            <div className="admin-pagination"><button type="button" className="admin-button admin-button-quiet" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page + 1}</span><button type="button" className="admin-button admin-button-quiet" disabled={vendors.length < 50} onClick={() => setPage((p) => p + 1)}>Next</button></div>
          </>}

          {!loading && !forbidden && tab === "payments" && <>
            <p className="admin-intro">Subscription payment rows and provider webhook delivery status. Webhook payloads are intentionally not exposed.</p>
            <div className="admin-panel"><h2>Subscription payments</h2>{payments.length === 0 ? <p className="admin-muted">No payment events recorded.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Vendor / store</th><th>Reference</th><th>Amount</th><th>Status</th><th>Channel</th><th>Created</th><th>Paid</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.store?.name ?? payment.owner_id.slice(0, 8)}<small>{payment.store ? `/${payment.store.slug}` : payment.owner_id}</small></td><td>{payment.reference}</td><td>{money(payment.amount_kobo, payment.currency)}</td><td><span className={`admin-status ${payment.status === "success" ? "is-good" : payment.status === "failed" ? "is-danger" : "is-neutral"}`}>{title(payment.status)}</span></td><td>{payment.channel ?? "—"}</td><td>{date(payment.created_at)}</td><td>{date(payment.paid_at)}</td></tr>)}</tbody></table></div>}</div>
            <div className="admin-panel"><h2>Payment provider events</h2>{webhooks.length === 0 ? <p className="admin-muted">No webhook deliveries recorded.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Provider</th><th>Event</th><th>Reference</th><th>Received</th><th>Processed</th></tr></thead><tbody>{webhooks.map((event) => <tr key={event.id}><td>{event.provider}</td><td>{event.event}</td><td>{event.reference ?? "—"}</td><td>{date(event.received_at)}</td><td>{date(event.processed_at)}</td></tr>)}</tbody></table></div>}</div>
          </>}

          {!loading && !forbidden && tab === "support" && <>
            <div className="admin-filter"><label htmlFor="support-filter">Filter requests</label><select id="support-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All requests</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
            {requests.length === 0 ? <div className="admin-panel admin-empty">No support requests in this view.</div> : <div className="admin-support-list">{requests.map((request) => {
              const draft = supportDraft[request.id] ?? { status: request.status, note: request.admin_note };
              return <article className="admin-panel admin-ticket" key={request.id}>
                <div className="admin-ticket-head"><div><p>{title(request.request_type)} · {request.topic} · {date(request.created_at)}</p><h2>{request.name}</h2><a href={`mailto:${encodeURIComponent(request.email)}`}>{request.email}</a>{request.phone && <a href={`tel:${encodeURIComponent(request.phone)}`}>{request.phone}</a>}{request.reported_store_name && <span className="admin-ticket-store">Store: {request.reported_store_slug ? <a href={`/${encodeURIComponent(request.reported_store_slug)}`} target="_blank" rel="noreferrer">{request.reported_store_name} · /{request.reported_store_slug}</a> : request.reported_store_name}</span>}</div><span className={`admin-status ${request.status === "open" ? "is-warn" : request.status === "resolved" || request.status === "closed" ? "is-good" : "is-neutral"}`}>{title(request.status)}</span></div>
                <p className="admin-ticket-message">{request.message}</p>
                <form onSubmit={(event) => void updateTicket(event, request)} className="admin-ticket-form"><label>Status<select value={draft.status} onChange={(event) => setSupportDraft((current) => ({ ...current, [request.id]: { ...draft, status: event.target.value } }))}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label>Internal note<textarea maxLength={2000} value={draft.note} onChange={(event) => setSupportDraft((current) => ({ ...current, [request.id]: { ...draft, note: event.target.value } }))} placeholder="Add a private note for the support team" /></label><button className="admin-button" type="submit" disabled={busy === request.id}>{busy === request.id ? "Saving…" : "Save request"}</button></form>
              </article>;
            })}</div>}
          </>}

          {!loading && !forbidden && tab === "activity" && <div className="admin-panel"><h2>Administrative actions</h2><p className="admin-intro">Recent platform changes, including actor, target and the recorded reason.</p>{activity.length === 0 ? <p className="admin-muted">No administrative actions recorded yet.</p> : <ul className="admin-activity">{activity.map((entry) => <li key={entry.id}><div className="admin-activity-head"><strong>{title(entry.action)}</strong><time>{date(entry.created_at)}</time></div><p>{entry.actor_name} · {title(entry.target_type)} · {entry.target_id}</p><blockquote>{entry.reason}</blockquote>{Object.keys(entry.details ?? {}).length > 0 && <small>{Object.entries(entry.details).map(([key, value]) => `${title(key)}: ${String(value)}`).join(" · ")}</small>}</li>)}</ul>}</div>}

          {!loading && !forbidden && isSuperAdmin && tab === "admins" && <>
            <p className="admin-intro">Only super admins can manage access. Each regular admin can open only the pages selected below; sensitive actions are checked again by the server.</p>
            <form className="admin-panel admin-access-form" onSubmit={(event) => void addAdmin(event)}>
              <div className="admin-access-form-heading"><div><h2>Add an admin</h2><p>The person must already have a SellSharp account. Super admin access cannot be granted here.</p></div></div>
              <label className="admin-access-email">Account email<input type="email" required maxLength={254} value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="person@example.com" /></label>
              <fieldset className="admin-permission-fieldset"><legend>Pages this admin may access</legend><div className="admin-permission-grid">{ADMIN_PERMISSION_OPTIONS.map((option) => <label key={option.id} className="admin-permission-option"><input type="checkbox" checked={newPermissions.includes(option.id)} onChange={() => setNewPermissions((current) => setAdminPage(current, option.id))} /><span><b>{option.label}</b><small>{option.description}</small></span></label>)}</div></fieldset>
              <label className="admin-access-reason">Reason for granting access<input minLength={5} maxLength={1000} required value={adminReason} onChange={(event) => setAdminReason(event.target.value)} placeholder="Record why this account needs admin access" /></label>
              <button className="admin-button" type="submit" disabled={busy === "new-admin" || newPermissions.length === 0 || adminReason.trim().length < 5}>{busy === "new-admin" ? "Adding admin…" : "Add admin with selected pages"}</button>
            </form>
            <section className="admin-access-list"><div className="admin-access-list-heading"><h2>Admin accounts</h2><span>{admins.length} account{admins.length === 1 ? "" : "s"}</span></div>
              {admins.map((member) => <article className="admin-panel admin-member" key={member.user_id}>
                <div className="admin-member-header"><div><h3>{member.email}</h3><p>{member.role === "super_admin" ? "Full access to all pages and admin management" : `Added ${date(member.added_at)}`}</p></div><span className={`admin-status ${member.role === "super_admin" ? "is-good" : "is-neutral"}`}>{member.role === "super_admin" ? "Super admin" : "Admin"}</span></div>
                {member.role === "super_admin" ? <div className="admin-super-summary">Super admins can access every management page and assign permissions.</div> : <>
                  <fieldset className="admin-permission-fieldset"><legend>Allowed pages</legend><div className="admin-permission-grid">{ADMIN_PERMISSION_OPTIONS.map((option) => <label key={option.id} className="admin-permission-option"><input type="checkbox" checked={(adminDrafts[member.user_id]?.permissions ?? member.permissions).includes(option.id)} onChange={() => setAdminDrafts((current) => { const draft = current[member.user_id] ?? { permissions: member.permissions, reason: "" }; return { ...current, [member.user_id]: { ...draft, permissions: setAdminPage(draft.permissions, option.id) } }; })} /><span><b>{option.label}</b><small>{option.description}</small></span></label>)}</div></fieldset>
                  {removeTarget?.user_id === member.user_id ? <div className="admin-remove-confirm"><label>Reason for removing this admin<input minLength={5} maxLength={1000} value={adminDrafts[member.user_id]?.reason ?? ""} onChange={(event) => setAdminDrafts((current) => ({ ...current, [member.user_id]: { ...(current[member.user_id] ?? { permissions: member.permissions, reason: "" }), reason: event.target.value } }))} placeholder="Add the reason for the audit record" /></label><div><button className="admin-button admin-button-danger" type="button" disabled={busy === member.user_id || (adminDrafts[member.user_id]?.reason.trim().length ?? 0) < 5} onClick={() => void removeAdmin(member)}>{busy === member.user_id ? "Removing…" : "Confirm removal"}</button><button className="admin-button admin-button-quiet" type="button" onClick={() => setRemoveTarget(null)}>Cancel</button></div></div> : <div className="admin-member-actions"><label>Reason for permission changes<input minLength={5} maxLength={1000} value={adminDrafts[member.user_id]?.reason ?? ""} onChange={(event) => setAdminDrafts((current) => ({ ...current, [member.user_id]: { ...(current[member.user_id] ?? { permissions: member.permissions, reason: "" }), reason: event.target.value } }))} placeholder="Required for the audit log" /></label><button className="admin-button admin-button-quiet" type="button" onClick={() => setRemoveTarget(member)}>Remove admin</button><button className="admin-button" type="button" disabled={busy === member.user_id || (adminDrafts[member.user_id]?.permissions.length ?? 0) === 0 || (adminDrafts[member.user_id]?.reason.trim().length ?? 0) < 5} onClick={() => void saveAdminPermissions(member)}>{busy === member.user_id ? "Saving…" : "Save permissions"}</button></div>}
                </>}
              </article>)}
            </section>
          </>}
        </section>
      </div>
    </main>
  );
}
