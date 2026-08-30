import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { identify, resetAnalytics, trackLogIn, trackLogOut, trackSignUp } from "../utils/analytics";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
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
    const token = localStorage.getItem("token");
    if (!token) {
      done();
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data.user);
        localStorage.setItem("user", JSON.stringify(r.data.user));
        identify(r.data.user);
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
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
