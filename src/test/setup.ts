import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  if (typeof document === "undefined") return; // node-environment tests (database, edge function logic)
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});
