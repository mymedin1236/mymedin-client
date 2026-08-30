// Generates PWA + notification icons from an inline SVG. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
mkdirSync(publicDir, { recursive: true });

// Shared medical-cross mark (viewBox 0 0 512 512).
// Arms are thinner than the original (100 thick vs. 140) so the cross reads as
// a slender plus instead of a bulky blob, while staying perfectly symmetric.
const CROSS = `M206 86
  L306 86 L306 206 L426 206 L426 306 L306 306 L306 426
  L206 426 L206 306 L86 306 L86 206 L206 206 Z`;

// App icon: white cross on a navy→blue gradient (full-bleed, good for maskable)
const appSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14233c"/>
      <stop offset="1" stop-color="#3a72e3"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <path fill="#ffffff" d="${CROSS}"/>
</svg>`;

// Notification badge: solid white cross on transparent (Android tints by alpha)
const badgeSvg = `<svg width="96" height="96" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <path fill="#ffffff" d="${CROSS}"/>
</svg>`;

const appBuf = Buffer.from(appSvg);
const appIcons = [
  { file: "pwa-192x192.png", size: 192 },
  { file: "pwa-512x512.png", size: 512 },
  { file: "maskable-512x512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];
for (const { file, size } of appIcons) {
  await sharp(appBuf).resize(size, size).png().toFile(resolve(publicDir, file));
  console.log("wrote", file);
}

// Monochrome transparent badge for push notifications
await sharp(Buffer.from(badgeSvg)).resize(96, 96).png().toFile(resolve(publicDir, "badge-96x96.png"));
console.log("wrote badge-96x96.png");

writeFileSync(resolve(publicDir, "favicon.svg"), appSvg);
console.log("wrote favicon.svg");
