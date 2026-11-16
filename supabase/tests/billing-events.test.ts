// @vitest-environment node
/** Every Paystack billing event, with the payload shapes Paystack sends. */
import { describe, expect, it, vi } from "vitest";
import { customerOf, handlePaystackEvent, planCodeOf, planMatches, type BillingDeps } from "../functions/_shared/billingEvents.ts";
import { HttpError } from "../functions/_shared/http.ts";
import type { PaystackVerifyData } from "../functions/_shared/paystack.ts";

const OURS = "PLN_ours";
const verifiedRenewal = (over: Partial<PaystackVerifyData> = {}): PaystackVerifyData => ({
  status: "success", reference: "T_renew_1", amount: 300000, currency: "NGN", id: 4242, channel: "card", paid_at: "2026-12-14T10:00:05Z",
  customer: { customer_code: "CUS_ama", email: "ama@example.com" }, plan: { plan_code: OURS }, ...over,
});

const deps = (over: Partial<BillingDeps> = {}, verified: PaystackVerifyData = verifiedRenewal()) => {
  const d: BillingDeps = {
    ourPlanCode: OURS,
    confirmCheckout: vi.fn(async () => ({ status: "success" })),
    verify: vi.fn(async () => verified),
    applyRenewal: vi.fn(async () => ({ already_applied: false })),
    recordFailure: vi.fn(async () => {}),
    recordState: vi.fn(async () => {}),
    ...over,
  };
  return d;
};
const charge = (reference: string, extra: Record<string, unknown> = {}) => ({ event: "charge.success", data: { reference, ...extra } });

describe("payload helpers", () => {
  it("reads a plan given as a code or as an object", () => {
    expect(planCodeOf("PLN_x")).toBe("PLN_x");
    expect(planCodeOf({ plan_code: "PLN_y", name: "Monthly" })).toBe("PLN_y");
    expect(planCodeOf({})).toBeNull();
    expect(planCodeOf(null)).toBeNull();
    expect(planCodeOf("")).toBeNull();
  });
  it("reads the customer", () => {
    expect(customerOf({ customer: { customer_code: "CUS_1", email: "a@b.co" } })).toEqual({ code: "CUS_1", email: "a@b.co" });
    expect(customerOf({})).toEqual({ code: null, email: null });
    expect(customerOf("nonsense")).toEqual({ code: null, email: null });
  });
  it("planMatches: true / false / unknown", () => {
    expect(planMatches("PLN_a", "PLN_a")).toBe(true);
    expect(planMatches("PLN_b", "PLN_a")).toBe(false);
    expect(planMatches(null, "PLN_a")).toBeNull();
    expect(planMatches("PLN_a", null)).toBeNull();
  });
});

describe("charge.success: our own checkout", () => {
  it("is confirmed exactly as before, and never treated as a renewal", async () => {
    const d = deps();
    expect(await handlePaystackEvent(charge("ss_sub_abc123"), d)).toEqual({ outcome: "processed", detail: "checkout_confirmed" });
    expect(d.confirmCheckout).toHaveBeenCalledWith("ss_sub_abc123");
    expect(d.verify).not.toHaveBeenCalled();
    expect(d.applyRenewal).not.toHaveBeenCalled();
  });
  it("is acknowledged (not retried forever) when the payment is unknown or the amount is wrong", async () => {
    for (const code of ["payment_not_found", "payment_mismatch"]) {
      const d = deps({ confirmCheckout: vi.fn(async () => { throw new HttpError(409, code); }) });
      expect(await handlePaystackEvent(charge("ss_sub_x"), d)).toEqual({ outcome: "ignored", detail: code });
    }
  });
  it("still raises real failures so Paystack retries", async () => {
    const d = deps({ confirmCheckout: vi.fn(async () => { throw new HttpError(500, "internal_error"); }) });
    await expect(handlePaystackEvent(charge("ss_sub_x"), d)).rejects.toThrow();
  });
});

