import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";

// Two ways back in:
//  • email  -> a reset link by email (the "link" step)
//  • phone  -> a 6-digit code on WhatsApp, entered here with the new password
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(""); // email OR phone
  const [step, setStep] = useState("ask"); // ask | link | otp | done
  const [form, setForm] = useState({ code: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);

  // Count down to when "Resend code" becomes available.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestReset = async () => {
    setError("");
    const id = identifier.trim();
    if (!id) return setErrors({ identifier: "Enter your email or phone number." });
    setErrors({});
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { identifier: id });
      if (data?.method === "otp") {
        setStep("otp");
        setResendIn(data.resendIn || 60);
      } else {
        setStep("link");
      }
    } catch (err) {
      const d = err.response?.data;
      if (d?.resendIn) setResendIn(d.resendIn);
      setError(d?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === "code" ? value.replace(/\D/g, "").slice(0, 6) : value });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError("");
    const errs = {};
    if (form.code.length !== 6) errs.code = "Enter the 6-digit code from WhatsApp.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 8) errs.password = "Use at least 8 characters.";
    if (form.password && form.password !== form.confirmPassword)
      errs.confirmPassword = "Passwords do not match.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setLoading(true);
    try {
      await api.post("/auth/reset-password-otp", {
        identifier: identifier.trim(),
        code: form.code,
        password: form.password,
      });
      setStep("done");
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
          <Icon name="lock_reset" /> Reset password
        </h2>

        {step === "done" ? (
          <>
            <p>Your password has been updated. Redirecting you to sign in…</p>
            <Link to="/login" className="icon">
              <Icon name="arrow_back" size={18} /> Go to sign in
            </Link>
          </>
        ) : step === "link" ? (
          <>
            <p>
              If an account exists for <strong>{identifier}</strong>, we’ve sent a password reset
              link. It’s valid for 1 hour — check your inbox (and spam folder).
            </p>
            <Link to="/login" className="icon">
              <Icon name="arrow_back" size={18} /> Back to sign in
            </Link>
          </>
        ) : step === "otp" ? (
          <form onSubmit={submitCode} noValidate style={{ display: "contents" }}>
            <p className="muted" style={{ margin: 0 }}>
              If <strong>{identifier}</strong> is registered, we’ve sent a 6-digit code to it on
              WhatsApp. The code is valid for 10 minutes.
            </p>
            {error && <div className="error">{error}</div>}
            <label>
              <span className="lbl">WhatsApp code <span className="req">*</span></span>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                autoFocus
                className={errors.code ? "invalid" : ""}
                value={form.code}
                onChange={handleChange}
              />
              {errors.code && <span className="field-error">{errors.code}</span>}
            </label>
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
            <p className="auth-alt">
              Didn’t get it?{" "}
              {resendIn > 0 ? (
                <span className="muted">Resend in {resendIn}s</span>
              ) : (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!loading) requestReset();
                  }}
                >
                  Resend code
                </a>
              )}{" "}
              ·{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setStep("ask");
                  setError("");
                  setForm({ code: "", password: "", confirmPassword: "" });
                }}
              >
                Change number
              </a>
            </p>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Not receiving WhatsApp messages on this number? Contact your clinic and they can reset
              your password for you.
            </p>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestReset();
            }}
            noValidate
            style={{ display: "contents" }}
          >
            <p className="muted" style={{ margin: 0 }}>
              Enter your phone number to get a code on WhatsApp, or your email to get a reset link.
            </p>
            {error && <div className="error">{error}</div>}
            <label>
              <span className="lbl">Phone or email <span className="req">*</span></span>
              <input
                name="identifier"
                placeholder="03001234567 or you@example.com"
                className={errors.identifier ? "invalid" : ""}
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errors.identifier) setErrors({});
                }}
              />
              {errors.identifier && <span className="field-error">{errors.identifier}</span>}
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Continue"}
            </button>
            <p className="auth-alt">
              Remembered it? <Link to="/login">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
