import { createContext, useContext } from "react";
import type { useTheme } from "./useTheme";

export type ThemeContextValue = ReturnType<typeof useTheme>;
export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useThemeContext must be used inside <ThemeProvider>");
  return value;
}
