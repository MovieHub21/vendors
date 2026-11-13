// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HttpError } from "../functions/_shared/http.ts";
import { parseProduct, slugify, uniqueSlug } from "../functions/_shared/products.ts";
import {
  parseItems,
  parsePayment,
  parsePublicOrder,
  parseSale,
  parseStatusChange,
  rpcError,
} from "../functions/_shared/sales.ts";

const PID = "0b8a1e1e-3d1c-4c3b-9d5a-1f2a3b4c5d6e";
const OID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpError ? `${e.status}:${e.code}` : String(e);
  }
  return null;
};

describe("line items", () => {
  it("public checkout drops any price the browser sends (the database prices the order)", () => {
    const [item] = parseItems([{ product_id: PID, quantity: 2, unit_price_kobo: 1, price: 1 }], "public");
    expect(item).toEqual({ quantity: 2, product_id: PID });
  });

  it("public checkout needs catalogue products", () => {
    expect(code(() => parseItems([{ name: "Custom", quantity: 1 }], "public"))).toBe("422:invalid_item");
  });

  it("vendor sales accept catalogue lines, price overrides and custom lines", () => {
    const items = parseItems(
      [
        { product_id: PID, quantity: 1, unit_price_kobo: 5_000_000 },
        { name: "Delivery", quantity: 1, unit_price_kobo: 200_000 },
      ],
      "vendor",
    );
    expect(items[0]).toEqual({ quantity: 1, product_id: PID, unit_price_kobo: 5_000_000 });
    expect(items[1]).toEqual({ quantity: 1, name: "Delivery", unit_price_kobo: 200_000 });
  });

  it.each([
    [[], "422:no_items"],
    ["nope", "422:no_items"],
    [[{ product_id: PID, quantity: 0 }], "422:invalid_item"],
    [[{ product_id: PID, quantity: 1.5 }], "422:invalid_item"],
    [[{ product_id: PID, quantity: "2" }], "422:invalid_item"],
    [[{ product_id: PID, quantity: 10_001 }], "422:invalid_item"],
    [[{ product_id: "not-a-uuid", quantity: 1 }], "422:invalid_input"],
    [[{ name: "No price", quantity: 1 }], "422:invalid_item"],
    [[{ quantity: 1, unit_price_kobo: 100 }], "422:invalid_item"],
    [[{ name: "Bad price", quantity: 1, unit_price_kobo: -5 }], "422:invalid_input"],
    [[{ name: "Float price", quantity: 1, unit_price_kobo: 10.5 }], "422:invalid_input"],
    [[{ name: "<b>x</b>", quantity: 1, unit_price_kobo: 100 }], "422:invalid_input"],
  ])("rejects %j", (items, expected) => {
    expect(code(() => parseItems(items, "vendor"))).toBe(expected);
  });

  it("limits a sale to 50 lines", () => {
    const many = Array.from({ length: 51 }, () => ({ product_id: PID, quantity: 1 }));
    expect(code(() => parseItems(many, "vendor"))).toBe("422:too_many_items");
  });
});

describe("recording a sale", () => {
  const base = { customer: { name: "Chidi Obi", phone: "0801 234 5678" }, items: [{ product_id: PID, quantity: 1 }] };

  it("defaults to walk-in with nothing paid", () => {
    const s = parseSale(base);
    expect(s.channel).toBe("walk_in");
    expect(s.paid_kobo).toBe(0);
    expect(s.method).toBeNull();
    expect(s.customer?.name).toBe("Chidi Obi");
  });

  it("needs a payment method only when something was paid", () => {
    expect(code(() => parseSale({ ...base, paid_kobo: 5_000_000 }))).toBe("422:invalid_input");
    expect(parseSale({ ...base, paid_kobo: 5_000_000, method: "bank_transfer" }).method).toBe("bank_transfer");
  });

  it("never accepts 'paystack' as a manual method", () => {
    expect(code(() => parseSale({ ...base, paid_kobo: 100, method: "paystack" }))).toBe("422:invalid_input");
  });

  it("accepts an existing customer id instead of customer details", () => {
    const s = parseSale({ items: base.items, customer_id: OID });
    expect(s.customer_id).toBe(OID);
    expect(s.customer).toBeNull();
  });

  it("rejects an unknown channel and a missing customer", () => {
    expect(code(() => parseSale({ ...base, channel: "tiktok" }))).toBe("422:invalid_input");
    expect(code(() => parseSale({ items: base.items }))).toBe("422:invalid_customer");
  });

  it("amounts must be whole kobo numbers, not strings", () => {
    expect(code(() => parseSale({ ...base, paid_kobo: "5000", method: "cash" }))).toBe("422:invalid_input");
  });
});

