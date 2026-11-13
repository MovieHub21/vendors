import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import {
  safeNextPath,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
  validateStoreName,
} from "./validation";
=======
import { safeNextPath, validateEmail, validateFullName, validatePassword, validateStoreName } from "./validation";
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c

describe("validation", () => {
  it("emails", () => {
    expect(validateEmail("ama@example.com")).toBeNull();
    for (const bad of ["", "  ", "ama", "ama@", "ama@x", "a b@c.com"]) expect(validateEmail(bad), bad).not.toBeNull();
  });
  it("passwords need 8+ characters with a letter and a number", () => {
    expect(validatePassword("sellsharp2026")).toBeNull();
    for (const bad of ["", "short1", "allletters", "12345678"]) expect(validatePassword(bad), bad).not.toBeNull();
  });
  it("names", () => {
    expect(validateFullName("Ama Okafor")).toBeNull();
    expect(validateFullName("A")).not.toBeNull();
    expect(validateStoreName("Ama Hair Studio")).toBeNull();
    expect(validateStoreName("x".repeat(81))).not.toBeNull();
  });
});

<<<<<<< HEAD
describe("phone", () => {
  it("is optional and accepts Nigerian formats", () => {
    for (const ok of ["", "  ", "08031234567", "+234 803 123 4567", "(0803) 123-4567"])
      expect(validatePhone(ok), ok).toBeNull();
    for (const bad of ["call me", "123", "0803abc1234"]) expect(validatePhone(bad), bad).not.toBeNull();
  });
});

=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("/onboarding/payment?reference=abc")).toBe("/onboarding/payment?reference=abc");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "falls back for %s",
    (bad) => expect(safeNextPath(bad)).toBe("/onboarding"),
  );
});
