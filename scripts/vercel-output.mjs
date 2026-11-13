/**
 * Vercel only: packages dist/ + the edge function as a Build Output (.vercel/output), so stores and products are
 * rendered on the server and link previews work. Does nothing on other hosts (local builds, Cloudflare).
 */
import fs from "node:fs";
import path from "node:path";

if (!process.env.VERCEL) {
  console.log("vercel-output: not running on Vercel, skipped");
  process.exit(0);
}

const out = path.resolve(".vercel/output");
const fn = path.join(out, "functions/ssr.func");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(fn, { recursive: true });

fs.cpSync(path.resolve("dist"), path.join(out, "static"), {
  recursive: true,
  filter: (src) => !/[\\/](_worker\.js|_routes\.json|_redirects|_headers)$/.test(src),
});
fs.copyFileSync(path.resolve("dist-vercel/index.js"), path.join(fn, "index.js"));
fs.writeFileSync(path.join(fn, ".vc-config.json"), JSON.stringify({ runtime: "edge", entrypoint: "index.js" }));

const security = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/assets/(.*)", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
        { src: "/(.*)", headers: security, continue: true },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/ssr?__p=$1" },
      ],
    },
    null,
    2,
  ),
);
console.log("vercel-output: wrote .vercel/output (static + ssr edge function)");
