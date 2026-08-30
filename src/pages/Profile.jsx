import { useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";
import AvatarUpload from "../components/AvatarUpload";
import { normalizePkPhone } from "../utils/phone";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const isDoctor = user.role === "doctor";
  const isAssistant = user.role === "assistant";
  const isVendor = user.role === "vendor";
  const canPhoto = isDoctor || isAssistant;

  const [form, setForm] = useState({
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    // client
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.substring(0, 10) : "",
    address: user.address || "",
    // vendor
    companyName: user.companyName || "",
    // doctor
    clinicName: user.clinicName || "",
    specialization: user.specialization || "",
    yearsOfExperience: user.yearsOfExperience ?? "",
    about: user.about || "",
  });
  const [avatarUrl, setAvatarUrl] = useState(user.image || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(""); // shown in a success modal

  // Change password
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (pw.next.length < 8) return setPwError("New password must be at least 8 characters.");
    if (pw.next !== pw.confirm) return setPwError("New passwords do not match.");
    setPwSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: "", next: "", confirm: "" });
      setSuccessMsg("Password updated.");
    } catch (err) {
      setPwError(err.response?.data?.message || "Could not update password.");
    } finally {
      setPwSaving(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.phone && !/^\d{11}$/.test(form.phone))
      return setError("Phone number must be exactly 11 digits.");
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email, phone: form.phone };
      if (canPhoto) payload.image = avatarUrl;
      if (user.role === "client") {
        payload.dateOfBirth = form.dateOfBirth;
        payload.address = form.address;
      }
      if (isVendor) payload.companyName = form.companyName;
      if (isDoctor) {
        payload.clinicName = form.clinicName;
        payload.specialization = form.specialization;
        payload.yearsOfExperience = form.yearsOfExperience;
        payload.about = form.about;
        payload.address = form.address;
      }
      const { data } = await api.put("/auth/me", payload);
      updateUser(data.user);
      setSuccessMsg("Profile saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="account_circle" /> My profile</h1>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h3 className="icon"><Icon name="badge" size={18} /> Account</h3>
        {error && <div className="error">{error}</div>}

        {canPhoto && (
          <AvatarUpload
            value={avatarUrl}
            name={form.name}
            onChange={setAvatarUrl}
            centered
            hint={isDoctor ? "Patients see this when finding a doctor." : ""}
          />
        )}

        <div className="grid-2">
          <label>
            Full name
            {isDoctor ? (
              <span className="input-prefix">
                <span className="prefix">Dr.</span>
                <input name="name" required value={form.name} onChange={handleChange} />
              </span>
            ) : (
              <input name="name" required value={form.name} onChange={handleChange} />
            )}
            {isDoctor && (
              <span className="muted" style={{ fontSize: 12 }}>"Dr." is added automatically.</span>
            )}
          </label>
          <label>
            <span className="lbl">Email <span className="muted">(optional)</span></span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
            />
          </label>
          <label>
            <span className="lbl">Phone <span className="muted">(11 digits)</span></span>
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              placeholder="e.g. 03001234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: normalizePkPhone(e.target.value) })}
            />
          </label>
          <label>
            Role
            <input value={user.role} disabled style={{ textTransform: "capitalize" }} />
          </label>
        </div>

        {user.role === "client" && (
          <div className="grid-2">
            <label>
              Date of birth
              <input type="date" name="dateOfBirth" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={handleChange} />
            </label>
            <label>
              Address
              <input name="address" value={form.address} onChange={handleChange} />
            </label>
          </div>
        )}

        {isVendor && (
          <label>
            Company name
            <input name="companyName" value={form.companyName} onChange={handleChange} />
          </label>
        )}

        {isDoctor && (
          <>
            <hr className="divider" />
            <h3 className="icon"><Icon name="medical_information" size={18} /> Doctor profile</h3>
            <label>
              Clinic name
              <input name="clinicName" value={form.clinicName} onChange={handleChange} />
            </label>
            <div className="grid-2">
              <label>
                Specialization
                <input name="specialization" value={form.specialization} onChange={handleChange} />
              </label>
              <label>
                Years of experience
                <input
                  type="number"
                  name="yearsOfExperience"
                  min="0"
                  step="1"
                  value={form.yearsOfExperience}
                  onKeyDown={(e) => ["-", "+", "e", "E", "."].includes(e.key) && e.preventDefault()}
                  onChange={handleChange}
                />
              </label>
            </div>
            <label>
              About
              <textarea name="about" rows={3} value={form.about} onChange={handleChange} />
            </label>
            <label>
              Clinic address
              <input name="address" value={form.address} onChange={handleChange} />
            </label>

            <p className="muted" style={{ marginTop: 0 }}>
              <Icon name="schedule" size={14} /> Clinic hours and location have moved to{" "}
              <strong>Settings</strong>.
            </p>
          </>
        )}

        <div className="row">
          <button type="submit" className="icon" disabled={saving}>
            <Icon name="save" size={18} /> {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <form className="card" onSubmit={changePassword}>
        <h3 className="icon"><Icon name="lock" size={18} /> Change password</h3>
        {pwError && <div className="error">{pwError}</div>}
        <label>
          <span className="lbl">Current password</span>
          <PasswordInput
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
        </label>
        <div className="grid-2">
          <label>
            <span className="lbl">New password (min 8)</span>
            <PasswordInput
              autoComplete="new-password"
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
            />
          </label>
          <label>
            <span className="lbl">Confirm new password</span>
            <PasswordInput
              autoComplete="new-password"
              minLength={8}
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            />
          </label>
        </div>
        <div className="row">
          <button type="submit" className="icon" disabled={pwSaving}>
            <Icon name="lock_reset" size={18} /> {pwSaving ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>

      {successMsg && (
        <div className="modal-backdrop" onClick={() => setSuccessMsg("")}>
          <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon"><Icon name="check_circle" /></div>
            <h3 style={{ margin: 0 }}>{successMsg}</h3>
            <div className="row" style={{ justifyContent: "center" }}>
              <button type="button" className="icon" onClick={() => setSuccessMsg("")}>
                <Icon name="check" size={18} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
