/** Paystack helpers. Pure (fetch is injected) so signature checks and verification are unit-tested in Node. */

const API = "https://api.paystack.co";

const hexToBytes = (hex: string) => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** Verify the current Paystack-Signature header using the webhook signing secret (whsec_...). */
export async function verifyPaystackWebhookSignature(
  rawBody: Uint8Array,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || !secret) return false;

  let timestampText: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name === "t") {
      if (timestampText !== null || !/^\d+$/.test(value)) return false;
      timestampText = value;
    } else if (name === "v1") {
      const colon = value.indexOf(":");
      const signature = colon < 0 ? "" : value.slice(colon + 1);
      if (/^[0-9a-f]{128}$/.test(signature)) signatures.push(signature);
    }
  }

  if (timestampText === null || !Number.isSafeInteger(Number(timestampText)) || Math.abs(nowSeconds - Number(timestampText)) > 300 || signatures.length === 0) return false;

  const enc = new TextEncoder();
  const prefix = enc.encode(`${timestampText}.`);
  const signedBody = new Uint8Array(prefix.length + rawBody.length);
  signedBody.set(prefix);
  signedBody.set(rawBody, prefix.length);
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["verify"]);
  for (const signature of signatures) {
    const sig = hexToBytes(signature);
    if (sig && await crypto.subtle.verify("HMAC", key, sig, signedBody)) return true;
  }
  return false;
}

/** Legacy Paystack signature, retained while an integration transitions to Paystack-Signature. */
export async function verifyPaystackSignature(
  rawBody: string | Uint8Array,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const sig = hexToBytes(signature);
  if (!sig) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, [
    "verify",
  ]);
  return crypto.subtle.verify("HMAC", key, sig, typeof rawBody === "string" ? enc.encode(rawBody) : rawBody); // constant-time comparison
}

export interface PaystackVerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  id: number;
  channel?: string;
  paid_at?: string | null;
  /** Who paid. Present on every verified transaction; renewals are matched to a vendor through customer_code. */
  customer?: { customer_code?: string | null; email?: string | null } | null;
  /** Set on charges made by a Paystack subscription plan: an object with plan_code, or the plan code itself. */
  plan?: unknown;
  plan_object?: unknown;
}

export interface InitializeInput {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  planCode?: string;
  metadata?: Record<string, unknown>;
}

export class PaystackError extends Error {}

export function createPaystackClient(secretKey: string, fetchImpl: typeof fetch = fetch) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !body?.status || body.data === undefined) {
      throw new PaystackError(body?.message ?? `Paystack request failed (${res.status})`);
    }
    return body.data;
  }

  return {
    initialize: (i: InitializeInput) =>
      call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: i.email,
          amount: i.amountKobo,
          currency: "NGN",
          reference: i.reference,
          callback_url: i.callbackUrl,
          ...(i.planCode ? { plan: i.planCode } : {}),
          metadata: i.metadata ?? {},
        }),
      }),
    /** A link where the customer can update the card behind their subscription. */
    manageLink: (subscriptionCode: string) =>
      call<{ link: string }>(`/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`),
    verify: (reference: string) => call<PaystackVerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`),
  };
}
