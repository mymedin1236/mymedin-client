import { useState } from "react";
import api from "../api/axios";
import Icon from "./Icon";

// Slot lengths offered in the dropdown. A doctor can still type any value in
// the "Other" box — these are just the common ones.
const PRESETS = [10, 15, 20, 30, 40, 45, 60, 90, 120];

const fmtLen = (mins) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const blank = { name: "", duration: 20, description: "" };

// Create and manage the kinds of appointment this clinic offers, each with its
// own slot length — e.g. Consultation 20 min, PRP session 40 min, Hair
// transplant 90 min. Operational-hours brackets then point at one of these
// (see AvailabilityEditor), which is what lets a single day run several kinds
// of appointment at different cadences.
//
// Saves immediately per row (they're small, independent records), and tells the
// parent so the hours editors can offer the new type straight away.
export default function AppointmentTypesEditor({ types = [], onChange }) {
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState(null); // id being edited
  const [edit, setEdit] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      const name = draft.name.trim();
      if (!name) return setError("Give this appointment type a name.");
      const { data } = await api.post("/appointment-types", {
        name,
        duration: Number(draft.duration),
        description: draft.description.trim(),
      });
      onChange([...types, data.type]);
      setDraft(blank);
    });

  const save = (id) =>
    run(async () => {
      const { data } = await api.put(`/appointment-types/${id}`, {
        name: edit.name.trim(),
        duration: Number(edit.duration),
        description: (edit.description || "").trim(),
      });
      onChange(types.map((t) => (t._id === id ? data.type : t)));
      setEditing(null);
    });

  const remove = (t) =>
    run(async () => {
      if (
        !window.confirm(
          `Remove "${t.name}"? Hours using it fall back to your default slot length, and existing appointments keep their label.`
        )
      ) {
        return;
      }
      const { data } = await api.delete(`/appointment-types/${t._id}`);
      // In-use types are retired rather than deleted, so the row stays visible
      // (greyed) instead of vanishing while appointments still reference it.
      onChange(data.retired ? types.map((x) => (x._id === t._id ? data.type : x)) : types.filter((x) => x._id !== t._id));
    });

  const restore = (t) =>
    run(async () => {
      const { data } = await api.put(`/appointment-types/${t._id}`, { active: true });
      onChange(types.map((x) => (x._id === t._id ? data.type : x)));
    });

  const durationField = (val, set) => (
    <label>
      Slot length
      <select value={PRESETS.includes(Number(val)) ? val : "custom"} onChange={(e) => set(e.target.value === "custom" ? val : Number(e.target.value))}>
        {PRESETS.map((d) => (
          <option key={d} value={d}>
            {fmtLen(d)}
          </option>
        ))}
        <option value="custom">Other…</option>
      </select>
      {!PRESETS.includes(Number(val)) && (
        <input
          type="number"
          min={5}
          max={480}
          step={5}
          value={val}
          aria-label="Slot length in minutes"
          onChange={(e) => set(e.target.value)}
        />
      )}
    </label>
  );

  return (
    <div className="types-editor">
      {error && <div className="error">{error}</div>}

      {types.length > 0 && (
        <ul className="type-list">
          {types.map((t) =>
            editing === t._id ? (
              <li key={t._id} className="type-row editing">
                <label>
                  Name
                  <input
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    placeholder="e.g. PRP session"
                  />
                </label>
                {durationField(edit.duration, (v) => setEdit({ ...edit, duration: v }))}
                <div className="row gap">
                  <button type="button" className="icon" disabled={busy} onClick={() => save(t._id)}>
                    <Icon name="save" size={16} /> Save
                  </button>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li key={t._id} className={`type-row${t.active === false ? " retired" : ""}`}>
                <span className="type-name">
                  {t.name}
                  {t.active === false && <span className="type-tag">Retired</span>}
                </span>
                <span className="type-len">{fmtLen(t.duration)}</span>
                <span className="row gap type-actions">
                  {t.active === false ? (
                    <button type="button" className="btn-secondary icon" disabled={busy} onClick={() => restore(t)}>
                      <Icon name="restore" size={16} /> Restore
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-secondary icon"
                        disabled={busy}
                        onClick={() => {
                          setEditing(t._id);
                          setEdit({ name: t.name, duration: t.duration, description: t.description || "" });
                        }}
                      >
                        <Icon name="edit" size={16} /> Edit
                      </button>
                      <button type="button" className="btn-secondary icon" disabled={busy} onClick={() => remove(t)}>
                        <Icon name="delete" size={16} /> Remove
                      </button>
                    </>
                  )}
                </span>
              </li>
            )
          )}
        </ul>
      )}

      <div className="type-add">
        <label>
          Name
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Hair transplant"
          />
        </label>
        {durationField(draft.duration, (v) => setDraft({ ...draft, duration: v }))}
        <button type="button" className="btn-secondary icon" disabled={busy || !draft.name.trim()} onClick={add}>
          <Icon name="add_circle" size={18} /> Add type
        </button>
      </div>
    </div>
  );
}
