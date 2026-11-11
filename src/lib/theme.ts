import { THEME_COLORS, THEME_STORAGE_KEY, resolveAutoTheme, type Theme, type ThemeMode } from "./themeConfig";

export function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function storeMode(mode: ThemeMode) {
  try {
    if (mode === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* storage can be blocked (private mode); the theme still works for this visit */
  }
}

export function resolveTheme(mode: ThemeMode, now = new Date()): Theme {
  return mode === "auto" ? resolveAutoTheme(now) : mode;
}

/** Applies the theme to <html>. `animate` adds a short colour cross-fade for live switches (e.g. sunset). */
export function applyTheme(theme: Theme, animate = false) {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") === theme) return;
  if (animate) {
    root.classList.add("theme-fade");
    window.setTimeout(() => root.classList.remove("theme-fade"), 500);
  }
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}
