import axios from "axios";
import { loadingStore } from "./loading";

// Production always talks to the deployed Render API — this is the backend the
// app has always used, and the one the Content-Security-Policy allows. We do NOT
// read VITE_API_URL in production on purpose, so a stray build-time env override
// can't repoint the live app at another host and get blocked by the CSP.
// Dev still uses VITE_API_URL (or localhost).
const baseURL = import.meta.env.PROD
  ? "https://mymedin-server.onrender.com/api"
  : import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL });

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
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Tell the server how the app is being used (installed PWA vs browser).
    config.headers["X-Display-Mode"] = isStandalone() ? "standalone" : "browser";
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
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(err);
  }
);

export default api;
