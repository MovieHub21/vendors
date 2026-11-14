/** Bank / payment details a vendor prints on invoices. Pure, so it is unit-tested in Node. Mirrors the table's checks. */
import { HttpError } from "./http.ts";

export interface PaymentDetailsInput {
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  extra_note: string | null;
}

const ACCOUNT_NUMBER = /^[0-9A-Za-z .-]{4,30}$/;
const FIELDS = [
  ["bank_name", 80, "Bank name"],
  ["account_name", 120, "Account name"],
  ["account_number", 30, "Account number"],
  ["extra_note", 300, "Other payment details"],
] as const;

function bad(message: string): never {
  throw new HttpError(422, "invalid_payment_details", message);
}

/** Blank boxes become null. Anything with < or > is refused, and the account number must look like one. */
export function parsePaymentDetails(body: Record<string, unknown>): PaymentDetailsInput {
  const out: PaymentDetailsInput = { bank_name: null, account_name: null, account_number: null, extra_note: null };
  for (const [key, max, label] of FIELDS) {
    const raw = body[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") bad(`${label} must be text.`);
    const value = raw.replace(/\s+/g, " ").trim();
    if (!value) continue;
    if (value.length > max) bad(`${label} can be at most ${max} characters.`);
    if (/[<>]/.test(value)) bad(`${label} can't contain < or >.`);
    out[key] = value;
  }
  if (out.account_number && !ACCOUNT_NUMBER.test(out.account_number)) {
    bad("Account number should be 4 to 30 letters or digits.");
  }
  return out;
}

export const hasPaymentDetails = (d: PaymentDetailsInput) => Object.values(d).some((v) => v !== null);
