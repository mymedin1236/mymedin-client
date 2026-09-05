import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/admin.css";

export default function AdminLogin() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already signed in: admins go straight to the dashboard, anyone else back home.
  if (user) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/"} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const loggedIn = await login(identifier, password);
      if (loggedIn.role !== "admin") {
        logout();
        setError("This account is not an administrator.");
        return;
      }
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-app">
      <div className="auth-wrap">
        <form className="card auth-card" onSubmit={submit}>
          <h1>MyMedin</h1>
          <p className="muted">Admin panel</p>
          {error && <div className="error">{error}</div>}
          <label>
            Email
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
