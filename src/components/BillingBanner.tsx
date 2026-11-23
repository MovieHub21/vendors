import { useState } from "react";
import { formatNaira } from "../lib/money";
import { SITE } from "../lib/site";
import { billingNotice } from "../lib/billingNotice";
import { getCardUpdateLink, startSubscription, type Me } from "../services/api";

/** Shown on every dashboard page, including for vendors whose store is offline. */
export function BillingBanner({ me }: { me: Me }) {
  const notice = billingNotice(me);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!notice) return null;

  async function act() {
    setBusy(true);
    setError(null);
    if (notice!.action === "update_card") {
      const link = await getCardUpdateLink();
      if (link.ok && link.data.link) {
        window.location.assign(link.data.link);
        return;
      }
      // No card page available: a normal payment also saves a new card, so never leave the vendor stuck.
    }
    const pay = await startSubscription();
    if (!pay.ok) {
      setBusy(false);
      setError(pay.message);
      return;
    }
    window.location.assign(pay.data.authorization_url);
  }

  return (
    <section
      className={`billing-banner billing-banner-${notice.kind}`}
      role="alert"
      aria-labelledby="billing-banner-title"
    >
      <div>
        <strong id="billing-banner-title">{notice.title}</strong>
        <p>{notice.body}</p>
        {error && <p className="billing-banner-error">{error}</p>}
      </div>
      <button type="button" className="btn btn-primary" onClick={act} disabled={busy}>
        {busy
          ? "Opening Paystack…"
          : notice.action === "update_card"
            ? "Update card"
            : notice.action === "subscribe"
              ? `Subscribe · ${formatNaira(SITE.monthlyPriceKobo)}/month`
              : `Renew now · ${formatNaira(SITE.monthlyPriceKobo)}`}
      </button>
    </section>
  );
}
