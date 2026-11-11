import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { applyTheme, readStoredMode, resolveTheme, storeMode } from "../lib/theme";
import type { Theme, ThemeMode } from "../lib/themeConfig";
import { getMinute, getServerMinute, minuteToDate, subscribeClock } from "./clock";

const ORDER: ThemeMode[] = ["auto", "light", "dark"];

/* The chosen mode lives in localStorage; this store lets React (and other open tabs) react to changes. */
const modeListeners = new Set<() => void>();
function subscribeMode(onChange: () => void) {
  modeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    modeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
function writeMode(mode: ThemeMode) {
  storeMode(mode);
  modeListeners.forEach((l) => l());
}

/**
 * mode "auto" follows the clock (light 06:00–18:30, dark otherwise) and keeps re-checking while the tab is open,
 * so the site flips at sunset/sunrise without a reload. "light"/"dark" are manual overrides.
 */
export function useTheme() {
  const mode = useSyncExternalStore<ThemeMode>(subscribeMode, readStoredMode, () => "auto");
  const minute = useSyncExternalStore(subscribeClock, getMinute, getServerMinute);

  const theme: Theme = useMemo(
    () => (minute === null ? "light" : resolveTheme(mode, minuteToDate(minute))),
    [mode, minute],
  );

  const applied = useRef(false);
  useEffect(() => {
    if (minute === null) return;
    applyTheme(theme, applied.current); // cross-fade only for live changes, never on first paint
    applied.current = true;
  }, [theme, minute]);

  const cycleMode = useCallback(() => writeMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]), [mode]);

  return { mode, theme, cycleMode };
}
