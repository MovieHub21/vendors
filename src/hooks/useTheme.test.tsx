import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "../lib/themeConfig";
import { useTheme } from "./useTheme";

const at = (h: number, m = 0) => new Date(2026, 10, 11, h, m);
const attr = () => document.documentElement.getAttribute("data-theme");

describe("useTheme", () => {
  beforeEach(() => vi.useFakeTimers({ now: at(17, 59) }));
  afterEach(() => vi.useRealTimers());

  it("starts light in the day and flips to dark at nightfall without a reload", () => {
    renderHook(() => useTheme());
    expect(attr()).toBe("light");
    act(() => {
      vi.setSystemTime(at(18, 31));
      vi.advanceTimersByTime(31_000);
    });
    expect(attr()).toBe("dark");
  });

  it("flips back to light at sunrise", () => {
    vi.setSystemTime(at(5, 55));
    renderHook(() => useTheme());
    expect(attr()).toBe("dark");
    act(() => {
      vi.setSystemTime(at(6, 1));
      vi.advanceTimersByTime(31_000);
    });
    expect(attr()).toBe("light");
  });

  it("cycles auto → light → dark → auto and remembers manual choices", () => {
    vi.setSystemTime(at(23, 0));
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("auto");
    expect(attr()).toBe("dark");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("light");
    expect(attr()).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("dark");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("auto");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("does not follow the clock while a manual mode is set", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    renderHook(() => useTheme());
    act(() => {
      vi.setSystemTime(at(23, 0));
      vi.advanceTimersByTime(60_000);
    });
    expect(attr()).toBe("light");
  });
});
