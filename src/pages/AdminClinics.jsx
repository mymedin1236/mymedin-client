import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";

const EMPTY = { name: "", doctors: [], sharePatients: true };

// Clinics where several doctors sit (e.g. two dentists and a gynaecologist at
// one medical centre). With "share patients" on, a patient of any doctor here
// is registered with all of them; saving links the existing patients too.
export default function AdminClinics() {
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | clinic id
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/clinic-groups");
      setClinics(data.clinics || []);
      setDoctors(data.doctors || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load clinics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setNotice("");
    setForm(EMPTY);
    setSearch("");
    setEditing("new");
  };
  const startEdit = (c) => {
    setNotice("");
    setForm({ name: c.name, doctors: c.doctors.map((d) => d._id), sharePatients: c.sharePatients });
    setSearch("");
    setEditing(c._id);
  };
  const toggleDoctor = (id) =>
    setForm((f) => ({
      ...f,
      doctors: f.doctors.includes(id) ? f.doctors.filter((d) => d !== id) : [...f.doctors, id],
    }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } =
        editing === "new"
          ? await api.post("/admin/clinic-groups", form)
          : await api.put(`/admin/clinic-groups/${editing}`, form);
      setEditing(null);
      setNotice(
        `${data.clinic.name} saved.` +
          (data.clinic.sharePatients
            ? ` ${data.linked} new patient link${data.linked === 1 ? "" : "s"} made between its doctors.`
            : "")
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the clinic.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!confirm(`Remove the clinic "${c.name}"? Its doctors keep the patients they already have.`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/clinic-groups/${c._id}`);
      setNotice(`${c.name} removed.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove the clinic.");
    } finally {
      setBusy(false);
    }
  };

  const clinicName = (id) => clinics.find((c) => c._id === id)?.name || "another clinic";
  const q = search.trim().toLowerCase();
  const pickable = doctors.filter(
    (d) =>
      !q ||
      [d.name, d.clinicName, d.specialization, d.phone].some((v) => String(v || "").toLowerCase().includes(q))
  );

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
      <div className="row between wrap">
        <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
          Group doctors who sit at the same clinic. With patient sharing on, a patient who joins any of
          them is registered with all of them, and saving links the clinic's existing patients too.
          Each doctor keeps their own notes and treatment history. A patient who leaves one doctor stays
          with the others.
        </p>
        {editing === null && <button onClick={startNew}>+ New clinic</button>}
      </div>

      {error && <div className="error">{error}</div>}
      {notice && <div className="ok">{notice}</div>}

      {editing !== null && (
        <section className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>{editing === "new" ? "New clinic" : "Edit clinic"}</h3>
          <label style={{ display: "grid", gap: 4 }}>
            Clinic name
            <input
              value={form.name}
              placeholder="e.g. Hafeez Medicare"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="row" style={{ flexDirection: "row", alignItems: "flex-start", color: "inherit", fontSize: 14 }}>
            <input
              type="checkbox"
              style={{ width: "auto", flex: "none", marginTop: 3 }}
              checked={form.sharePatients}
              onChange={(e) => setForm((f) => ({ ...f, sharePatients: e.target.checked }))}
            />
            <span>
              <strong>Share patients between these doctors</strong>
              <br />
              <span className="muted small">
                A patient of any doctor here becomes a patient of all of them, including doctors added later.
              </span>
            </span>
          </label>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="row between wrap">
              <strong>Doctors ({form.doctors.length} selected)</strong>
              <input
                placeholder="Search name / clinic / phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="table-wrap" style={{ maxHeight: 320, overflow: "auto" }}>
              <table>
                <tbody>
                  {pickable.map((d) => {
                    const elsewhere = d.clinicId && d.clinicId !== editing;
                    return (
                      <tr key={d._id} className={elsewhere ? "muted" : ""}>
                        <td style={{ width: 32 }}>
                          <input
                            type="checkbox"
                            disabled={!!elsewhere}
                            checked={form.doctors.includes(d._id)}
                            onChange={() => toggleDoctor(d._id)}
                          />
                        </td>
                        <td>Dr. {d.name}</td>
                        <td>{d.specialization || "—"}</td>
                        <td>{d.clinicName || "—"}</td>
                        <td className="nowrap">{d.phone || "—"}</td>
                        <td className="nowrap small">{elsewhere ? `In ${clinicName(d.clinicId)}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="row">
            <button disabled={busy || !form.name.trim()} onClick={save}>
              {busy ? "Saving…" : "Save clinic"}
            </button>
            <button className="ghost" disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : clinics.length === 0 ? (
        <p className="muted">No clinics yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Clinic</th><th>Doctors</th><th>Patient sharing</th><th></th></tr>
            </thead>
            <tbody>
              {clinics.map((c) => (
                <tr key={c._id}>
                  <td><strong>{c.name}</strong></td>
                  <td>
                    {c.doctors.length === 0
                      ? "—"
                      : c.doctors.map((d) => (
                          <div key={d._id}>
                            Dr. {d.name}
                            <span className="muted small">{d.specialization ? ` · ${d.specialization}` : ""}</span>
                          </div>
                        ))}
                  </td>
                  <td>{c.sharePatients ? <span className="ok">On</span> : <span className="muted">Off</span>}</td>
                  <td className="nowrap">
                    <button className="btn-sm" disabled={busy || editing !== null} onClick={() => startEdit(c)}>
                      Edit
                    </button>{" "}
                    <button className="ghost btn-sm" disabled={busy || editing !== null} onClick={() => remove(c)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
