import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState(""); // email OR phone
  const [needEmail, setNeedEmail] = useState(false); // account has no email on file
  const [newEmail, setNewEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState(""); // shown only when we know the address
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const id = identifier.trim();
    if (!id) return setFieldError("Enter your email or phone number.");
    if (needEmail && !EMAIL_RE.test(newEmail.trim())) {
      return setEmailError("Enter a valid email address.");
    }
    setFieldError("");
    setEmailError("");
    setLoading(true);
    try {
      const body = needEmail
        ? { identifier: id, newEmail: newEmail.trim() }
        : { identifier: id };
      const { data } = await api.post("/auth/forgot-password", body);
      if (data?.needEmail) {
        // Account exists but has no email — ask for one and resubmit.
        setNeedEmail(true);
        return;
      }
      if (needEmail) setSentTo(newEmail.trim());
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
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

        {sent ? (
          <>
            <p>
              {sentTo ? (
                <>We’ve sent a password reset link to <strong>{sentTo}</strong>.</>
              ) : (
                <>If an account exists for <strong>{identifier}</strong>, we’ve sent a password reset link.</>
              )}{" "}
              It’s valid for 1 hour — check your inbox (and spam folder).
            </p>
            <Link to="/login" className="icon">
              <Icon name="arrow_back" size={18} /> Back to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ display: "contents" }}>
            <p className="muted" style={{ margin: 0 }}>
              Enter your account email or phone number and we’ll send you a link to reset your
              password.
            </p>
            {error && <div className="error">{error}</div>}
            <label>
              <span className="lbl">Email or phone <span className="req">*</span></span>
              <input
                name="identifier"
                placeholder="you@example.com or 03001234567"
                className={fieldError ? "invalid" : ""}
                value={identifier}
                disabled={needEmail}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (fieldError) setFieldError("");
                }}
              />
              {fieldError && <span className="field-error">{fieldError}</span>}
            </label>

            {needEmail && (
              <label>
                <span className="lbl">Your email <span className="req">*</span></span>
                <input
                  type="email"
                  name="newEmail"
                  placeholder="you@example.com"
                  className={emailError ? "invalid" : ""}
                  value={newEmail}
                  autoFocus
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  We don’t have an email on file for this account. We’ll save this one and send your
                  reset link to it.
                </span>
                {emailError && <span className="field-error">{emailError}</span>}
              </label>
            )}

            <button type="submit" disabled={loading}>
              {loading ? "Sending…" : needEmail ? "Save email & send link" : "Send reset link"}
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
