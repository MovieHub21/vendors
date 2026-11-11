/**
 * A tiny external "clock" store for useSyncExternalStore: the snapshot is the current minute (a stable number),
 * and subscribers are nudged every 30 s and whenever the tab becomes visible again (timers sleep in background tabs).
 * The server snapshot is null, so prerendered HTML and the first hydration pass never disagree with the client.
 */
const MINUTE = 60_000;

export function subscribeClock(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 30_000);
  const onVisible = () => document.visibilityState === "visible" && onChange();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onChange);
  };
}

export const getMinute = (): number => Math.floor(Date.now() / MINUTE);
export const getServerMinute = (): number | null => null;
export const minuteToDate = (minute: number): Date => new Date(minute * MINUTE);
