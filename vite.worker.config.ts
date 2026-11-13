import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Bundles src/edge/worker.ts (React server rendering + the data layer) into ONE file for Cloudflare Pages: dist/_worker.js. */
export default defineConfig({
  plugins: [react()],
  ssr: { target: "webworker", noExternal: true },
  build: {
    ssr: "src/edge/worker.ts",
    outDir: "dist",
    emptyOutDir: false,
    target: "es2022",
    minify: true,
    rollupOptions: { output: { entryFileNames: "_worker.js", format: "es", inlineDynamicImports: true } },
  },
});
