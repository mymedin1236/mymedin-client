import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import ConnectionError from "../components/ConnectionError";
import { identify, resetAnalytics, trackLogIn, trackLogOut, trackSignUp } from "../utils/analytics";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // An admin "view as" tab caches its (read-only) doctor user in sessionStorage
  // under a separate key, so it never overwrites the real "user" a signed-in
  // admin has cached in localStorage in another tab.
  const [user, setUser] = useState(() => {
    const rawView = sessionStorage.getItem("viewUser");
    if (rawView) return JSON.parse(rawView);
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);
  // The session couldn't be checked (no connection) and there's no cached user
  // to start from, so the app shows a "try again" screen instead of hanging.
  const [connectError, setConnectError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const checkSession = useCallback(() => {
    // Hand the splash screen over to the app once bootstrap completes
    const done = () => {
      setLoading(false);
      window.finishSplash?.();
    };
    const viewToken = sessionStorage.getItem("viewToken");
    const token = viewToken || localStorage.getItem("token");
    if (!token) {
      setConnectError(false);
      done();
      return;
    }
    // With a cached user the app opens straight away and the session is checked
    // in the background, so a slow or dropped connection never holds it on the
    // splash screen.
    const cached = viewToken ? sessionStorage.getItem("viewUser") : localStorage.getItem("user");
    if (cached) done();
    setRetrying(true);
    api
      .get("/auth/me", { timeout: 12000, skipLoader: !!cached })
      .then((r) => {
        setUser(r.data.user);
        if (viewToken) {
          sessionStorage.setItem("viewUser", JSON.stringify(r.data.user));
        } else {
          localStorage.setItem("user", JSON.stringify(r.data.user));
        }
        identify(r.data.user);
        setConnectError(false);
      })
      .catch((err) => {
        // Only a 401 means the session is gone. A timeout or network error
        // keeps the user signed in.
        if (err.response?.status === 401) {
          if (viewToken) {
            sessionStorage.removeItem("viewToken");
            sessionStorage.removeItem("viewAs");
            sessionStorage.removeItem("viewUser");
          } else {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
          }
          setUser(null);
          setConnectError(false);
        } else if (!cached) {
          setConnectError(true);
        }
      })
      .finally(() => {
        setRetrying(false);
        done();
      });
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Retry on its own as soon as the device comes back online.
  useEffect(() => {
    if (!connectError) return;
    window.addEventListener("online", checkSession);
    return () => window.removeEventListener("online", checkSession);
  }, [connectError, checkSession]);

  const login = async (identifier, password, remember = true) => {
    const { data } = await api.post("/auth/login", { identifier, password, remember });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    identify(data.user);
    trackLogIn(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    identify(data.user);
    trackSignUp(data.user);
    return data.user;
  };

  const updateUser = (u) => {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("activeClinicId");
    setUser(null);
    trackLogOut();
    resetAnalytics();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {connectError ? <ConnectionError onRetry={checkSession} retrying={retrying} /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
