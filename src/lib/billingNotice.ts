import type { Me } from "../services/api";

export interface BillingNotice {
  kind: "renewal_failed" | "expired" | "ending_soon";
  title: string;
  body: string;
  action: "update_card" | "renew";
}

const DAY = 86_400_000;
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** What (if anything) the vendor needs to be told about their payment. Pure, so every case is tested. */
export function billingNotice(me: Me, now = Date.now()): BillingNotice | null {
  const b = me.billing;
  if (!b) return null; // never subscribed (onboarding handles that), or the billing update isn't deployed yet
  const end = new Date(b.period_end).getTime();
  const live = me.subscription?.active === true;

  if (b.state === "renewal_failed") {
    const reason = b.failure_reason ? `${b.failure_reason.replace(/[.\s]+$/, "")}. ` : "";
    return {
      kind: "renewal_failed",
      title: "Your renewal payment failed",
      body: live
        ? `${reason}Update your card before ${fmt(b.period_end)} to keep your store live.`
        : `${reason}Your store is offline until the payment goes through. Your products and orders are safe.`,
      action: b.can_update_card ? "update_card" : "renew",
    };
  }
  if (b.state === "expired") {
    return {
      kind: "expired",
      title: `Your subscription ended on ${fmt(b.period_end)}`,
      body: "Your store is offline and changes are locked until you renew. Your products and orders are safe.",
      action: "renew",
    };
  }
  if (b.state === "active" && !b.auto_renew && end - now <= 7 * DAY) {
    return {
      kind: "ending_soon",
      title: `Your subscription ends on ${fmt(b.period_end)}`,
      body: "Automatic renewal is off. Renew now to keep your store live.",
      action: "renew",
    };
  }
  return null;
}
