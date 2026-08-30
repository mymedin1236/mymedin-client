import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDate } from "../utils/date";
import Icon from "../components/Icon";

const money = (n) => `Rs ${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const titleCase = (s) => s.replace(/[0-9]/g, "").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export default function Family() {
  const [deps, setDeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", dateOfBirth: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Treatment-history modal
  const [treatFor, setTreatFor] = useState(null);
  const [treatments, setTreatments] = useState([]);
  const [treatLoading, setTreatLoading] = useState(false);

  const load = () =>
    api.get("/family", { skipLoader: true }).then((r) => setDeps(r.data)).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const submitAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Name is required.");
    setBusy(true);
    try {
      await api.post("/family", { name: form.name, dateOfBirth: form.dateOfBirth });
      setShowAdd(false);
      setForm({ name: "", dateOfBirth: "" });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add dependent.");
    } finally {
      setBusy(false);
    }
  };

  const removeDep = async (id) => {
    if (!confirm("Remove this dependent? Their records stay with the clinic.")) return;
    await api.delete(`/family/${id}`);
    await load();
  };

  const openTreatments = async (d) => {
    setTreatFor(d);
    setTreatments([]);
    setTreatLoading(true);
    try {
      const { data } = await api.get("/treatments", { params: { client: d._id }, skipLoader: true });
      setTreatments(data);
    } catch {
      /* ignore */
    } finally {
      setTreatLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="escalator_warning" /> My family</h1>
        {!showAdd && (
          <button className="icon" onClick={() => { setForm({ name: "", dateOfBirth: "" }); setError(""); setShowAdd(true); }}>
            <Icon name="person_add" size={18} /> Add child
          </button>
        )}
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        Add children/dependents you bring to the clinic. You'll receive their reminders, can book
        appointments for them (from the Appointments tab), and view their treatment history here.
      </p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : deps.length === 0 ? (
        <p className="muted">No dependents yet.</p>
      ) : (
        <div className="appt-list">
          {deps.map((d) => (
            <div key={d._id} className="appt-card">
              <div className="appt-card-head">
                <span className="appt-when icon"><Icon name="child_care" size={18} /> {d.name}</span>
                <span className="st st-scheduled">Child</span>
              </div>
              <div className="appt-card-body">
                {d.dateOfBirth && (
                  <span className="icon"><Icon name="cake" size={16} /> {formatDate(d.dateOfBirth)}</span>
                )}
              </div>
              <div className="row gap" style={{ flexWrap: "wrap" }}>
                <button className="btn-secondary icon" onClick={() => openTreatments(d)}>
                  <Icon name="medical_services" size={18} /> Treatments
                </button>
                <button className="btn-danger-soft icon" onClick={() => removeDep(d._id)}>
                  <Icon name="delete" size={18} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitAdd} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="person_add" size={18} /> Add child / dependent</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowAdd(false)}>
                  <Icon name="close" />
                </button>
              </div>
              {error && <div className="error">{error}</div>}
              <label>
                <span className="lbl">Name <span className="req">*</span></span>
                <input
                  required
                  autoCapitalize="words"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: titleCase(e.target.value) })}
                />
              </label>
              <label>
                <span className="lbl">Date of birth</span>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </label>
              <div className="row gap">
                <button type="submit" className="icon" disabled={busy}>
                  <Icon name="check" size={18} /> {busy ? "Adding…" : "Add child"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {treatFor && (
        <div className="modal-backdrop" onClick={() => setTreatFor(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="icon"><Icon name="medical_services" size={18} /> {treatFor.name}'s treatments</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setTreatFor(null)}>
                <Icon name="close" />
              </button>
            </div>
            {treatLoading ? (
              <p className="muted">Loading…</p>
            ) : treatments.length === 0 ? (
              <p className="muted">No treatments recorded yet.</p>
            ) : (
              <div className="appt-list">
                {treatments.map((t) => (
                  <div key={t._id} className="appt-card">
                    <div className="appt-card-head">
                      <span className="appt-when icon"><Icon name="medical_services" size={18} /> {t.procedure}</span>
                      {t.cost > 0 ? (
                        <span className={`st ${t.paid ? "st-completed" : "st-pending"}`}>{t.paid ? "Paid" : "Unpaid"}</span>
                      ) : (
                        <span className="st st-scheduled">No charge</span>
                      )}
                    </div>
                    <div className="appt-card-body">
                      <span className="icon"><Icon name="event" size={16} /> {formatDate(t.date)}</span>
                      {t.toothNumber && <span className="icon"><Icon name="dentistry" size={16} /> Tooth {t.toothNumber}</span>}
                      {t.diagnosis && <span className="icon"><Icon name="clinical_notes" size={16} /> {t.diagnosis}</span>}
                      {t.cost > 0 && <span className="icon"><Icon name="payments" size={16} /> {money(t.cost)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