describe("charge.success: an automatic monthly renewal (Paystack's own reference)", () => {
  it("verifies with Paystack, then extends the vendor using Paystack's figures", async () => {
    const d = deps();
    const r = await handlePaystackEvent(charge("T_renew_1", { amount: 1, customer: { customer_code: "CUS_fake" } }), d);
    expect(r).toEqual({ outcome: "processed", detail: "renewal_applied" });
    expect(d.verify).toHaveBeenCalledWith("T_renew_1");
    expect(d.applyRenewal).toHaveBeenCalledWith({
      customer_code: "CUS_ama", email: "ama@example.com", allow_email: true, reference: "T_renew_1",
      amount_kobo: 300000, currency: "NGN", transaction_id: 4242, channel: "card", paid_at: "2026-12-14T10:00:05Z",
    }); // the webhook body's fake amount and customer are ignored
  });

  it("reports a repeat delivery as already applied", async () => {
    const d = deps({ applyRenewal: vi.fn(async () => ({ already_applied: true })) });
    expect(await handlePaystackEvent(charge("T_renew_1"), d)).toEqual({ outcome: "processed", detail: "renewal_already_applied" });
  });

  it("reads the plan from the webhook body when Paystack's verify response omits it", async () => {
    const d = deps({}, verifiedRenewal({ plan: undefined }));
    await handlePaystackEvent(charge("T_renew_1", { plan: { plan_code: OURS } }), d);
    expect(vi.mocked(d.applyRenewal).mock.calls[0][0].allow_email).toBe(true);
  });

  it("when Paystack doesn't say which plan, the customer code still matches but the email fallback is off", async () => {
    const d = deps({}, verifiedRenewal({ plan: undefined }));
    await handlePaystackEvent(charge("T_renew_1"), d);
    expect(vi.mocked(d.applyRenewal).mock.calls[0][0].allow_email).toBe(false);
  });

  it("ignores a charge for a different plan on the same Paystack account", async () => {
    const d = deps({}, verifiedRenewal({ plan: { plan_code: "PLN_other_product" } }));
    expect(await handlePaystackEvent(charge("T_renew_1"), d)).toEqual({ outcome: "ignored", detail: "different_plan" });
    expect(d.applyRenewal).not.toHaveBeenCalled();
  });

  it.each([["failed"], ["abandoned"], ["reversed"], ["pending"]])("does nothing for a %s transaction", async (status) => {
    const d = deps({}, verifiedRenewal({ status }));
    expect(await handlePaystackEvent(charge("T_renew_1"), d)).toEqual({ outcome: "ignored", detail: "not_a_successful_charge" });
    expect(d.applyRenewal).not.toHaveBeenCalled();
  });

  it("refuses a verify response about a different transaction", async () => {
    const d = deps({}, verifiedRenewal({ reference: "T_someone_else" }));
    expect((await handlePaystackEvent(charge("T_renew_1"), d)).outcome).toBe("ignored");
    expect(d.applyRenewal).not.toHaveBeenCalled();
  });

  it("ignores charges with no customer or no reference", async () => {
    expect(await handlePaystackEvent(charge("T_renew_1"), deps({}, verifiedRenewal({ customer: null })))).toEqual({ outcome: "ignored", detail: "no_customer" });
    expect(await handlePaystackEvent({ event: "charge.success", data: {} }, deps())).toEqual({ outcome: "ignored", detail: "no_reference" });
  });

  it("acknowledges a vendor we don't know and an amount that isn't the plan price (and leaves them for review)", async () => {
    for (const code of ["billing_account_not_found", "payment_mismatch"]) {
      const d = deps({ applyRenewal: vi.fn(async () => { throw new HttpError(409, code); }) });
      expect(await handlePaystackEvent(charge("T_renew_1"), d)).toEqual({ outcome: "ignored", detail: code });
    }
  });

  it("raises Paystack outages and database errors so the event is retried", async () => {
    await expect(handlePaystackEvent(charge("T_renew_1"), deps({ verify: vi.fn(async () => { throw new Error("paystack down"); }) }))).rejects.toThrow("paystack down");
    await expect(handlePaystackEvent(charge("T_renew_1"), deps({ applyRenewal: vi.fn(async () => { throw new HttpError(500, "internal_error"); }) }))).rejects.toThrow();
  });

  it("without a configured plan, nothing can be matched by email", async () => {
    const d = deps({ ourPlanCode: null });
    await handlePaystackEvent(charge("T_renew_1"), d);
    expect(vi.mocked(d.applyRenewal).mock.calls[0][0].allow_email).toBe(false);
  });
});

