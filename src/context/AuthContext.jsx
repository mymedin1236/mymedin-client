import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";
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

  useEffect(() => {
    // Hand the splash screen over to the app once bootstrap completes
    const done = () => {
      setLoading(false);
      window.finishSplash?.();
    };
    const viewToken = sessionStorage.getItem("viewToken");
    const token = viewToken || localStorage.getItem("token");
    if (!token) {
      done();
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data.user);
        if (viewToken) {
          sessionStorage.setItem("viewUser", JSON.stringify(r.data.user));
        } else {
          localStorage.setItem("user", JSON.stringify(r.data.user));
        }
        identify(r.data.user);
      })
      .catch(() => {
        if (viewToken) {
          sessionStorage.removeItem("viewToken");
          sessionStorage.removeItem("viewAs");
          sessionStorage.removeItem("viewUser");
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
        setUser(null);
      })
      .finally(done);
  }, []);

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
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
