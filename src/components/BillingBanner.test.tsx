import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { billingNotice } from "../lib/billingNotice";
import { BillingBanner } from "./BillingBanner";
import { DashboardShell } from "./DashboardShell";
import { ThemeProvider } from "./ThemeProvider";

vi.mock("../services/api");
const backend = vi.mocked(api);

const NOW = new Date("2026-12-10T12:00:00Z").getTime();
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const store = {
  id: "s1",
  slug: "ama-hairs",
  name: "Ama Hair Studio",
  is_published: true,
  status: "active",
} as api.OwnStore;
const me = (over: Partial<api.Me> = {}): api.Me =>
  ({
    user: { id: "u1", email: "ama@example.com" },
    profile: { full_name: "Ama Okafor", phone: null },
    store,
    subscription: { plan_code: "monthly", status: "active", current_period_end: day(20), active: true },
    seo_status: null,
    billing: {
      state: "active",
      auto_renew: true,
      period_end: day(20),
      failed_at: null,
      failure_reason: null,
      can_update_card: true,
    },
    next_step: "done",
    ...over,
  }) as api.Me;

const billing = (b: Partial<api.Billing>, sub: Partial<api.SubscriptionSummary> = {}): api.Me =>
  me({
    billing: {
      state: "active",
      auto_renew: true,
      period_end: day(20),
      failed_at: null,
      failure_reason: null,
      can_update_card: true,
      ...b,
    },
    subscription: {
      plan_code: "monthly",
      status: "active",
      current_period_end: b.period_end ?? day(20),
      active: true,
      ...sub,
    },
  });

describe("billingNotice", () => {
  it("says nothing when everything is fine", () => {
    expect(billingNotice(me(), NOW)).toBeNull();
    expect(billingNotice(billing({ auto_renew: false, period_end: day(30) }), NOW)).toBeNull();
  });
  it("says nothing for a vendor who has never subscribed, or when the billing update isn't deployed", () => {
    expect(billingNotice(me({ billing: null, subscription: null }), NOW)).toBeNull();
    expect(billingNotice(me({ billing: undefined }), NOW)).toBeNull();
  });
  it("a failed renewal with the store still live: tells them to update the card before the date", () => {
    const n = billingNotice(
      billing({ state: "renewal_failed", period_end: day(2), failure_reason: "Insufficient funds." }),
      NOW,
    )!;
    expect(n).toMatchObject({ kind: "renewal_failed", title: "Your renewal payment failed", action: "update_card" });
    expect(n.body).toBe("Insufficient funds. Update your card before 12 December 2026 to keep your store live.");
  });
  it("a failed renewal with the store offline: shown even though they have no store access", () => {
    const n = billingNotice(
      billing(
        { state: "renewal_failed", period_end: day(-1), failure_reason: "Card expired" },
        { status: "expired", active: false },
      ),
      NOW,
    )!;
    expect(n.kind).toBe("renewal_failed");
    expect(n.body).toBe(
      "Card expired. Your store is offline until the payment goes through. Your products and orders are safe.",
    );
  });
  it("without a card page to send them to, the failed-renewal action is a normal payment", () => {
    expect(billingNotice(billing({ state: "renewal_failed", can_update_card: false }), NOW)!.action).toBe("renew");
  });
  it("an ended subscription asks them to renew", () => {
    const n = billingNotice(
      billing({ state: "expired", period_end: day(-3) }, { status: "expired", active: false }),
      NOW,
    )!;
    expect(n).toMatchObject({ kind: "expired", title: "Your subscription ended on 7 December 2026", action: "renew" });
  });
  it("warns a week ahead when automatic renewal is off, but not before", () => {
    expect(billingNotice(billing({ auto_renew: false, period_end: day(6) }), NOW)).toMatchObject({
      kind: "ending_soon",
      action: "renew",
    });
    expect(billingNotice(billing({ auto_renew: false, period_end: day(8) }), NOW)).toBeNull();
    expect(billingNotice(billing({ auto_renew: true, period_end: day(2) }), NOW)).toBeNull(); // Paystack will charge it
  });
});

