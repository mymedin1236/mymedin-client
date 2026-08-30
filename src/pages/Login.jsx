import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";
import { usePwaInstall } from "../utils/pwaInstall";
import { normalizePkPhone } from "../utils/phone";

export default function Login() {
  const { login } = useAuth();
  const { canInstall, install, iosHint } = usePwaInstall();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // Identifier is email OR phone: normalize phone-like input to local format
  // (e.g. pasted "+92 323 4944896" -> "03234944896"), but leave emails alone.
  const handleIdentifier = (e) => {
    const raw = e.target.value;
    const value = /[a-zA-Z@]/.test(raw) ? raw : normalizePkPhone(raw);
    setForm({ ...form, identifier: value });
    if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: undefined }));
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^\+?[0-9][0-9\s-]{6,14}$/;

  const validate = () => {
    const e = {};
    const id = form.identifier.trim();
    if (!id) e.identifier = "Email or phone is required.";
    else if (!EMAIL_RE.test(id) && !PHONE_RE.test(id))
      e.identifier = "Enter a valid email or phone number.";
    if (!form.password) e.password = "Password is required.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errs = validate();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setLoading(true);
    try {
      const user = await login(form.identifier, form.password, remember);
      navigate(
        user.role === "doctor"
          ? "/doctor"
          : user.role === "vendor"
          ? "/vendor"
          : "/client"
      );
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="auth-brand">
          <img src="/favicon.svg" alt="MyMedin" className="auth-logo" />
          <div>
            <div className="auth-title">MyMedin</div>
            <div className="auth-subtitle">Sign in to your account</div>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <label>
          Email or phone
          <div className="input-wrap has-leading">
            <Icon name="alternate_email" size={20} className="field-leading" />
            <input
              type="text"
              name="identifier"
              placeholder="you@example.com or 03001234567"
              className={errors.identifier ? "invalid" : ""}
              value={form.identifier}
              onChange={handleIdentifier}
            />
          </div>
          {errors.identifier && <span className="field-error">{errors.identifier}</span>}
        </label>
        <label>
          Password
          <PasswordInput
            name="password"
            autoComplete="current-password"
            leadingIcon="lock"
            invalid={!!errors.password}
            value={form.password}
            onChange={handleChange}
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
        <div className="auth-forgot">
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="auth-alt">
          No account? <Link to="/register">Register</Link>
        </p>
        <Link
          to="/find-doctor"
          className="btn-secondary icon"
          style={{ textDecoration: "none", justifyContent: "center", width: "100%", borderColor: "var(--primary)", color: "var(--primary)" }}
        >
          <Icon name="person_search" size={18} /> Find a doctor near you
        </Link>
        {canInstall && (
          <button
            type="button"
            className="btn-secondary icon"
            style={{ borderColor: "var(--primary)", color: "var(--primary)", width: "100%", justifyContent: "center" }}
            onClick={install}
          >
            <Icon name="install_mobile" size={18} /> Install app
          </button>
        )}
        {!canInstall && iosHint && (
          <p className="auth-ios-hint icon">
            <Icon name="ios_share" size={18} /> To install: tap <strong>Share</strong>, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        )}
      </form>
    </div>
  );
}
