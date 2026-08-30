import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { formatDate, formatDateTime } from "../utils/date";
import Icon from "../components/Icon";
import { trackAgreementSigned } from "../utils/analytics";

// Bump this when the terms change so re-acceptance can be required/tracked.
const AGREEMENT_VERSION = "2026-08-v1";

// The service agreement terms. Edit the wording here as your business needs —
// this is the content the dentist reads and e-signs.
const TERMS = [
  {
    title: "1. The service",
    body: "MyDentalBooking provides a cloud-based dental clinic management and online booking platform — appointments, patient records, payments and ledger, automatic reminders, and a public clinic profile. Access is via any web browser; no installation is required.",
  },
  {
    title: "2. Discovery phase (free)",
    body: "The first three (3) months from activation are a free discovery period, at no charge, so the Clinic can fully evaluate the service.",
  },
  {
    title: "3. Subscription fee",
    body: "After the 3-month discovery phase, the subscription is Rs 3,000 per month, billed monthly. Continued use of the service after the discovery phase constitutes acceptance of the monthly fee. Prices are exclusive of any applicable taxes.",
  },
  {
    title: "4. Payment & cancellation",
    body: "Fees are due monthly in advance. The Clinic may cancel at any time with no long-term lock-in; the service continues until the end of the paid month. There is no charge during the discovery phase.",
  },
  {
    title: "5. Your data",
    body: "All clinic and patient data entered belongs to the Clinic. We store it securely and use it only to operate the service on your behalf. The Clinic is responsible for obtaining any patient consent required by law and for the accuracy of the information it enters.",
  },
  {
    title: "6. Availability & support",
    body: "We aim for high availability but do not guarantee uninterrupted service; occasional maintenance may occur. Support is provided over WhatsApp and phone during business hours.",
  },
  {
    title: "7. Acceptable use",
    body: "The Clinic will use the service lawfully and will not misuse patient data or attempt to disrupt the service for others.",
  },
  {
    title: "8. Changes to terms",
    body: "We may update these terms with reasonable notice. Continued use of the service after a change constitutes acceptance of the updated terms.",
  },
  {
    title: "9. Liability",
    body: "The service is provided on an \"as is\" basis. To the extent permitted by law, our total liability is limited to the fees paid by the Clinic in the month preceding any claim.",
  },
  {
    title: "10. Governing law",
    body: "This agreement is governed by the laws of the Islamic Republic of Pakistan.",
  },
];

