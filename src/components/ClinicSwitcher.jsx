import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClinic } from "../context/ClinicContext";
import Icon from "./Icon";

// Always-visible clinic picker for an assistant engaged with multiple doctors —
// shows the active clinic's name (not just an icon) so it's obvious at a glance
// which clinic they're working in, and switching never requires a re-login.
export default function ClinicSwitcher() {
  const { activeClinic, activeClinics, pendingInvites, setActiveClinicId } = useClinic();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (activeClinics.length === 0) {
    return (
      <button
        className="clinic-switcher-empty icon"
        onClick={() => navigate("/my-clinics")}
        title="Ask a dentist to invite you"
      >
        <Icon name="storefront" size={16} />
        {pendingInvites.length > 0 ? `${pendingInvites.length} pending invite(s)` : "No clinic yet"}
      </button>
    );
  }

  const select = (doctorId) => {
    setActiveClinicId(doctorId);
    setOpen(false);
  };

  return (
    <div className="clinic-switcher">
      <button
        className="clinic-switcher-btn icon"
        aria-label="Switch clinic"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="storefront" size={16} />
        {activeClinic?.doctor?.name ? `Dr. ${activeClinic.doctor.name}` : "Select clinic"}
        <Icon name="expand_more" size={16} />
      </button>
      {open && (
        <>
          <div className="profile-backdrop" onClick={() => setOpen(false)} />
          <div className="clinic-switcher-dropdown">
            {activeClinics.map((e) => (
              <button
                key={e._id}
                className={`profile-item${e.doctor?._id === activeClinic?.doctor?._id ? " on" : ""}`}
                onClick={() => select(e.doctor._id)}
              >
                <Icon
                  name={e.doctor?._id === activeClinic?.doctor?._id ? "radio_button_checked" : "radio_button_unchecked"}
                  size={18}
                />
                Dr. {e.doctor?.name}
              </button>
            ))}
            <button
              className="profile-item"
              onClick={() => {
                setOpen(false);
                navigate("/my-clinics");
              }}
            >
              <Icon name="settings" size={18} /> Manage clinics
            </button>
          </div>
        </>
      )}
    </div>
  );
}
