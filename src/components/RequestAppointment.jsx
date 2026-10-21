import { useState } from "react";
import api from "../api/axios";
import Icon from "./Icon";
import SlotPicker from "./SlotPicker";
import NoSlotAlternatives from "./NoSlotAlternatives";
import { trackAppointment } from "../utils/analytics";

// True once the patient already has an active appointment (pending or upcoming)
// with EVERY one of their doctors, so "Request appointment" can be hidden.
// Guardians with dependents keep it so they can still book for a child. The
// server also blocks same-day double-booking.
export const allDoctorsBooked = ({ appointments, doctors, deps, userId }) => {
  const now = Date.now();
  const hasActiveWith = (doctorId) =>
    appointments.some(
      (a) =>
        (a.client?._id || a.client) === userId &&
        (a.doctor?._id || a.doctor) === doctorId &&
        ["pending", "scheduled"].includes(a.status) &&
        new Date(a.date).getTime() >= now
    );
  return doctors.length > 0 && doctors.every((d) => hasActiveWith(d._id)) && deps.length === 0;
};

// Confirmation shown after a booking goes through. The clinic may confirm on
// the spot, in which case there is nothing to wait for.
export function RequestSentNote({ autoConfirmed }) {
  return (
    <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
      <p className="icon" style={{ margin: 0 }}>
        {autoConfirmed ? (
          <>
            <Icon name="event_available" size={18} /> Appointment confirmed — it's in the
            clinic's diary. We've sent you the details.
          </>
        ) : (
          <>
            <Icon name="schedule_send" size={18} /> Request sent — you'll be notified once your
            doctor confirms.
          </>
        )}
      </p>
    </div>
  );
}

// "Request an appointment" modal used by the patient's Home and Appointments
// tabs. Mount it to open; it calls onSent({ autoConfirmed }) after booking.
export default function RequestAppointment({ doctors, deps, onClose, onSent }) {
  const [reqFor, setReqFor] = useState(""); // "" = myself, else dependent id
  // Which of the patient's doctors (dentist, physio, …) this booking is with.
  const [reqDoctor, setReqDoctor] = useState(doctors[0]?._id || "");
  const [reqDate, setReqDate] = useState("");
  // Day the picker opens on, kept when the patient switches to another doctor
  // from the "no free slot" suggestions.
  const [reqDay, setReqDay] = useState("");
  // The slot the patient tapped — carries which kind of appointment that
  // bracket runs, so the request is booked as that type at its own length.
  const [reqSlot, setReqSlot] = useState(null);
  const [reqReason, setReqReason] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  const reqDoctorObj = doctors.find((d) => d._id === reqDoctor) || doctors[0];

  const submitRequest = async (e) => {
    e.preventDefault();
    setReqError("");
    if (!reqDate) return setReqError("Please pick a time slot.");
    setReqBusy(true);
    try {
      const { data } = await api.post("/appointments/request", {
        date: reqDate,
        reason: reqReason,
        for: reqFor || undefined,
        doctorId: reqDoctorObj?._id,
        appointmentType: reqSlot?.typeId || undefined,
      });
      const autoConfirmed = !!data?.autoConfirmed;
      trackAppointment(autoConfirmed ? "booked" : "requested", { doctor_id: reqDoctorObj?._id });
      onSent({ autoConfirmed });
    } catch (err) {
      setReqError(err.response?.data?.message || "Could not send request.");
      setReqBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submitRequest} style={{ display: "contents" }}>
          <div className="modal-head">
            <h3 className="icon"><Icon name="event" size={18} /> Request an appointment</h3>
            <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Pick an available slot with Dr. {reqDoctorObj?.name}. They'll confirm your request.
          </p>
          {reqError && <div className="error">{reqError}</div>}
          {doctors.length > 1 && (
            <label>
              <span className="lbl">Which doctor?</span>
              <select
                value={reqDoctorObj?._id || ""}
                onChange={(e) => {
                  setReqDoctor(e.target.value);
                  // The old slot belongs to the other doctor's diary.
                  setReqDate("");
                  setReqSlot(null);
                }}
              >
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    Dr. {d.name}
                    {d.specialization ? ` · ${d.specialization}` : d.clinicName ? ` · ${d.clinicName}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {deps.length > 0 && (
            <label>
              <span className="lbl">Who is this for?</span>
              <select value={reqFor} onChange={(e) => setReqFor(e.target.value)}>
                <option value="">Myself</option>
                {deps.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="lbl">Purpose <span className="muted">(optional)</span></span>
            <input
              placeholder="e.g. Checkup, Toothache"
              value={reqReason}
              onChange={(e) => setReqReason(e.target.value)}
            />
          </label>
          <SlotPicker
            key={reqDoctorObj?._id || "doctor"}
            myDoctorId={reqDoctorObj?._id}
            initialDay={reqDay || undefined}
            value={reqDate}
            onChange={(iso, slot) => {
              setReqDate(iso);
              setReqSlot(slot);
            }}
            renderNoSlots={({ day, setDay }) => (
              <NoSlotAlternatives
                doctorId={reqDoctorObj?._id}
                doctorName={reqDoctorObj?.name}
                day={day}
                onPickDay={setDay}
                onPickDoctor={(d, onDay) => {
                  setReqDay(onDay);
                  setReqDoctor(d._id);
                  setReqDate("");
                  setReqSlot(null);
                }}
              />
            )}
          />
          <div className="row gap">
            <button type="submit" className="icon" disabled={reqBusy}>
              <Icon name="schedule_send" size={18} /> {reqBusy ? "Sending…" : "Send request"}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
