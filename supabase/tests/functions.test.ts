// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { bearerToken, corsHeaders, HttpError, readJsonObject } from "../functions/_shared/http.ts";
import { confirmPayment, newReference, type ConfirmDeps } from "../functions/_shared/payments.ts";
import { createPaystackClient, verifyPaystackSignature } from "../functions/_shared/paystack.ts";
import { parseStoreInput, slugFormatProblem } from "../functions/_shared/validation.ts";

const req = (body: string) => new Request("https://x.test", { method: "POST", body });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof HttpError ? `${e.status}:${e.code}` : String(e);
  }
  return null;
};

describe("http helpers", () => {
  it("echoes only allow-listed origins", () => {
    const allowed = ["https://sellsharp.ng"];
    expect(corsHeaders("https://sellsharp.ng", allowed)["Access-Control-Allow-Origin"]).toBe("https://sellsharp.ng");
    expect(corsHeaders("https://evil.example", allowed)["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(corsHeaders(null, allowed)["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("reads bearer tokens", () => {
    const r = (h?: string) => new Request("https://x.test", { headers: h ? { Authorization: h } : {} });
    expect(bearerToken(r("Bearer abc.def"))).toBe("abc.def");
    expect(bearerToken(r("bearer  abc"))).toBe("abc");
    expect(bearerToken(r("Basic abc"))).toBeNull();
    expect(bearerToken(r())).toBeNull();
  });

  it("accepts only JSON objects, and refuses huge bodies", async () => {
    expect(await readJsonObject(req('{"a":1}'))).toEqual({ a: 1 });
    expect(await readJsonObject(req(""))).toEqual({});
    expect(await code(readJsonObject(req("[1]")))).toBe("400:invalid_json");
    expect(await code(readJsonObject(req("nope")))).toBe("400:invalid_json");
    expect(await code(readJsonObject(req(JSON.stringify({ a: "x".repeat(11_000) }))))).toBe("413:body_too_large");
  });
});

describe("store input validation", () => {
  const ok = { name: "  Ama   Hair Studio ", slug: " Ama-Hairs ", category: "Hair & wigs", city: "Lagos", state: "" };

  it("cleans and accepts good input", () => {
    expect(parseStoreInput(ok)).toEqual({
      name: "Ama Hair Studio",
      slug: "ama-hairs",
      category: "Hair & wigs",
      city: "Lagos",
      state: null,
    });
  });

  it.each([
    [{ ...ok, name: "A" }, "422:invalid_input"],
    [{ ...ok, name: undefined }, "422:invalid_input"],
    [{ ...ok, name: 42 }, "422:invalid_input"],
    [{ ...ok, category: "" }, "422:invalid_input"],
    [{ ...ok, name: "x".repeat(81) }, "422:invalid_input"],
    [{ ...ok, slug: "ab" }, "422:invalid_slug"],
    [{ ...ok, slug: "has space" }, "422:invalid_slug"],
    [{ ...ok, slug: "../etc" }, "422:invalid_slug"],
    [{ ...ok, slug: undefined }, "422:invalid_slug"],
  ])("rejects %j", async (body, expected) => {
    expect(await code(Promise.resolve().then(() => parseStoreInput(body as Record<string, unknown>)))).toBe(expected);
  });

  it("slugFormatProblem mirrors the frontend rules", () => {
    expect(slugFormatProblem("ama-hairs")).toBeNull();
    expect(slugFormatProblem("a".repeat(31))).toBe("too_long");
    expect(slugFormatProblem("ama--x")).toBe("invalid_characters");
  });
});

describe("Paystack webhook signature", () => {
  const secret = "sk_test_secret";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ss_sub_1" } });
  const sign = (b: string, s = secret) => createHmac("sha512", s).update(b).digest("hex");

  it("accepts the genuine signature", async () => {
    expect(await verifyPaystackSignature(body, sign(body), secret)).toBe(true);
  });
  it("rejects tampered bodies, wrong secrets, missing and malformed signatures", async () => {
    expect(await verifyPaystackSignature(body + " ", sign(body), secret)).toBe(false);
    expect(await verifyPaystackSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(await verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(await verifyPaystackSignature(body, "not-hex", secret)).toBe(false);
    expect(await verifyPaystackSignature(body, sign(body), "")).toBe(false);
  });
});

describe("Paystack client", () => {
  const reply = (data: unknown, ok = true, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify({ status: ok, message: ok ? "ok" : "nope", data }), { status }));

  it("initializes a transaction in kobo with a plan only when given", async () => {
    const f = reply({ authorization_url: "https://checkout.paystack.com/abc", access_code: "a", reference: "r" });
    const tx = await createPaystackClient("sk", f as unknown as typeof fetch).initialize({
      email: "a@b.co",
      amountKobo: 300000,
      reference: "r",
      callbackUrl: "https://s/cb",
    });
    expect(tx.authorization_url).toContain("checkout.paystack.com");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk");
    expect(JSON.parse(init.body as string)).toMatchObject({ amount: 300000, currency: "NGN", reference: "r" });
    expect(JSON.parse(init.body as string).plan).toBeUndefined();
  });

  it("turns provider errors into exceptions", async () => {
    const f = reply(undefined, false, 400);
    await expect(createPaystackClient("sk", f as unknown as typeof fetch).verify("x")).rejects.toThrow("nope");
  });
});

describe("confirmPayment", () => {
  const data = {
    status: "success",
    reference: "ss_sub_1",
    amount: 300000,
    currency: "NGN",
    id: 99,
    channel: "card",
    paid_at: "2026-11-11T10:00:00Z",
  };
  const deps = (over: Partial<ConfirmDeps> = {}, verified = data) => {
    const d: ConfirmDeps = {
      verify: vi.fn(async () => verified),
      apply: vi.fn(async () => ({ already_applied: false })),
      markFailed: vi.fn(async () => {}),
      ...over,
    };
    return d;
  };

  it("applies a verified successful payment using Paystack's figures, not the caller's", async () => {
    const d = deps();
    expect(await confirmPayment("ss_sub_1", d)).toEqual({ status: "success", alreadyApplied: false });
    expect(d.apply).toHaveBeenCalledWith({
      reference: "ss_sub_1",
      amount_kobo: 300000,
      currency: "NGN",
      transaction_id: 99,
      channel: "card",
      paid_at: "2026-11-11T10:00:00Z",
    });
  });

  it("reports repeat deliveries as already applied", async () => {
    const d = deps({ apply: vi.fn(async () => ({ already_applied: true })) });
    expect(await confirmPayment("ss_sub_1", d)).toEqual({ status: "success", alreadyApplied: true });
  });

  it.each(["failed", "abandoned", "reversed"])("marks %s payments as failed and applies nothing", async (status) => {
    const d = deps({}, { ...data, status });
    expect(await confirmPayment("ss_sub_1", d)).toEqual({ status: "failed" });
    expect(d.markFailed).toHaveBeenCalledWith("ss_sub_1");
    expect(d.apply).not.toHaveBeenCalled();
  });

  it.each(["ongoing", "pending", "queued"])("leaves %s payments pending", async (status) => {
    const d = deps({}, { ...data, status });
    expect(await confirmPayment("ss_sub_1", d)).toEqual({ status: "pending" });
    expect(d.apply).not.toHaveBeenCalled();
    expect(d.markFailed).not.toHaveBeenCalled();
  });

  it("refuses a response about a different reference", async () => {
    const d = deps({}, { ...data, reference: "someone_else" });
    await expect(confirmPayment("ss_sub_1", d)).rejects.toThrow("reference_mismatch");
    expect(d.apply).not.toHaveBeenCalled();
  });

  it("generates unguessable, Paystack-safe references", () => {
    const a = newReference();
    expect(a).toMatch(/^ss_sub_[a-f0-9]{32}$/);
    expect(newReference()).not.toBe(a);
  });
});
