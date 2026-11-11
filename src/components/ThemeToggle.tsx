import { Moon, Sun, SunMoon } from "lucide-react";
import { useThemeContext } from "../hooks/themeContext";

const LABELS = { auto: "Auto", light: "Light", dark: "Dark" } as const;
const ICONS = { auto: SunMoon, light: Sun, dark: Moon } as const;

/** Cycles Auto → Light → Dark. Auto follows the time of day (light 06:00–18:30, dark otherwise). */
export function ThemeToggle() {
  const { mode, theme, cycleMode } = useThemeContext();
  const Icon = ICONS[mode];
  const description =
    mode === "auto" ? `Auto: follows the time of day (now ${theme})` : `${LABELS[mode]} theme (fixed)`;
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycleMode}
      aria-label={`${description}. Press to change.`}
      title={description}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="theme-toggle-text">{LABELS[mode]}</span>
    </button>
  );
}
