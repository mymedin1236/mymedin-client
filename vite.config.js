import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Keep a non-production build out of Google. The committed public/robots.txt is
// written for the live site (it allows the landing page and points at the real
// sitemap); on staging we overwrite it in the output with a blanket disallow,
// and drop the sitemap, so a staging URL can never be indexed or outrank the
// real one. Runs after Vite has copied public/, so it wins.
const noIndexPlugin = () => ({
  name: "mymedin-staging-noindex",
  apply: "build",
  closeBundle() {
    const out = resolve(process.cwd(), "dist");
    writeFileSync(resolve(out, "robots.txt"), "User-agent: *\nDisallow: /\n");
    writeFileSync(resolve(out, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
  },
});

// `mode` is "production" for any `vite build`; VITE_APP_ENV is what separates
// the production deployment from staging (see src/config/env.js). Vite lets a
// real environment variable override the .env files, which is how the Vercel
// staging project sets it without the repo diverging.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const appEnv = (env.VITE_APP_ENV || "").trim().toLowerCase();
  const isStaging = appEnv === "staging";
  // The installed PWA gets its own name and start scope on staging, so testers
  // can keep both apps installed side by side without confusing the two.
  const appName = isStaging ? "MyMedin (Staging)" : "MyMedin";

  return {
    plugins: [
      react(),
      ...(isStaging ? [noIndexPlugin()] : []),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.js",
        // "prompt": a new build waits and we ask the user to reload (see
        // components/UpdatePrompt.jsx) instead of silently reloading the page.
        registerType: "prompt",
        // We register the SW ourselves via `virtual:pwa-register/react` inside the
        // app bundle (external, hashed JS) — CSP-safe with no 'unsafe-inline'.
        injectRegister: null,
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        manifest: {
          name: appName,
          short_name: appName,
          description:
            "Find doctors nearby, book appointments, manage clients, supplies and finances.",
          theme_color: "#ffffff",
          background_color: "#f2f6fc",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "maskable-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        },
        devOptions: { enabled: true, type: "module" },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