describe("invoice.payment_failed", () => {
  const failed = (data: Record<string, unknown>) => ({ event: "invoice.payment_failed", data });

  it("flags the vendor and passes Paystack's reason", async () => {
    const d = deps();
    const r = await handlePaystackEvent(
      failed({ customer: { customer_code: "CUS_ama", email: "ama@example.com" }, subscription: { plan: { plan_code: OURS } }, transaction: { reference: "T_fail_1", gateway_response: "Insufficient funds" } }),
      d,
    );
    expect(r).toEqual({ outcome: "processed", detail: "renewal_failure_recorded" });
    expect(d.recordFailure).toHaveBeenCalledWith({ customer_code: "CUS_ama", email: "ama@example.com", allow_email: true, reference: "T_fail_1", reason: "Insufficient funds" });
  });

  it("copes with the sparse payloads Paystack sometimes sends", async () => {
    const d = deps();
    await handlePaystackEvent(failed({ customer: { customer_code: "CUS_ama" }, transaction: {}, description: "Card expired" }), d);
    expect(d.recordFailure).toHaveBeenCalledWith({ customer_code: "CUS_ama", email: null, allow_email: false, reference: null, reason: "Card expired" });
    await handlePaystackEvent(failed({ customer: { customer_code: "CUS_ama" } }), d);
    expect(vi.mocked(d.recordFailure).mock.calls[1][0].reason).toBe("The payment was declined.");
  });

  it("ignores another plan, a missing customer, and unknown vendors", async () => {
    const other = deps();
    expect(await handlePaystackEvent(failed({ customer: { customer_code: "CUS_x" }, subscription: { plan: { plan_code: "PLN_other" } } }), other)).toEqual({ outcome: "ignored", detail: "different_plan" });
    expect(other.recordFailure).not.toHaveBeenCalled();
    expect(await handlePaystackEvent(failed({}), deps())).toEqual({ outcome: "ignored", detail: "no_customer" });
    const unknown = deps({ recordFailure: vi.fn(async () => { throw new HttpError(409, "billing_account_not_found"); }) });
    expect(await handlePaystackEvent(failed({ customer: { customer_code: "CUS_x" } }), unknown)).toEqual({ outcome: "ignored", detail: "billing_account_not_found" });
  });
});

describe("subscription events", () => {
  const sub = (event: string, data: Record<string, unknown>) => ({ event, data });
  it.each([
    ["subscription.create", "created"],
    ["subscription.not_renew", "not_renew"],
    ["subscription.disable", "disabled"],
  ] as const)("%s → %s", async (event, state) => {
    const d = deps();
    const r = await handlePaystackEvent(sub(event, { subscription_code: "SUB_1", customer: { customer_code: "CUS_ama", email: "ama@example.com" }, plan: { plan_code: OURS } }), d);
    expect(r).toEqual({ outcome: "processed", detail: `subscription_${state}` });
    expect(d.recordState).toHaveBeenCalledWith({ customer_code: "CUS_ama", email: "ama@example.com", allow_email: true, state, subscription_code: "SUB_1" });
  });
  it("ignores another plan and a missing customer", async () => {
    const d = deps();
    expect((await handlePaystackEvent(sub("subscription.create", { customer: { customer_code: "CUS_x" }, plan: { plan_code: "PLN_other" } }), d)).detail).toBe("different_plan");
    expect((await handlePaystackEvent(sub("subscription.disable", {}), d)).detail).toBe("no_customer");
    expect(d.recordState).not.toHaveBeenCalled();
  });
});

describe("everything else", () => {
  it.each(["invoice.create", "invoice.update", "subscription.expiring_cards", "customeridentification.success", "transfer.success", undefined])("%s is acknowledged and logged only", async (event) => {
    const d = deps();
    expect(await handlePaystackEvent({ event, data: { reference: "x" } }, d)).toEqual({ outcome: "ignored", detail: "not_a_billing_event" });
    for (const fn of Object.values(d)) if (typeof fn === "function") expect(fn).not.toHaveBeenCalled();
  });
});
