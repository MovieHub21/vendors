/**
 * Single source of truth for the day/night theme.
 * Imported by the app, the tests AND vite.config.ts (which inlines the same rule into
 * index.html so the correct theme is painted before React loads — no flash).
 */
export const THEME_STORAGE_KEY = "ss-theme-mode";

/** Local device time. Day = 06:00 up to (not including) 18:30. Lagos sunrise/sunset sit close to this all year. */
export const DAY_STARTS_AT_MINUTES = 6 * 60;
export const NIGHT_STARTS_AT_MINUTES = 18 * 60 + 30;

/** Matches --bg-ffffff in each theme; used for the browser UI colour (<meta name="theme-color">). */
export const THEME_COLORS = { light: "#ffffff", dark: "#0f1720" } as const;

export type Theme = "light" | "dark";
export type ThemeMode = "auto" | Theme;

export function resolveAutoTheme(date: Date): Theme {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= DAY_STARTS_AT_MINUTES && minutes < NIGHT_STARTS_AT_MINUTES ? "light" : "dark";
}

/** Pre-paint script. Kept dependency-free and wrapped in try/catch so it can never break the page. */
export function buildThemeInitScript(): string {
  return `(function(){try{var d=new Date(),m=d.getHours()*60+d.getMinutes(),t=m>=${DAY_STARTS_AT_MINUTES}&&m<${NIGHT_STARTS_AT_MINUTES}?"light":"dark",s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(s==="light"||s==="dark")t=s;var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;var c=${JSON.stringify(THEME_COLORS)};var el=document.querySelector('meta[name="theme-color"]');if(el)el.setAttribute("content",c[t])}catch(e){}})();`;
}