export default function Agreement() {
  const { user, updateUser } = useAuth();
  const isDentist = user.role === "dentist";

  // The agreement lives on the clinic OWNER. We fetch it so an assistant can view
  // it read-only, and the dentist sees their own to sign.
  const [agreement, setAgreement] = useState(null);
  const [clinicName, setClinicName] = useState(user.clinicName || "");
  const [loadingAgreement, setLoadingAgreement] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get("/auth/agreement")
      .then(({ data }) => {
        if (!active) return;
        setAgreement(data.agreement || null);
        setClinicName(data.clinicName || "");
      })
      .catch(() => {})
      .finally(() => active && setLoadingAgreement(false));
    return () => {
      active = false;
    };
  }, []);

  const accepted = agreement?.acceptedAt ? agreement : null;

  // Enrollment / billing tracker, derived from the sign date: 3-month free
  // discovery, then Rs 3,000/month.
  let enroll = null;
  if (accepted) {
    const enrolledAt = new Date(accepted.acceptedAt);
    const discoveryEnd = new Date(enrolledAt);
    discoveryEnd.setMonth(discoveryEnd.getMonth() + 3);
    const dayMs = 86400000;
    const now = new Date();
    const inDiscovery = now < discoveryEnd;
    const daysLeft = Math.max(0, Math.ceil((discoveryEnd - now) / dayMs));
    const totalDays = Math.max(1, Math.round((discoveryEnd - enrolledAt) / dayMs));
    const pct = Math.min(100, Math.max(0, Math.round(((totalDays - daysLeft) / totalDays) * 100)));
    enroll = { enrolledAt, discoveryEnd, inDiscovery, daysLeft, pct };
  }

  const [name, setName] = useState(user.name || "");
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sign = async () => {
    setError("");
    if (name.trim().length < 2) return setError("Please type your full name to sign.");
    if (!agree) return setError("Please tick the box to confirm you agree to the terms.");
    setSaving(true);
    try {
      const { data } = await api.post("/auth/agreement/accept", {
        name: name.trim(),
        version: AGREEMENT_VERSION,
      });
      updateUser(data.user);
      setAgreement(data.user.agreement || null);
      trackAgreementSigned();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your acceptance. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingAgreement) {
    return (
      <div className="page agreement-page">
        <div className="page-head">
          <h1 className="icon"><Icon name="handshake" /> Service Agreement</h1>
        </div>
        <div className="card">
          <p className="muted icon" style={{ margin: 0 }}>
            <Icon name="progress_activity" size={18} className="spin" /> Loading…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page agreement-page">
      <div className="page-head">
        <h1 className="icon"><Icon name="handshake" /> Service Agreement</h1>
        {accepted && (
          <button type="button" className="btn-secondary icon" onClick={() => window.print()}>
            <Icon name="print" size={18} /> Print / Save PDF
          </button>
        )}
      </div>

      {accepted ? (
        <div className="card agreement-accepted icon">
          <Icon name="verified" size={22} />
          <div>
            <strong>Agreement accepted</strong>
            <div className="muted" style={{ fontSize: 14 }}>
              Signed by <strong>{accepted.name}</strong> on {formatDateTime(accepted.acceptedAt)}
              {accepted.version ? ` · version ${accepted.version}` : ""}.
            </div>
          </div>
        </div>
      ) : null}

      {enroll && (
        <div className="card enroll-card">
          <h3 style={{ marginTop: 0 }} className="icon"><Icon name="event_available" size={18} /> Enrollment</h3>
          <div className="enroll-grid">
            <div>
              <div className="enroll-label">Enrolled on</div>
              <div className="enroll-value">{formatDate(enroll.enrolledAt)}</div>
            </div>
            <div>
              <div className="enroll-label">Discovery ends</div>
              <div className="enroll-value">{formatDate(enroll.discoveryEnd)}</div>
            </div>
            <div>
              <div className="enroll-label">Monthly fee after</div>
              <div className="enroll-value">Rs 3,000<span className="muted" style={{ fontWeight: 500 }}> /month</span></div>
            </div>
          </div>

          {enroll.inDiscovery ? (
            <>
              <div className="enroll-status discovery icon">
                <Icon name="card_giftcard" size={16} /> Free discovery phase — {enroll.daysLeft} day
                {enroll.daysLeft !== 1 ? "s" : ""} left
              </div>
              <div className="enroll-bar"><span style={{ width: `${enroll.pct}%` }} /></div>
            </>
          ) : (
            <div className="enroll-status active icon">
              <Icon name="workspace_premium" size={16} /> Subscription active — Rs 3,000 / month
              (discovery ended {formatDate(enroll.discoveryEnd)})
            </div>
          )}
        </div>
      )}

      {!accepted && isDentist && (
        <div className="card" style={{ borderColor: "var(--primary)" }}>
          <p className="icon" style={{ margin: 0 }}>
            <Icon name="info" size={18} /> Please read the terms below and e-sign to activate your
            agreement — no printing or paper signature needed.
          </p>
        </div>
      )}
      {!accepted && !isDentist && (
        <div className="card" style={{ borderColor: "var(--amber, #d98a00)" }}>
          <p className="icon" style={{ margin: 0 }}>
            <Icon name="visibility" size={18} /> View only — the agreement has not been signed yet.
            Only the clinic owner (dentist) can sign it.
          </p>
        </div>
      )}

      {/* Pricing summary */}
      <div className="card agreement-pricing">
        <div className="ap-item">
          <div className="ap-value">3 months</div>
          <div className="ap-label">Free discovery phase</div>
        </div>
        <div className="ap-sep">then</div>
        <div className="ap-item">
          <div className="ap-value">Rs 3,000<span>/month</span></div>
          <div className="ap-label">Monthly subscription</div>
        </div>
      </div>

      {/* Terms */}
      <div className="card agreement-doc">
        <h3 style={{ marginTop: 0 }}>MyDentalBooking — Service Agreement</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Between MyDentalBooking (“we”, “us”) and {clinicName || "your clinic"} (“the Clinic”, “you”).
        </p>
        {TERMS.map((t) => (
          <div key={t.title} className="agreement-clause">
            <strong>{t.title}</strong>
            <p>{t.body}</p>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 13 }}>
          By signing electronically, you confirm you are authorised to enter this agreement on behalf
          of the Clinic and that you accept the terms above.
        </p>
      </div>

      {/* Signature — only the clinic owner (dentist) can sign */}
      {!accepted && isDentist && (
        <div className="card">
          <h3 style={{ marginTop: 0 }} className="icon"><Icon name="draw" size={18} /> E-signature</h3>
          {error && <div className="error">{error}</div>}
          <label style={{ maxWidth: 360 }}>
            <span className="lbl">Your full name <span className="req">*</span></span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Full Name" />
          </label>
          <label className="agreement-check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I have read and agree to the terms of this agreement.</span>
          </label>
          <div className="row">
            <button type="button" className="icon" onClick={sign} disabled={saving}>
              <Icon name="check_circle" size={18} /> {saving ? "Signing…" : "Accept & sign"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
