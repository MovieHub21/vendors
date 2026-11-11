import { afterEach, describe, expect, it, vi } from "vitest";
import { buildThemeInitScript, resolveAutoTheme, THEME_STORAGE_KEY } from "./themeConfig";

const at = (h: number, m = 0) => new Date(2026, 10, 11, h, m);

describe("resolveAutoTheme", () => {
  it.each([
    [0, 0, "dark"],
    [5, 59, "dark"],
    [6, 0, "light"],
    [12, 0, "light"],
    [18, 29, "light"],
    [18, 30, "dark"],
    [23, 59, "dark"],
  ] as const)("%i:%i → %s", (h, m, expected) => {
    expect(resolveAutoTheme(at(h, m))).toBe(expected);
  });
});

describe("pre-paint init script (inlined into index.html)", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  const run = () => new Function(buildThemeInitScript())();

  it("matches resolveAutoTheme for the same clock time", () => {
    for (const [h, m] of [
      [5, 59],
      [6, 0],
      [18, 29],
      [18, 30],
      [22, 0],
    ] as const) {
      vi.useFakeTimers({ now: at(h, m) });
      run();
      expect(document.documentElement.getAttribute("data-theme")).toBe(resolveAutoTheme(at(h, m)));
    }
  });

  it("lets a stored manual choice win over the clock", () => {
    vi.useFakeTimers({ now: at(13) });
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("ignores garbage in storage", () => {
    vi.useFakeTimers({ now: at(13) });
    localStorage.setItem(THEME_STORAGE_KEY, "purple");
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
