import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { buildThemeInitScript } from "./src/lib/themeConfig";

/** Inlines the day/night rule into <head> so the right theme is painted before any JS loads (no flash). */
function themeInit(): Plugin {
  return {
    name: "sellsharp-theme-init",
    transformIndexHtml: (html) => html.replace("<!--theme-init-->", `<script>${buildThemeInitScript()}</script>`),
  };
}

export default defineConfig({
  plugins: [react(), themeInit()],
});
