import axios from "axios";
import { loadingStore } from "./loading";
import { API_BASE_URL } from "../config/env";

// Which API this build talks to is decided in config/env.js: a production build
// picks from a fixed allowlist of our own backends (production, staging), and
// still ignores any VITE_API_URL, so a stray build-time override can't repoint a
// deployed app at another host and get blocked by the CSP. Dev is unchanged and
// still honours VITE_API_URL (or localhost).
const api = axios.create({ baseURL: API_BASE_URL });

// True when the app is running as an installed PWA (standalone), not a browser tab.
const isStandalone = () =>
  (typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
      window.matchMedia?.("(display-mode: minimal-ui)")?.matches ||
      window.navigator?.standalone === true)) ||
  false;

api.interceptors.request.use(
  (config) => {
    if (!config.skipLoader) loadingStore.start();
    // An admin "view as" tab uses a per-tab read-only token (sessionStorage), so
    // it never collides with an admin's own signed-in session (localStorage) in
    // another tab of the same origin.
    const token = sessionStorage.getItem("viewToken") || localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Tell the server how the app is being used (installed PWA vs browser).
    config.headers["X-Display-Mode"] = isStandalone() ? "standalone" : "browser";
    // An assistant may be engaged with several clinics — tell the server which
    // one is active so clinic-scoped data (and notifications) resolve correctly.
    const activeClinic = localStorage.getItem("activeClinicId");
    if (activeClinic) config.headers["X-Active-Clinic"] = activeClinic;
    return config;
  },
  (err) => {
    if (!err.config?.skipLoader) loadingStore.done();
    return Promise.reject(err);
  }
);

api.interceptors.response.use(
  (res) => {
    if (!res.config.skipLoader) loadingStore.done();
    return res;
  },
  (err) => {
    if (!err.config?.skipLoader) loadingStore.done();
    if (err.response?.status === 401) {
      if (sessionStorage.getItem("viewToken")) {
        sessionStorage.removeItem("viewToken");
        sessionStorage.removeItem("viewAs");
        sessionStorage.removeItem("viewUser");
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("activeClinicId");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
