import { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import { MessageCircle, Package, Plus, Users, Wallet, ShoppingBag } from "lucide-react";
import { Alert } from "../components/AuthLayout";
import { DashboardShell, dateTime, PayBadge, StatusBadge } from "../components/DashboardShell";
import { ShareButton } from "../components/ShareButton";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { methodLabel, storeShareMessage, whatsappLink } from "../lib/sales";
import { storePath } from "../lib/routes";
import { absoluteUrl, SITE } from "../lib/site";
import type { Me } from "../services/api";
import { getDashboardSummary, type DashboardSummary } from "../services/sales";

function Stat({ label, value, to, hint }: { label: string; value: string | number; to?: string; hint?: string }) {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </>
  );
  return to ? (
    <Link className="stat-tile" to={to}>
      {body}
    </Link>
  ) : (
    <div className="stat-tile">{body}</div>
  );
}

function Overview({ me }: { me: Me }) {
  const [s, setS] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getDashboardSummary().then((r) => {
      if (cancelled) return;
      if (r.ok) setS(r.data.summary);

      else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const store = me.store!;
  const url = absoluteUrl(storePath(store.slug));
  const until = me.subscription ? new Date(me.subscription.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <>
      <div className="quick-actions">
        <Link className="btn btn-primary" to="/dashboard/sale">
          <Plus size={16} aria-hidden="true" /> Record sale
        </Link>
        <Link className="btn btn-outline" to="/dashboard/products?new=1">
          <Package size={16} aria-hidden="true" /> Add product
        </Link>
        <Link className="btn btn-outline" to="/dashboard/orders">
          <ShoppingBag size={16} aria-hidden="true" /> View orders
        </Link>
        <Link className="btn btn-outline" to="/dashboard/customers">
          <Users size={16} aria-hidden="true" /> View customers
        </Link>
        <Link className="btn btn-outline" to="/dashboard/customers?owing=1">
          <Wallet size={16} aria-hidden="true" /> View debts
        </Link>
        <a className="btn btn-outline" href={whatsappLink(storeShareMessage(store.name, url))} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={16} aria-hidden="true" /> Share my store
        </a>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {!s && !error && <p className="auth-loading">Loading your figures…</p>}
      {s && (
        <>
          <div className="stat-grid-dash">
            <Stat label="Total sales" value={formatNaira(s.total_sales_kobo)} />
            <Stat label="Sales today" value={formatNaira(s.sales_today_kobo)} />
            <Stat label="Sales this month" value={formatNaira(s.sales_month_kobo)} />
            <Stat label="Customers owe you" value={formatNaira(s.outstanding_kobo)} to="/dashboard/customers?owing=1" hint={`${s.debtors} customer${s.debtors === 1 ? "" : "s"}`} />
            <Stat label="Pending orders" value={s.pending_orders} to="/dashboard/orders?status=pending" hint="Waiting for you to confirm" />
            <Stat label="Awaiting delivery" value={s.awaiting_delivery} to="/dashboard/orders" />
            <Stat label="Total orders" value={s.total_orders} to="/dashboard/orders" />
            <Stat label="Customers" value={s.total_customers} to="/dashboard/customers" />
          </div>

          <div className="dash-two">
            <section className="dash-card">
              <h2>Recent orders</h2>
              {s.recent_orders.length === 0 ? (
                <p className="empty">No orders yet. Share your store link, or record a sale you made on WhatsApp or in person.</p>
              ) : (
                <ul className="dash-list">
                  {s.recent_orders.map((o) => (
                    <li key={o.id}>
                      <Link to={`/dashboard/orders?o=${o.id}`}>
                        <b>{o.customer_name}</b>
                        <small>
                          {o.reference} · {dateTime(o.created_at)}
                        </small>
                      </Link>
                      <span className="dash-list-end">
                        {formatNaira(o.total_kobo)} <StatusBadge status={o.status} /> <PayBadge status={o.payment_status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="dash-card">
              <h2>Recent payments</h2>
              {s.recent_transactions.length === 0 ? (
                <p className="empty">Payments you record will show here.</p>
              ) : (
                <ul className="dash-list">
                  {s.recent_transactions.map((t) => (
                    <li key={t.id}>
                      <Link to={`/dashboard/orders?o=${t.order_id}`}>
                        <b>{t.customer_name}</b>
                        <small>
                          {methodLabel(t.method)} · {t.source === "paystack" ? "Verified by Paystack" : "Recorded by you"} · {dateTime(t.recorded_at)}
                        </small>
                      </Link>
                      <span className="dash-list-end">{formatNaira(t.amount_kobo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="dash-card">
            <h2>Running low on stock</h2>
            {s.low_stock.length === 0 ? (
              <p className="empty">Nothing is running low. Products with a stock count show up here when 5 or fewer are left.</p>
            ) : (
              <ul className="dash-list">
                {s.low_stock.map((p) => (
                  <li key={p.id}>
                    <Link to="/dashboard/products">
                      <b>{p.name}</b>
                    </Link>
                    <span className="dash-list-end">{p.stock_quantity === 0 ? "Out of stock" : `${p.stock_quantity} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="dash-card dash-store">
        <div className="dash-store-head">
          <div>
            <p className="dash-store-label">Your store</p>
            <h2>{store.name}</h2>
          </div>
          <span className={`dash-store-status ${store.is_published ? "is-live" : "is-not-live"}`}>
            {store.is_published ? "Live" : "Not live"}
          </span>
        </div>

        <div className="dash-store-info">
          <div className="dash-store-address">
            <span className="dash-store-label">Store link</span>
            <Link to={storePath(store.slug)}>
              {SITE.url.replace(/^https?:\/\//, "")}/{store.slug}
            </Link>
          </div>
          {until && (
            <p className="dash-store-subscription">
              Subscription active until <time dateTime={me.subscription!.current_period_end}>{until}</time>
            </p>
          )}
        </div>

        <ShareButton path={storePath(store.slug)} kind="store" title={store.name} text={`Shop at ${store.name}`} />
        <p className="dash-store-note">Every order and payment you record has its own receipt.</p>
      </section>
    </>
  );
}

export default function Dashboard() {
  return (
    <DashboardShell seo={PAGE_META.dashboard} title="Your business today">
      {(me) => <Overview me={me} />}
    </DashboardShell>
  );
}
