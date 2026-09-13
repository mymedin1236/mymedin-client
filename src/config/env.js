// Which deployment this bundle is built for, and the settings that follow from
// it. One place, so the API it talks to, the analytics it reports to, and what
// the UI tells the user can never disagree with each other.
//
// SECURITY: a production build may only talk to an API on this allowlist. The
// env var SELECTS one of these; it never supplies a URL. That keeps the original
// guarantee — a stray or hostile build-time env value cannot repoint a deployed
// app at an arbitrary host — while still letting staging exist. An unrecognised
// value falls back to production rather than to something unexpected.
const API_BY_ENV = {
  production: "https://mymedin-server.onrender.com/api",
  staging: "https://mymedin-server-staging.onrender.com/api",
};

// Every origin a built app is allowed to call. Keep in step with the
// `connect-src` directive in vercel.json — the CSP is what actually enforces it
// in the browser; this list is what the app chooses from.
export const API_ORIGINS = Object.values(API_BY_ENV).map((u) => new URL(u).origin);

const requested = String(import.meta.env.VITE_APP_ENV || "").trim().toLowerCase();

// "development" whenever this isn't a production build (npm run dev), otherwise
// the requested environment if we recognise it, otherwise production.
export const APP_ENV = import.meta.env.PROD
  ? Object.prototype.hasOwnProperty.call(API_BY_ENV, requested)
    ? requested
    : "production"
  : "development";

export const IS_PRODUCTION = APP_ENV === "production";
export const IS_STAGING = APP_ENV === "staging";
export const IS_DEVELOPMENT = APP_ENV === "development";

// In a real build the API comes from the allowlist above. In dev, VITE_API_URL
// is still honoured (and falls back to a local server), which is what makes
// pointing a local app at a deployed API for debugging possible.
export const API_BASE_URL = import.meta.env.PROD
  ? API_BY_ENV[APP_ENV]
  : import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Analytics belong to production alone — staging and dev traffic would otherwise
// pollute the real funnel with test bookings and throwaway accounts.
export const ANALYTICS_TOKEN = IS_PRODUCTION
  ? import.meta.env.VITE_MIXPANEL_TOKEN
  : undefined;

// Shown in the UI on any non-production build, so nobody mistakes staging for
// the live app and enters (or trusts) real clinic data there.
export const ENV_LABEL = IS_STAGING ? "STAGING" : IS_DEVELOPMENT ? "DEV" : "";
