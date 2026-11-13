import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Bundles src/edge/vercel.ts (React server rendering + data layer) into ONE file: dist-vercel/index.js. */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  ssr: { target: "webworker", noExternal: true },
  build: {
    ssr: "src/edge/vercel.ts",
    outDir: "dist-vercel",
    emptyOutDir: true,
    target: "es2022",
    minify: true,
    rollupOptions: { output: { entryFileNames: "index.js", format: "es", inlineDynamicImports: true } },
  },
});
