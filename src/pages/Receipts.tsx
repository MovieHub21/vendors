import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../components/AuthLayout";
import { DashboardShell, dateTime, PayBadge } from "../components/DashboardShell";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { listOrders, type OrderRow } from "../services/vendorData";

function ReceiptsView() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listOrders().then((result) => {
      if (result.ok) setOrders(result.data);
      else setError(result.message);
    });
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!orders) return <p className="auth-loading" role="status">Loading receipts…</p>;
  if (orders.length === 0) return <p className="empty dash-card">Receipts for your orders and recorded sales will appear here.</p>;

  return (
    <div className="dash-card table-scroll">
      <table className="dash-table">
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Receipt</th></tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.reference}</td>
              <td>{order.customers?.name ?? "Customer"}</td>
              <td>{dateTime(order.created_at)}</td>
              <td>{formatNaira(order.total_kobo)}</td>
              <td><PayBadge status={order.payment_status} /></td>
              <td>
                <Link className="link-btn" to={`/dashboard/receipt/${order.id}`}>View receipt</Link>
                {order.payment_status !== "paid" && order.status !== "cancelled" && (
                  <> · <Link className="link-btn" to={`/dashboard/invoice/${order.id}`}>Invoice</Link></>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length >= 300 && <p className="muted">Showing the latest 300 receipts.</p>}
    </div>
  );
}

export default function Receipts() {
  return (
    <DashboardShell seo={PAGE_META.dashboardReceipts} title="Receipts">
      {() => <ReceiptsView />}
    </DashboardShell>
  );
}
