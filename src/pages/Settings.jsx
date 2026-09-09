import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import AvailabilityEditor from "../components/AvailabilityEditor";
import DayOverridesEditor from "../components/DayOverridesEditor";
import AppointmentTypesEditor from "../components/AppointmentTypesEditor";

const DEFAULT_HOURS = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({
  day,
  start: "09:00",
  end: "17:00",
}));

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Clinic-operational settings — opening hours, slot length, day overrides, and
// map location. Each section saves independently (its Save/Cancel activate only
// when that section has unsaved changes), so no scrolling to a single button.
// Settings belong to the CLINIC owner; an assistant edits the same record via
// /auth/clinic-settings.
export default function Settings() {
  const { user, updateUser } = useAuth();

  // Each section keeps a live value + the last-saved baseline (…Base).
  const [availability, setAvailability] = useState(DEFAULT_HOURS);
  const [availabilityBase, setAvailabilityBase] = useState(DEFAULT_HOURS);
  const [slotDuration, setSlotDuration] = useState(15);
  const [slotDurationBase, setSlotDurationBase] = useState(15);
  const [dayOverrides, setDayOverrides] = useState([]);
  const [dayOverridesBase, setDayOverridesBase] = useState([]);
  // Appointment types save themselves as they're edited (each is its own
  // record), so unlike the sections above they need no dirty/baseline pair.
  const [types, setTypes] = useState([]);
  const [coords, setCoords] = useState(null);
  const [coordsBase, setCoordsBase] = useState(null);

  const [loading, setLoading] = useState(true);
  const [locStatus, setLocStatus] = useState("");
  const [error, setError] = useState("");
  const [savingSection, setSavingSection] = useState(null); // which section is saving
  const [savedFlash, setSavedFlash] = useState(null); // section that just saved (brief ✓)

  // Load the clinic's current settings (works for both doctor and assistant).
  useEffect(() => {
    let active = true;
    api
      .get("/auth/clinic-settings")
      .then(({ data }) => {
        if (!active) return;
        const hours = data.availability?.length
          ? data.availability.map((a) => ({ day: a.day, start: a.start, end: a.end }))
          : DEFAULT_HOURS;
        setAvailability(hours);
        setAvailabilityBase(hours);
        setSlotDuration(data.slotDuration || 15);
        setSlotDurationBase(data.slotDuration || 15);
        setDayOverrides(data.dayOverrides || []);
        setDayOverridesBase(data.dayOverrides || []);
        setTypes(data.appointmentTypes || []);
        const c = data.location?.coordinates
          ? { latitude: data.location.coordinates[1], longitude: data.location.coordinates[0] }
          : null;
        setCoords(c);
        setCoordsBase(c);
      })
      .catch(() => active && setError("Could not load clinic settings."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const captureLocation = () => {
    if (!navigator.geolocation) return setLocStatus("Geolocation not supported.");
    setLocStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocStatus("Location captured ✓ — remember to save.");
      },
      (err) => setLocStatus(`Could not get location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Save one section: PUT only its field(s); on success, update that section's
  // baseline and keep the doctor's own session in sync.
  const putSection = async (section, payload, onSaved) => {
    setError("");
    setSavingSection(section);
    try {
      const { data } = await api.put("/auth/clinic-settings", payload);
      onSaved(data);
      if (user.role === "doctor") {
        updateUser({
          ...user,
          availability: data.availability,
          slotDuration: data.slotDuration,
          location: data.location || user.location,
        });
      }
      setSavedFlash(section);
      setTimeout(() => setSavedFlash((s) => (s === section ? null : s)), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save. Please try again.");
    } finally {
      setSavingSection(null);
    }
  };

  const hoursDirty = !eq(availability, availabilityBase);
  const slotDirty = Number(slotDuration) !== Number(slotDurationBase);
  const overridesDirty = !eq(dayOverrides, dayOverridesBase);
  const locDirty = !eq(coords, coordsBase);

  const saveHours = () =>
    putSection("hours", { availability }, () => setAvailabilityBase(availability));
  const saveSlot = () =>
    putSection("slot", { slotDuration: Number(slotDuration) }, () =>
      setSlotDurationBase(Number(slotDuration))
    );
  const saveOverrides = () =>
    putSection("overrides", { dayOverrides }, (data) => {
      // The server prunes past-dated exceptions — reflect the cleaned list.
      setDayOverrides(data.dayOverrides || []);
      setDayOverridesBase(data.dayOverrides || []);
    });
  const saveLocation = () =>
    putSection(
      "location",
      coords ? { latitude: coords.latitude, longitude: coords.longitude } : {},
      () => setCoordsBase(coords)
    );

  // Per-section Save + Cancel row; both inactive until the section is edited.
  const saveRow = (section, dirty, onSave, onCancel) => (
    <div className="row gap settings-actions">
      <button type="button" className="icon" disabled={!dirty || savingSection === section} onClick={onSave}>
        <Icon name="save" size={18} /> {savingSection === section ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={!dirty || savingSection === section}
        onClick={onCancel}
      >
        Cancel
      </button>
      {savedFlash === section && (
        <span className="settings-saved icon"><Icon name="check_circle" size={16} /> Saved</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <div className="page-head">
          <h1 className="icon"><Icon name="settings" /> Settings</h1>
        </div>
        <div className="card">
          <p className="muted icon" style={{ margin: 0 }}>
            <Icon name="progress_activity" size={18} className="spin" /> Loading clinic settings…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="settings" /> Settings</h1>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Appointment types */}
      <div className="card">
        <h3 className="icon"><Icon name="category" size={18} /> Appointment types</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          The kinds of appointment you offer, each with its own slot length — for
          example Consultation 20 minutes, PRP session 40 minutes, Hair transplant
          90 minutes. Once you've added them, assign one to each block of clinic
          hours below and that block is divided into slots of that length.
        </p>
        <AppointmentTypesEditor types={types} onChange={setTypes} />
      </div>

      {/* Clinic hours */}
      <div className="card">
        <h3 className="icon"><Icon name="schedule" size={18} /> Clinic hours</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Set opening and closing times for each day you're open. These control the
          time slots you and your patients can book. Add more than one block to a
          day to run different kinds of appointment at different times — say
          consultations from 12–3 and procedures from 6–9.
        </p>
        <AvailabilityEditor value={availability} onChange={setAvailability} types={types} />
        {saveRow("hours", hoursDirty, saveHours, () => setAvailability(availabilityBase))}
      </div>

      {/* Slot length */}
      <div className="card">
        <h3 className="icon"><Icon name="timer" size={18} /> Default slot length</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Used for any block of clinic hours you haven't given an appointment type.
          Blocks that do have a type are split using that type's own length instead.
        </p>
        <label style={{ maxWidth: 260 }}>
          Slot duration
          <select value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))}>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </label>
        {saveRow("slot", slotDirty, saveSlot, () => setSlotDuration(slotDurationBase))}
      </div>

      {/* Day-specific hours & time off */}
      <div className="card">
        <h3 className="icon"><Icon name="event_busy" size={18} /> Day-specific hours &amp; time off</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Override the normal hours for a specific date — e.g. leaving early one
          day, or a day off. Patients won't be able to book outside the adjusted
          window for that date. Past dates are cleared automatically.
        </p>
        <DayOverridesEditor value={dayOverrides} onChange={setDayOverrides} types={types} />
        {saveRow("overrides", overridesDirty, saveOverrides, () => setDayOverrides(dayOverridesBase))}
      </div>

      {/* Clinic location */}
      <div className="card">
        <h3 className="icon"><Icon name="location_on" size={18} /> Clinic location</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Used to show your clinic to nearby patients on "Find a doctor".
          Stand at your clinic and tap below to set it.
        </p>
        <button type="button" className="btn-secondary icon" onClick={captureLocation}>
          <Icon name="my_location" size={18} /> Update my location
        </button>
        {locStatus && <p className="muted" style={{ marginTop: 6 }}>{locStatus}</p>}
        {coords && (
          <p className="muted" style={{ marginTop: 4 }}>
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </p>
        )}
        {saveRow("location", locDirty, saveLocation, () => {
          setCoords(coordsBase);
          setLocStatus("");
        })}
      </div>
    </div>
  );
}
