import type { ReactNode } from "react";
import { ThemeContext } from "../hooks/themeContext";
import { useTheme } from "../hooks/useTheme";

/** Mounted once at the root so day/night auto-switching runs on every page (marketing and storefronts). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={useTheme()}>{children}</ThemeContext.Provider>;
}