describe("public checkout", () => {
  const ok = {
    store_slug: "Ama-Hairs",
    customer: { name: "Ngozi", phone: "08031234567" },
    items: [{ product_id: PID, quantity: 1 }],
  };
  it("normalises the store slug and requires a phone number", () => {
    expect(parsePublicOrder(ok).store_slug).toBe("ama-hairs");
    expect(code(() => parsePublicOrder({ ...ok, customer: { name: "Ngozi" } }))).toBe("422:invalid_customer");
  });
  it("rejects a malformed store slug", () => {
    expect(code(() => parsePublicOrder({ ...ok, store_slug: "../etc" }))).toBe("422:store_not_found");
  });
});

describe("payments and statuses", () => {
  it("validates a manual payment", () => {
    expect(parsePayment({ order_id: OID, amount_kobo: 2_500_000, method: "cash" }).amount_kobo).toBe(2_500_000);
    expect(code(() => parsePayment({ order_id: OID, amount_kobo: 0, method: "cash" }))).toBe("422:invalid_input");
    expect(code(() => parsePayment({ order_id: OID, amount_kobo: 100, method: "paystack" }))).toBe("422:invalid_input");
    expect(code(() => parsePayment({ order_id: "x", amount_kobo: 100, method: "cash" }))).toBe("422:invalid_input");
  });
  it("accepts only the defined statuses", () => {
    expect(parseStatusChange({ order_id: OID, status: "ready_for_pickup" }).status).toBe("ready_for_pickup");
    expect(code(() => parseStatusChange({ order_id: OID, status: "paid" }))).toBe("422:invalid_input");
  });
  it("maps database errors to friendly HTTP errors", () => {
    expect(rpcError({ message: "insufficient_stock" }).status).toBe(409);
    expect(rpcError({ message: "overpayment" }).code).toBe("overpayment");
    expect(rpcError({ message: "something else entirely" }).status).toBe(500);
  });
});

describe("products", () => {
  it("makes clean, unique slugs", () => {
    expect(slugify("Ama's  Body-Wave Wig!")).toBe("amas-body-wave-wig");
    expect(uniqueSlug("Body Wave Wig", ["body-wave-wig", "body-wave-wig-2"])).toBe("body-wave-wig-3");
    expect(uniqueSlug("🔥🔥", [])).toBe("product");
  });
  it("requires a name and a positive whole-kobo price when creating", () => {
    expect(code(() => parseProduct({ price_kobo: 100 }, true))).toBe("422:invalid_input");
    expect(code(() => parseProduct({ name: "Wig", price_kobo: 0 }, true))).toBe("422:invalid_input");
    expect(code(() => parseProduct({ name: "Wig", price_kobo: 12.5 }, true))).toBe("422:invalid_input");
    expect(parseProduct({ name: "Wig", price_kobo: 4_500_000 }, true)).toEqual({ name: "Wig", price_kobo: 4_500_000 });
  });
  it("edits only the fields that were sent, and an empty stock means 'don't track'", () => {
    expect(parseProduct({ stock_quantity: null }, false)).toEqual({ stock_quantity: null });
    expect(parseProduct({ stock_quantity: 0 }, false)).toEqual({ stock_quantity: 0 });
    expect(code(() => parseProduct({ stock_quantity: -1 }, false))).toBe("422:invalid_input");
    expect(code(() => parseProduct({}, false))).toBe("422:nothing_to_update");
  });
  it("accepts https images only", () => {
    expect(parseProduct({ images: ["https://cdn.example.com/a.jpg"] }, false).images).toHaveLength(1);
    expect(code(() => parseProduct({ images: ["http://cdn.example.com/a.jpg"] }, false))).toBe("422:invalid_input");
    expect(code(() => parseProduct({ images: ["https://localhost/a.jpg"] }, false))).toBe("422:invalid_input");
  });
  it("rejects markup in text", () => {
    expect(code(() => parseProduct({ name: "<script>", price_kobo: 100 }, true))).toBe("422:invalid_input");
  });
});
