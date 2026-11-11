import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Alert, AuthLayout } from "../components/AuthLayout";
import { Seo } from "../components/Seo";
import { PAGE_META } from "../data/pageMeta";
import { storePath } from "../lib/routes";
import { SITE } from "../lib/site";
import { getMe, type Me } from "../services/api";
import { signOut } from "../services/auth";

/** Placeholder home for a signed-in vendor. The real dashboard (orders, products, customers…) is Phase 3. */
export default function Dashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMe().then((r) => {
      if (cancelled) return;
      if (r.ok) setMe(r.data);
      else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (me && me.next_step !== "done") return <Navigate to="/onboarding" replace />;
  const firstName = me?.profile?.full_name.split(" ")[0];
  const until = me?.subscription
    ? new Date(me.subscription.current_period_end).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <Seo seo={{ ...PAGE_META.dashboard, noindex: true }} />
      <AuthLayout
        wide
        title={firstName ? `Welcome, ${firstName}` : "Your dashboard"}
        subtitle="Your store is set up. The full dashboard arrives in the next phase."
      >
        {error && <Alert kind="error">{error}</Alert>}
        {!me && !error && (
          <p className="auth-loading" role="status">
            Loading…
          </p>
        )}
        {me?.store && (
          <dl className="dash-facts">
            <div>
              <dt>Store</dt>
              <dd>{me.store.name}</dd>
            </div>
            <div>
              <dt>Store link</dt>
              <dd>
                <Link to={storePath(me.store.slug)}>
                  {SITE.url.replace(/^https?:\/\//, "")}/{me.store.slug} <ExternalLink size={13} />
                </Link>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{me.store.is_published ? "Live" : "Not live"}</dd>
            </div>
            {until && (
              <div>
                <dt>Subscription</dt>
                <dd>Active until {until}</dd>
              </div>
            )}
          </dl>
        )}
        <button
          type="button"
          className="btn btn-outline btn-full"
          onClick={async () => {
            await signOut();
            navigate("/", { replace: true });
          }}
        >
          Log out
        </button>
      </AuthLayout>
    </>
  );
}
