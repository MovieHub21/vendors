import { describe, expect, it } from "vitest";
import { nairaToKobo, koboToInput, previewSale, receiptText, whatsappLink, whatsappNumber, type ReceiptSnapshot } from "./sales";

describe("nairaToKobo", () => {
  it.each([
    ["75,000", 7_500_000],
    ["₦75000.50", 7_500_050],
    ["0.1", 10],
    ["1500.5", 150_050],
    [" 250 ", 25_000],
  ])("parses %s", (input, kobo) => expect(nairaToKobo(input)).toBe(kobo));

  it.each(["", "abc", "-5", "1.234", "1e5", "12,3,4x", "99999999999", "5."])("rejects %j", (input) =>
    expect(nairaToKobo(input)).toBeNull(),
  );

  it("round-trips through the amount box", () => {
    for (const k of [100, 2_500_000, 150_050, 1]) expect(nairaToKobo(koboToInput(k))).toBe(k);
  });
});

describe("previewSale", () => {
  it("shows the outstanding balance: ₦75,000 total, ₦50,000 paid → ₦25,000 owed", () => {
    expect(previewSale([{ quantity: 3, unitKobo: 2_500_000 }], 5_000_000)).toEqual({ total: 7_500_000, paid: 5_000_000, outstanding: 2_500_000 });
  });
});

describe("WhatsApp links", () => {
  it("normalises Nigerian numbers", () => {
    expect(whatsappNumber("0803 123 4567")).toBe("2348031234567");
    expect(whatsappNumber("+234 803 123 4567")).toBe("2348031234567");
    expect(whatsappNumber("12")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
  });
  it("builds a link that opens a chat with the customer, or the contact picker", () => {
    expect(whatsappLink("Hi & bye", "08031234567")).toBe("https://wa.me/2348031234567?text=Hi%20%26%20bye");
    expect(whatsappLink("Hi")).toBe("https://wa.me/?text=Hi");
  });
});

describe("receiptText", () => {
  const snap: ReceiptSnapshot = {
    business: { name: "Ama Hairs", logo_url: null, phone: null, email: null, city: null, state: null, slug: "ama-hairs" },
    customer: { name: "Chidi", phone: null, email: null, address: null },
    order: { reference: "SS-1234ABCD", channel: "whatsapp", status: "confirmed", created_at: "2026-11-13T10:00:00Z" },
    items: [{ name: "Body wave wig", variant: "18 inch", quantity: 1, unit_price_kobo: 7_500_000, line_total_kobo: 7_500_000 }],
    totals: { total_kobo: 7_500_000, paid_kobo: 5_000_000, outstanding_kobo: 2_500_000, payment_status: "partial" },
    payments: [],
    issued_at: "2026-11-13T10:00:00Z",
  };
  it("lists items, totals and the balance", () => {
    const t = receiptText("RC-000007", 2, snap);
    expect(t).toContain("Receipt RC-000007 (updated)");
    expect(t).toContain("Body wave wig (18 inch) × 1");
    expect(t).toContain("Balance:");
  });
});
