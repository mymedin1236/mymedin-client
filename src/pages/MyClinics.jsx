import api from "../api/axios";
import Icon from "../components/Icon";
import { useClinic } from "../context/ClinicContext";
import { SkeletonTable } from "../components/Skeleton";

export default function MyClinics() {
  const { ready, activeClinics, pendingInvites, refresh } = useClinic();

  const accept = async (id) => {
    await api.post(`/engagements/${id}/accept`);
    await refresh();
  };

  const decline = async (id) => {
    await api.post(`/engagements/${id}/decline`);
    await refresh();
  };

  const leave = async (id) => {
    if (!confirm("Leave this clinic? You'll lose access to its patients, appointments, and records.")) return;
    await api.post(`/engagements/${id}/end`);
    await refresh();
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="storefront" /> My clinics</h1>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        Every dentist you work for lives here. Switch between them anytime from the picker in the top bar.
      </p>

      {!ready ? (
        <SkeletonTable rows={2} cols={2} />
      ) : (
        <>
          {pendingInvites.length > 0 && (
            <>
              <h3 className="field-label">Pending invites</h3>
              {pendingInvites.map((e) => (
                <div className="card" key={e._id} style={{ maxWidth: "none" }}>
                  <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div>
                      <strong>Dr. {e.doctor?.name}</strong>
                      {e.doctor?.clinicName && <div className="muted">{e.doctor.clinicName}</div>}
                    </div>
                    <div className="row gap">
                      <button className="icon" onClick={() => accept(e._id)}>
                        <Icon name="check" size={18} /> Accept
                      </button>
                      <button className="btn-secondary icon" onClick={() => decline(e._id)}>
                        <Icon name="close" size={18} /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          <h3 className="field-label">Active clinics</h3>
          {activeClinics.length === 0 ? (
            <p className="muted">
              You're not working for any clinic yet. Ask a dentist to invite you from their Staff page.
            </p>
          ) : (
            activeClinics.map((e) => (
              <div className="card" key={e._id} style={{ maxWidth: "none" }}>
                <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div>
                    <strong>Dr. {e.doctor?.name}</strong>
                    {e.doctor?.clinicName && <div className="muted">{e.doctor.clinicName}</div>}
                  </div>
                  <button className="btn-danger-soft icon" onClick={() => leave(e._id)}>
                    <Icon name="logout" size={18} /> Leave
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
