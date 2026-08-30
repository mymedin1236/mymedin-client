import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";
import AvailabilityEditor from "../components/AvailabilityEditor";
import AvatarUpload from "../components/AvatarUpload";
import { normalizePkPhone } from "../utils/phone";

const DEFAULT_AVAILABILITY = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({
  day,
  start: "09:00",
  end: "17:00",
}));

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "client",
    // doctor-only
    clinicName: "",
    specialization: "",
    yearsOfExperience: "",
    about: "",
    // vendor-only
    companyName: "",
  });
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [avatarUrl, setAvatarUrl] = useState(""); // doctor profile photo (Cloudinary URL)
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [locStatus, setLocStatus] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const isDoctor = form.role === "doctor";
  const isVendor = form.role === "vendor";

  const roleHome = (role) =>
    role === "doctor" ? "/doctor" : role === "vendor" ? "/vendor" : "/client";

  // Clear a field's error as soon as the user edits it
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const updateAvailability = (next) => {
    setErrors((prev) => ({ ...prev, days: undefined, hours: undefined }));
    setAvailability(next);
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Per-field validation -> returns { field: message }
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    else if (form.name.trim().length < 2) e.name = "Name is too short.";

    if (!form.email.trim()) e.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email address.";

    if (!form.phone.trim()) e.phone = "Phone number is required.";
    else if (!/^0\d{10}$/.test(form.phone.trim()))
      e.phone = "Mobile number must be 11 digits and start with 0 (e.g. 03001234567).";

    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8) e.password = "Use at least 8 characters.";

    if (!form.confirmPassword) e.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";

    if (isVendor && !form.companyName.trim())
      e.companyName = "Company name is required.";

    if (isDoctor) {
      if (!form.clinicName.trim()) e.clinicName = "Clinic name is required.";
      if (!form.specialization.trim())
        e.specialization = "Specialization is required.";
      if (form.yearsOfExperience === "" || form.yearsOfExperience === null)
        e.yearsOfExperience = "Required.";
      else if (Number(form.yearsOfExperience) < 0 || Number.isNaN(Number(form.yearsOfExperience)))
        e.yearsOfExperience = "Enter a valid number.";
      else if (!Number.isInteger(Number(form.yearsOfExperience)))
        e.yearsOfExperience = "Whole years only (no decimals).";
      if (availability.length === 0) e.days = "Add hours for at least one day.";
      else if (availability.some((a) => a.start >= a.end))
        e.hours = "Each day's closing time must be after its opening time.";
      if (!coords) e.location = "Set your clinic location so patients can find you.";
    }
    return e;
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus("Geolocation is not supported by this browser.");
      return;
    }
    setLocStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocStatus("Location captured ✓");
      },
      (err) => setLocStatus(`Could not get location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errs = validate();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
      };
      if (isDoctor) {
        payload.clinicName = form.clinicName;
        payload.specialization = form.specialization;
        payload.yearsOfExperience = form.yearsOfExperience;
        payload.about = form.about;
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
        payload.availability = availability;
        if (avatarUrl) payload.image = avatarUrl;
      }
      if (isVendor) {
        payload.companyName = form.companyName;
      }
      const user = await register(payload);
      navigate(roleHome(user.role));
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  let pendingAssoc = null;
  try {
    pendingAssoc = JSON.parse(sessionStorage.getItem("pendingAssociation") || "null");
  } catch {
    pendingAssoc = null;
  }

  return (
    <div className="page auth-page">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <h2 className="icon">
          <Icon name="person_add" /> Create account
        </h2>
        {pendingAssoc && (
          <div className="info-banner">
            Create your patient account to connect with
            {pendingAssoc.name ? ` Dr. ${pendingAssoc.name}` : " your selected doctor"}.
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {!pendingAssoc && (
          <label>
            I am a
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="client">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="vendor">Vendor / Supplier</option>
            </select>
          </label>
        )}
        {isDoctor && (
          <AvatarUpload
            value={avatarUrl}
            name={form.name}
            onChange={setAvatarUrl}
            centered
            hint="Patients see this when finding a doctor."
          />
        )}
        {isVendor && (
          <label>
            <span className="lbl">Company name <span className="req">*</span></span>
            <input
              name="companyName"
              placeholder="e.g. DentSupply Co."
              className={errors.companyName ? "invalid" : ""}
              value={form.companyName}
              onChange={handleChange}
            />
            {errors.companyName && <span className="field-error">{errors.companyName}</span>}
          </label>
        )}
        <label>
          <span className="lbl">Full name <span className="req">*</span></span>
          {isDoctor ? (
            <span className={`input-prefix${errors.name ? " invalid" : ""}`}>
              <span className="prefix">Dr.</span>
              <input
                name="name"
                placeholder="e.g. Ahmad Qureshi"
                value={form.name}
                onChange={handleChange}
              />
            </span>
          ) : (
            <input
              name="name"
              className={errors.name ? "invalid" : ""}
              value={form.name}
              onChange={handleChange}
            />
          )}
          {isDoctor && (
            <span className="muted" style={{ fontSize: 12 }}>
              "Dr." is added automatically — no need to type it.
            </span>
          )}
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label>
          <span className="lbl">Email <span className="req">*</span></span>
          <input
            type="email"
            name="email"
            className={errors.email ? "invalid" : ""}
            value={form.email}
            onChange={handleChange}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          <span className="lbl">Phone <span className="req">*</span></span>
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            placeholder="e.g. 03001234567"
            className={errors.phone ? "invalid" : ""}
            value={form.phone}
            onChange={(e) =>
              handleChange({ target: { name: "phone", value: normalizePkPhone(e.target.value) } })
            }
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>
        <label>
          <span className="lbl">Password (min 8 chars) <span className="req">*</span></span>
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

        {isDoctor && (
          <>
            <hr className="divider" />
            <p className="muted" style={{ margin: 0 }}>
              Your public profile — patients see this when finding a doctor.
            </p>
            <label>
              <span className="lbl">Clinic name <span className="req">*</span></span>
              <input
                name="clinicName"
                className={errors.clinicName ? "invalid" : ""}
                value={form.clinicName}
                onChange={handleChange}
              />
              {errors.clinicName && <span className="field-error">{errors.clinicName}</span>}
            </label>
            <div className="grid-2">
              <label>
                <span className="lbl">Specialization <span className="req">*</span></span>
                <input
                  name="specialization"
                  placeholder="e.g. Orthodontist"
                  className={errors.specialization ? "invalid" : ""}
                  value={form.specialization}
                  onChange={handleChange}
                />
                {errors.specialization && (
                  <span className="field-error">{errors.specialization}</span>
                )}
              </label>
              <label>
                <span className="lbl">Years of experience <span className="req">*</span></span>
                <input
                  type="number"
                  name="yearsOfExperience"
                  min="0"
                  step="1"
                  className={errors.yearsOfExperience ? "invalid" : ""}
                  value={form.yearsOfExperience}
                  onKeyDown={(e) => {
                    if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => {
                    if (e.target.value === "" || Number(e.target.value) >= 0)
                      handleChange(e);
                  }}
                />
                {errors.yearsOfExperience && (
                  <span className="field-error">{errors.yearsOfExperience}</span>
                )}
              </label>
            </div>
            <label>
              About
              <textarea
                name="about"
                rows={3}
                placeholder="Tell patients about your practice…"
                value={form.about}
                onChange={handleChange}
              />
            </label>

            <div>
              <span className="field-label">Clinic hours</span>
              <p className="muted" style={{ marginTop: 0 }}>
                Set opening and closing times for each day you're open.
              </p>
              <AvailabilityEditor value={availability} onChange={updateAvailability} />
              {errors.days && <span className="field-error">{errors.days}</span>}
              {errors.hours && <span className="field-error">{errors.hours}</span>}
            </div>

            <div>
              <span className="field-label">Clinic location</span>
              <button
                type="button"
                className="btn-secondary icon"
                onClick={captureLocation}
              >
                <Icon name="my_location" /> Use my current location
              </button>
              {locStatus && <p className="muted" style={{ marginTop: 6 }}>{locStatus}</p>}
              {coords && (
                <p className="muted" style={{ marginTop: 4 }}>
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </p>
              )}
              {errors.location && <span className="field-error">{errors.location}</span>}
            </div>
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <Link
          to="/find-doctor"
          className="btn-secondary icon"
          style={{ textDecoration: "none", justifyContent: "center", width: "100%", borderColor: "var(--primary)", color: "var(--primary)" }}
        >
          <Icon name="person_search" size={18} /> Find a doctor near you
        </Link>
      </form>
    </div>
  );
}