describe("BillingBanner", () => {
  const assign = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("location", { ...window.location, assign });
  });
  afterEach(() => vi.unstubAllGlobals());

  const failed = () =>
    billing(
      { state: "renewal_failed", period_end: day(-1), failure_reason: "Insufficient funds" },
      { status: "expired", active: false },
    );

  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<BillingBanner me={me()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Update card sends the vendor to Paystack's card page", async () => {
    backend.getCardUpdateLink.mockResolvedValue({
      ok: true,
      data: { link: "https://paystack.com/manage/subscriptions/abc" },
    });
    render(<BillingBanner me={failed()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your renewal payment failed");
    fireEvent.click(screen.getByRole("button", { name: "Update card" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://paystack.com/manage/subscriptions/abc"));
    expect(backend.startSubscription).not.toHaveBeenCalled();
  });

  it("falls back to a normal payment when there is no card page, so the vendor is never stuck", async () => {
    backend.getCardUpdateLink.mockResolvedValue({ ok: true, data: { fallback: "checkout" } });
    backend.startSubscription.mockResolvedValue({
      ok: true,
      data: { authorization_url: "https://checkout.paystack.com/xyz", reference: "ss_sub_1" },
    });
    render(<BillingBanner me={failed()} />);
    fireEvent.click(screen.getByRole("button", { name: "Update card" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.paystack.com/xyz"));
  });

  it("falls back to a normal payment when the card page can't be reached", async () => {
    backend.getCardUpdateLink.mockResolvedValue({ ok: false, code: "request_failed", message: "x" });
    backend.startSubscription.mockResolvedValue({
      ok: true,
      data: { authorization_url: "https://checkout.paystack.com/xyz", reference: "ss_sub_2" },
    });
    render(<BillingBanner me={failed()} />);
    fireEvent.click(screen.getByRole("button", { name: "Update card" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.paystack.com/xyz"));
  });

  it("Renew now starts a payment, and shows an error if it can't", async () => {
    backend.startSubscription.mockResolvedValueOnce({
      ok: false,
      code: "payment_provider_error",
      message: "We couldn't start the payment. Please try again.",
    });
    render(
      <BillingBanner me={billing({ state: "expired", period_end: day(-3) }, { status: "expired", active: false })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Renew now · ₦3,000/ }));
    expect(await screen.findByText("We couldn't start the payment. Please try again.")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Renew now/ })).toBeEnabled();
  });
});

describe("dashboard access when the subscription has ended", () => {
  function Where() {
    return <span data-testid="where">{useLocation().pathname}</span>;
  }
  const renderShell = (data: api.Me) => {
    backend.getMe.mockResolvedValue({ ok: true, data });
    return render(
      <HelmetProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={["/dashboard/orders"]}>
            <Routes>
              <Route
                path="/dashboard/orders"
                element={
                  <DashboardShell
                    seo={{ title: "Orders", description: "Orders", path: "/dashboard/orders" }}
                    title="Orders"
                  >
                    {() => <p>order list</p>}
                  </DashboardShell>
                }
              />
              <Route path="*" element={<span>elsewhere</span>} />
            </Routes>
            <Where />
          </MemoryRouter>
        </ThemeProvider>
      </HelmetProvider>,
    );
  };
  beforeEach(() => vi.resetAllMocks());

  it("keeps the vendor on the dashboard, with the notice, when a renewal failed and the store is offline", async () => {
    renderShell(
      me({
        store: { ...store, is_published: false },
        subscription: { plan_code: "monthly", status: "expired", current_period_end: day(-1), active: false },
        billing: {
          state: "renewal_failed",
          auto_renew: true,
          period_end: day(-1),
          failed_at: day(-1),
          failure_reason: "Insufficient funds",
          can_update_card: true,
        },
        next_step: "subscribe",
      }),
    );
    expect(await screen.findByText("order list")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your renewal payment failed");
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard/orders");
  });

  it("keeps a vendor whose subscription simply ended, and offers Renew", async () => {
    renderShell(
      me({
        store: { ...store, is_published: false },
        subscription: { plan_code: "monthly", status: "expired", current_period_end: day(-5), active: false },
        billing: {
          state: "expired",
          auto_renew: false,
          period_end: day(-5),
          failed_at: null,
          failure_reason: null,
          can_update_card: false,
        },
        next_step: "subscribe",
      }),
    );
    expect(await screen.findByRole("button", { name: /Renew now/ })).toBeInTheDocument();
    expect(screen.getByText("order list")).toBeInTheDocument();
  });

  it("still sends someone who has NEVER subscribed to onboarding", async () => {
    renderShell(
      me({ subscription: null, billing: null, next_step: "subscribe", store: { ...store, is_published: false } }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/onboarding"));
  });

  it("sends someone with no store to onboarding too", async () => {
    renderShell(me({ store: null, subscription: null, billing: null, next_step: "create_store" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/onboarding"));
  });
});
