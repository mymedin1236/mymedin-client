import { useEffect, useState } from "react";
import api from "../api/axios";
import Icon from "../components/Icon";
import { SkeletonTable } from "../components/Skeleton";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [pending, setPending] = useState([]);
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteSent, setInviteSent] = useState(null); // { assistant }

  const load = async () => {
    try {
      const [staffRes, pendingRes] = await Promise.all([api.get("/staff"), api.get("/staff/pending")]);
      setStaff(staffRes.data);
      setPending(pendingRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const openInvite = () => {
    setIdentifier("");
    setError("");
    setInviteSent(null);
    setShowForm(true);
  };

  const resetForm = () => {
    setIdentifier("");
    setError("");
    setShowForm(false);
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/staff/invite", { identifier });
      setInviteSent(data);
      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't send invite");
    }
  };

  const cancelInvite = async (engagementId) => {
    await api.delete(`/staff/invite/${engagementId}`);
    await load();
  };

  const remove = async (id) => {
    if (!confirm("End this assistant's access to your clinic?")) return;
    await api.delete(`/staff/${id}`);
    await load();
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="badge" /> Staff</h1>
        {!showForm && (
          <button className="icon" onClick={openInvite}>
            <Icon name="person_add" size={18} /> Invite assistant
          </button>
        )}
      </div>

      <p className="muted" style={{ marginTop: -8 }}>
        Assistants own their own MyMedin account and can work for more than one clinic — invite someone who's
        already signed up, or ask them to sign up first if they haven't.
      </p>

      {inviteSent && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <h3 className="icon">
            <Icon name="check_circle" size={18} /> Invite sent to {inviteSent.assistant.name}
          </h3>
          <p className="muted" style={{ margin: 0 }}>
            They'll see it next time they open MyMedin and can accept or decline it themselves.
          </p>
          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: "var(--primary)", color: "var(--primary)", alignSelf: "flex-start" }}
            onClick={() => setInviteSent(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={sendInvite} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3>Invite an assistant</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={resetForm}>
                  <Icon name="close" />
                </button>
              </div>
              {error && <div className="error">{error}</div>}
              <label>
                <span className="lbl">Their email or phone <span className="req">*</span></span>
                <input
                  required
                  placeholder="e.g. jane@example.com or 03001234567"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  They need a MyMedin assistant account already — ask them to sign up first if they don't have one.
                </span>
              </label>
              <div className="row gap">
                <button type="submit">Send invite</button>
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
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <h3 className="field-label">Pending invites</h3>
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
                  {pending.map((p) => (
                    <tr key={p._id}>
                      <td>{p.assistant.name}</td>
                      <td>{p.assistant.email || "—"}</td>
                      <td>{p.assistant.phone || "—"}</td>
                      <td className="row gap" style={{ justifyContent: "flex-end" }}>
                        <span className="muted">Awaiting response</span>
                        <button className="btn-danger-soft icon" onClick={() => cancelInvite(p._id)}>
                          <Icon name="close" size={18} /> Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {staff.length === 0 ? (
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
                      <button className="btn-danger-soft icon" onClick={() => remove(s._id)}>
                        <Icon name="delete" size={18} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
