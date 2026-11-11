import { useMemo, useSyncExternalStore } from "react";
import { getMinute, getServerMinute, minuteToDate, subscribeClock } from "./clock";

/** Null on the server and during hydration (so prerendered HTML matches), then the live time, updated each minute. */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeClock, getMinute, getServerMinute);
  return useMemo(() => (minute === null ? null : minuteToDate(minute)), [minute]);
}

export function greetingFor(date: Date | null): string {
  if (!date) return "Welcome back";
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
