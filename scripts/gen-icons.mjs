// Generates PWA + notification icons from an inline SVG. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
mkdirSync(publicDir, { recursive: true });

// Shared medical-cross mark (viewBox 0 0 512 512)
const CROSS = `M186 86
  L326 86 L326 186 L426 186 L426 326 L326 326 L326 426
  L186 426 L186 326 L86 326 L86 186 L186 186 Z`;

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
