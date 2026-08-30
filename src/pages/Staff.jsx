import { useEffect, useState } from "react";
import api from "../api/axios";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";
import { SkeletonTable } from "../components/Skeleton";

const empty = { name: "", email: "", phone: "", password: "", confirmPassword: "" };

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState(null); // { credentials, shareMessage }
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/staff");
      setStaff(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
    setError("");
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(empty);
    setEditingId(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingId(s._id);
    setForm({ name: s.name || "", email: s.email || "", phone: s.phone || "", password: "", confirmPassword: "" });
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Password required on create, optional on edit (reset)
    if (!editingId || form.password) {
      if (form.password.length < 8) return setError("Password must be at least 8 characters.");
      if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    }
    try {
      if (editingId) {
        const payload = { name: form.name, phone: form.phone };
        if (form.password) payload.password = form.password;
        await api.put(`/staff/${editingId}`, payload);
        resetForm();
      } else {
        const { data } = await api.post("/staff", {
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
        });
        setCreated(data);
        setCopied(false);
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    }
  };

  const remove = async (id) => {
    if (!confirm("Remove this assistant's access?")) return;
    await api.delete(`/staff/${id}`);
    await load();
  };

  const copyCreds = async () => {
    try {
      await navigator.clipboard.writeText(created.shareMessage);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  const waLink = created
    ? `https://wa.me/?text=${encodeURIComponent(created.shareMessage)}`
    : "#";

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="badge" /> Staff</h1>
        {!showForm && (
          <button className="icon" onClick={openCreate}>
            <Icon name="person_add" size={18} /> Add assistant
          </button>
        )}
      </div>

      <p className="muted" style={{ marginTop: -8 }}>
        Assistants can manage patients, appointments, treatments, payments, and expenses for your clinic.
      </p>

      {created && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <h3 className="icon">
            <Icon name="check_circle" size={18} /> Assistant account created for {created.assistant.name}
          </h3>
          <textarea readOnly rows={6} value={created.shareMessage} />
          <div className="row gap" style={{ flexWrap: "wrap" }}>
            <button type="button" className="icon" onClick={copyCreds}>
              <Icon name="content_copy" size={18} /> {copied ? "Copied!" : "Copy credentials"}
            </button>
            <a className="btn-whatsapp" href={waLink} target="_blank" rel="noreferrer">
              <Icon name="chat" size={18} /> Share via WhatsApp
            </a>
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              onClick={() => setCreated(null)}
            >
              Dismiss
            </button>
          </div>
          {created.credentials.email && (
            <p className="muted" style={{ margin: 0 }}>
              Credentials were also emailed to {created.credentials.email}.
            </p>
          )}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3>{editingId ? "Edit assistant" : "Add new assistant"}</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={resetForm}>
                  <Icon name="close" />
                </button>
              </div>
              {error && <div className="error">{error}</div>}
              <div className="grid-2">
                <label>
                  <span className="lbl">Name <span className="req">*</span></span>
                  <input name="name" required value={form.name} onChange={handleChange} />
                </label>
                <label>
                  <span className="lbl">Email <span className="muted">(optional)</span></span>
                  <input
                    type="email"
                    name="email"
                    disabled={!!editingId}
                    value={form.email}
                    onChange={handleChange}
                  />
                </label>
                <label>
                  <span className="lbl">Phone</span>
                  <input
                    name="phone"
                    placeholder="e.g. 03001234567"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </label>
                <label>
                  <span className="lbl">
                    {editingId ? "New password (optional)" : <>Password (min 8) <span className="req">*</span></>}
                  </span>
                  <PasswordInput
                    name="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                  />
                </label>
                {(!editingId || form.password) && (
                  <label>
                    <span className="lbl">Confirm password <span className="req">*</span></span>
                    <PasswordInput
                      name="confirmPassword"
                      minLength={8}
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                    />
                  </label>
                )}
              </div>
              <div className="row gap">
                <button type="submit">{editingId ? "Update" : "Add assistant"}</button>
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={3} cols={4} />
      ) : staff.length === 0 ? (
        <p className="muted">No assistants yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.email || "—"}</td>
                <td>{s.phone || "—"}</td>
                <td className="row gap" style={{ justifyContent: "flex-end" }}>
                  <button className="btn-secondary icon" onClick={() => openEdit(s)}>
                    <Icon name="edit" size={18} /> Edit
                  </button>
                  <button className="btn-danger-soft icon" onClick={() => remove(s._id)}>
                    <Icon name="delete" size={18} /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
