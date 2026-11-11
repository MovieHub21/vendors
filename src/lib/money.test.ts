import { describe, expect, it } from "vitest";
import { formatNaira, koboToDecimalString } from "./money";

describe("money", () => {
  it("formats whole naira without decimals and keeps kobo when present", () => {
    expect(formatNaira(4_500_000)).toBe("₦45,000");
    expect(formatNaira(1_850_050)).toBe("₦18,500.50");
  });
  it("renders structured-data prices from integer kobo", () => {
    expect(koboToDecimalString(4_500_000)).toBe("45000.00");
    expect(koboToDecimalString(1)).toBe("0.01");
  });
});
