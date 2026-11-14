import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileText,
  Package,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { greetingFor, useNow } from "../hooks/useNow";

/** Five weekly labels ending today. Falls back to fixed labels until the page has mounted (keeps hydration stable). */
function chartDateLabels(now: Date | null): string[] {
  if (!now) return ["Oct 13", "Oct 20", "Oct 27", "Nov 3", "Nov 10"];
  return [28, 21, 14, 7, 0].map((daysAgo) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace(/^(\d+) (\w+)$/, "$2 $1");
  });
}

export function DashboardPreview() {
  const now = useNow();
  const greeting = greetingFor(now);
  const dateLabel = now
    ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).replace(",", "").toUpperCase()
    : "TODAY";
  const chartLabels = chartDateLabels(now);
  return (
    <div className="dashboard-shell">
      <div className="dash-top">
        <div className="dash-brand">
          <span className="mini-mark">
            <ShoppingBag size={12} />
          </span>{" "}
          sellsharp
        </div>
        <div className="dash-top-right">
          <span className="live-dot" /> Store is live <span className="avatar">A</span>
        </div>
      </div>
      <div className="dash-content">
        <aside className="dash-side">
          <span className="side-label">WORKSPACE</span>
          <div className="side-item active">
            <BarChart3 size={14} /> Overview
          </div>
          <div className="side-item">
            <ClipboardList size={14} /> Orders <b>8</b>
          </div>
          <div className="side-item">
            <Package size={14} /> Products
          </div>
          <div className="side-item">
            <Users size={14} /> Customers
          </div>
          <div className="side-item">
            <Wallet size={14} /> Debts
          </div>
          <div className="side-item">
            <FileText size={14} /> Receipts &amp; invoices
          </div>
          <span className="side-label side-label-bottom">STORE</span>
          <div className="side-item">
            <Store size={14} /> My storefront
          </div>
        </aside>
        <div className="dash-main">
          <div className="dash-welcome">
            <div>
              <small>{dateLabel}</small>
              <h3>
                {greeting}, Amara <span>✦</span>
              </h3>
              <p>Here's what's happening with your store today.</p>
            </div>
            <span className="dash-period">
              Last 30 days <ChevronDown size={12} />
            </span>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Total sales</span>
              <strong>₦482,500</strong>
              <small className="positive">
                ↗ 12.8% <i>vs last month</i>
              </small>
            </div>
            <div className="stat-card">
              <span>Orders</span>
              <strong>86</strong>
              <small className="positive">
                ↗ 8.2% <i>vs last month</i>
              </small>
            </div>
            <div className="stat-card">
              <span>Customers</span>
              <strong>64</strong>
              <small className="positive">
                ↗ 4 new <i>this week</i>
              </small>
            </div>
            <div className="stat-card">
              <span>Outstanding</span>
              <strong>₦36,000</strong>
              <small className="neutral">12 customers owing</small>
            </div>
          </div>
          <div className="dash-lower">
            <div className="chart-card">
              <div className="chart-title">
                <b>Sales overview</b>
                <span>
                  Revenue <ChevronDown size={11} />
                </span>
              </div>
              <div className="chart-total">
                ₦182,400 <small>this month</small>
              </div>
              <div className="chart">
                <div className="chart-y">
                  <span>₦80k</span>
                  <span>₦60k</span>
                  <span>₦40k</span>
                  <span>₦20k</span>
                  <span>₦0</span>
                </div>
                <div className="chart-plot">
                  <div className="grid-line l1" />
                  <div className="grid-line l2" />
                  <div className="grid-line l3" />
                  <div className="grid-line l4" />
                  <svg viewBox="0 0 420 120" preserveAspectRatio="none" aria-label="Illustrative sales chart">
                    <defs>
                      <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity=".25" />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 94 C28 85 34 72 62 80 S105 58 130 66 S170 44 198 59 S237 34 264 45 S300 20 330 35 S380 8 420 16 L420 120 L0 120Z"
                      fill="url(#fill)"
                    />
                    <path
                      d="M0 94 C28 85 34 72 62 80 S105 58 130 66 S170 44 198 59 S237 34 264 45 S300 20 330 35 S380 8 420 16"
                      fill="none"
                      stroke="#8b72db"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="chart-x">
                    {chartLabels.map((l) => (
                      <span key={l}>{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="orders-card">
              <div className="chart-title">
                <b>Recent orders</b>
                <span>
                  View all <ArrowUpRight size={11} />
                </span>
              </div>
              <div className="order-row">
                <span className="order-avatar lavender">CO</span>
                <div>
                  <b>Chiamaka O.</b>
                  <small>Order #SS-1082</small>
                </div>
                <strong>₦24,500</strong>
              </div>
              <div className="order-row">
                <span className="order-avatar peach">TA</span>
                <div>
                  <b>Tomi A.</b>
                  <small>Order #SS-1081</small>
                </div>
                <strong>₦18,000</strong>
              </div>
              <div className="order-row">
                <span className="order-avatar mint">IE</span>
                <div>
                  <b>Ife E.</b>
                  <small>Order #SS-1080</small>
                </div>
                <strong>₦32,000</strong>
              </div>
            </div>
          </div>
          <div className="dash-footnote">
            <span className="live-dot" /> Preview data — your real store will show your business activity.
          </div>
        </div>
      </div>
    </div>
  );
}
