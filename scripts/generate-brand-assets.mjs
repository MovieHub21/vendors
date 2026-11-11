/**
 * Generates the PNG brand assets in /public (social preview, touch icon, logo) from SVG.
 * Run with `npm run assets`. The social preview is a placeholder: replace public/og-default.png with a designed
 * 1200×630 image whenever you have one — nothing else needs to change.
 */
import fs from "node:fs";
import sharp from "sharp";

const icon = fs.readFileSync("public/favicon.svg");
const font = "Helvetica, Arial, sans-serif";

await sharp(icon).resize(180, 180).png().toFile("public/apple-touch-icon.png");
await sharp(icon).resize(512, 512).png().toFile("public/logo-512.png");

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101b2b"/><stop offset="1" stop-color="#1d2d42"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1020" cy="120" r="260" fill="#9878dc" opacity="0.18"/>
  <g transform="translate(90 96) scale(1.4)"><rect width="64" height="64" rx="16" fill="#fff"/>
    <path d="M19 25h26l-2 22H21z" fill="none" stroke="#172b43" stroke-width="4" stroke-linejoin="round"/>
    <path d="M26 25v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#172b43" stroke-width="4" stroke-linecap="round"/>
    <circle cx="49" cy="17" r="5" fill="#9878dc"/></g>
  <text x="200" y="168" font-family="${font}" font-size="60" font-weight="800" fill="#fff">sell<tspan font-weight="400">sharp</tspan><tspan fill="#9878dc">.</tspan></text>
  <text x="90" y="350" font-family="${font}" font-size="76" font-weight="800" fill="#fff">Your online store,</text>
  <text x="90" y="440" font-family="${font}" font-size="76" font-weight="800" fill="#b6a2e4">orders and receipts.</text>
  <text x="90" y="540" font-family="${font}" font-size="34" fill="#c0c6d0">Built for Nigerian WhatsApp vendors · ₦3,000/month</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile("public/og-default.png");
console.log("brand assets written to public/");
