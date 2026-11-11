/**
 * The one place that decides whether a payment is real. Both the webhook and the browser's "verify" call use it.
 * We never trust the webhook body or the browser: we ask Paystack directly, then let Postgres re-check the amount
 * against the stored payment and the plan price (apply_successful_payment).
 */
import type { PaystackVerifyData } from "./paystack.ts";

export interface ApplyArgs {
  reference: string;
  amount_kobo: number;
  currency: string;
  transaction_id: number;
  channel: string | null;
  paid_at: string | null;
}

export interface ConfirmDeps {
  verify(reference: string): Promise<PaystackVerifyData>;
  apply(args: ApplyArgs): Promise<{ already_applied: boolean }>;
  markFailed(reference: string): Promise<void>;
}

export type ConfirmResult =
  { status: "success"; alreadyApplied: boolean } | { status: "failed" } | { status: "pending" };

const FAILED = new Set(["failed", "abandoned", "reversed"]);

export async function confirmPayment(reference: string, deps: ConfirmDeps): Promise<ConfirmResult> {
  const data = await deps.verify(reference);
  if (data.reference !== reference) throw new Error("reference_mismatch");

  if (data.status === "success") {
    const applied = await deps.apply({
      reference,
      amount_kobo: data.amount,
      currency: data.currency,
      transaction_id: data.id,
      channel: data.channel ?? null,
      paid_at: data.paid_at ?? null,
    });
    return { status: "success", alreadyApplied: applied.already_applied };
  }
  if (FAILED.has(data.status)) {
    await deps.markFailed(reference);
    return { status: "failed" };
  }
  return { status: "pending" }; // ongoing, pending, queued: ask again later
}

export const newReference = (): string => `ss_sub_${crypto.randomUUID().replaceAll("-", "")}`;
