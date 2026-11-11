/** Paystack helpers. Pure (fetch is injected) so signature checks and verification are unit-tested in Node. */

const API = "https://api.paystack.co";

const hexToBytes = (hex: string) => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** Paystack signs the raw request body with HMAC-SHA512 using your secret key (header: x-paystack-signature). */
export async function verifyPaystackSignature(
  rawBody: string,
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
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(rawBody)); // constant-time comparison
}

export interface PaystackVerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  id: number;
  channel?: string;
  paid_at?: string | null;
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
    verify: (reference: string) => call<PaystackVerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`),
  };
}
