import { rewrite } from "@vercel/edge";

// Serve the static, SEO-optimised marketing page at the site root, while the
// React app (index.html) keeps every other route. Edge middleware runs before
// static file serving on Vercel, so `/` returns landing.html instead of the app
// shell — without touching the app or the local dev workflow (this only runs on
// Vercel; `npm run dev` still serves the app at /).
//
// Note: for repeat visitors with the installed PWA, the service worker serves
// the cached app shell for `/` directly (it never hits the network / this
// middleware), so the installed app still opens straight to the dashboard.
export const config = { matcher: "/" };

export default function middleware(request) {
  return rewrite(new URL("/landing.html", request.url));
}
