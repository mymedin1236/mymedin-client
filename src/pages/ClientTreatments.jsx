import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDate } from "../utils/date";
import Icon from "../components/Icon";
import { SkeletonCards } from "../components/Skeleton";
import { trackFollowUp } from "../utils/analytics";

const money = (n) => `Rs ${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function ClientTreatments() {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Report-a-problem (recall) flow
  const [reportTarget, setReportTarget] = useState(null); // the treatment being reported
  const [reportText, setReportText] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const load = () =>
    api
      .get("/treatments", { skipLoader: true })
      .then((r) => setTreatments(r.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openReport = (t) => {
    setReportTarget(t);
    setReportText("");
    setReportError("");
    setReportDone(false);
  };

  const submitReport = async (e) => {
    e.preventDefault();
    setReportError("");
    if (!reportText.trim()) return setReportError("Please describe the problem you're facing.");
    setReportBusy(true);
    try {
      await api.post(`/treatments/${reportTarget._id}/follow-up`, { message: reportText.trim() });
      trackFollowUp("reported", { treatment_id: reportTarget._id });
      setReportTarget(null);
      setReportDone(true);
      await load();
    } catch (err) {
      setReportError(err.response?.data?.message || "Could not send. Please try again.");
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <div className="page">
      <h1 className="icon"><Icon name="medical_services" /> My treatment history</h1>

      {reportDone && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <p className="icon" style={{ margin: 0 }}>
            <Icon name="check_circle" size={18} /> Your clinic has been notified — they'll get back to you.
          </p>
        </div>
      )}

      {loading ? (
        <SkeletonCards count={4} />
      ) : treatments.length === 0 ? (
        <p className="muted">No treatments recorded yet.</p>
      ) : (
        <div className="appt-list">
          {[...treatments]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((t) => {
              const openFollowUp = (t.followUps || []).some((f) => f.status === "open");
              return (
                <div key={t._id} className="appt-card">
                  <div className="appt-card-head">
                    <span className="appt-when icon">
                      <Icon name="medical_services" size={18} /> {t.procedure}
                    </span>
                    {t.cost > 0 ? (
                      <span className={`st ${t.paid ? "st-completed" : "st-pending"}`}>
                        {t.paid ? "Paid" : "Unpaid"}
                      </span>
                    ) : (
                      <span className="st st-scheduled">No charge</span>
                    )}
                  </div>
                  <div className="appt-card-body">
                    <span className="icon"><Icon name="event" size={16} /> {formatDate(t.date)}</span>
                    {t.site && (
                      <span className="icon"><Icon name="location_on" size={16} /> {t.site}</span>
                    )}
                    {t.diagnosis && (
                      <span className="icon"><Icon name="clinical_notes" size={16} /> {t.diagnosis}</span>
                    )}
                    {t.cost > 0 && (
                      <span className="icon"><Icon name="payments" size={16} /> {money(t.cost)}</span>
                    )}
                    {openFollowUp && (
                      <span className="icon" style={{ color: "var(--warning, #b8860b)" }}>
                        <Icon name="report" size={16} /> Problem reported — awaiting clinic
                      </span>
                    )}
                  </div>
                  {t.prescription && (
                    <div className="rx-card">
                      <div className="rx-card-head icon">
                        <Icon name="prescriptions" size={16} /> Doctor's advice
                      </div>
                      <div className="rx-card-body">{t.prescription}</div>
                    </div>
                  )}
                  <div className="row gap" style={{ flexWrap: "wrap" }}>
                    <button className="btn-secondary icon" onClick={() => openReport(t)}>
                      <Icon name="report" size={18} /> Report a problem
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {reportTarget && (
        <div className="modal-backdrop" onClick={() => setReportTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitReport} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="report" size={18} /> Report a problem</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setReportTarget(null)}>
                  <Icon name="close" />
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Facing an issue after your <strong>{reportTarget.procedure}</strong> on{" "}
                {formatDate(reportTarget.date)}? Describe it and your clinic will be notified.
              </p>
              {reportError && <div className="error">{reportError}</div>}
              <label>
                <span className="lbl">What's the problem? <span className="req">*</span></span>
                <textarea
                  rows={4}
                  autoFocus
                  placeholder="e.g. The pain started again after 3 days, and there's swelling."
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                />
              </label>
              <div className="row gap">
                <button type="submit" className="icon" disabled={reportBusy}>
                  <Icon name="send" size={18} /> {reportBusy ? "Sending…" : "Notify my clinic"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setReportTarget(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
