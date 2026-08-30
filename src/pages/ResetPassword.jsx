import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8) e.password = "Use at least 8 characters.";
    if (!form.confirmPassword) e.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
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
      await api.post("/auth/reset-password", { token, password: form.password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="card">
        <h2 className="icon">
          <Icon name="lock_reset" /> Set a new password
        </h2>

        {!token ? (
          <>
            <div className="error">This reset link is invalid or incomplete.</div>
            <Link to="/forgot-password">Request a new reset link</Link>
          </>
        ) : done ? (
          <>
            <p>Your password has been updated. Redirecting you to sign in…</p>
            <Link to="/login" className="icon">
              <Icon name="arrow_back" size={18} /> Go to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ display: "contents" }}>
            {error && <div className="error">{error}</div>}
            <label>
              <span className="lbl">New password <span className="req">*</span></span>
              <PasswordInput
                name="password"
                autoComplete="new-password"
                invalid={!!errors.password}
                value={form.password}
                onChange={handleChange}
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </label>
            <label>
              <span className="lbl">Confirm password <span className="req">*</span></span>
              <PasswordInput
                name="confirmPassword"
                autoComplete="new-password"
                invalid={!!errors.confirmPassword}
                value={form.confirmPassword}
                onChange={handleChange}
              />
              {errors.confirmPassword && (
                <span className="field-error">{errors.confirmPassword}</span>
              )}
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
