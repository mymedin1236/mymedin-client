import { QRCodeSVG } from "qrcode.react";
import Icon from "../components/Icon";
import CopyValue from "../components/CopyValue";
import { useAuth } from "../context/AuthContext";
import { useClinic } from "../context/ClinicContext";

export default function Share() {
  const { user } = useAuth();
  const { activeClinic } = useClinic();

  // A doctor shares their own profile; an assistant shares whichever clinic is
  // currently active in the switcher (they may work for more than one doctor).
  const doctorId = user.role === "assistant" ? activeClinic?.doctor?._id : user._id;
  const doctorName = user.role === "assistant" ? activeClinic?.doctor?.name : user.name;

  if (!doctorId) {
    return (
      <div className="page">
        <div className="page-head">
          <h1 className="icon"><Icon name="qr_code_2" /> Share</h1>
        </div>
        <p className="muted">Select a clinic from the switcher at the top to get its share link.</p>
      </div>
    );
  }

  const link = `${window.location.origin}/doctors/${doctorId}`;
  const shareMessage = `Book your appointment with Dr. ${doctorName} on MyMedin: ${link}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="qr_code_2" /> Share</h1>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        Share this with patients so they can book with Dr. {doctorName} directly — print the QR code, send the
        link, or share it straight to WhatsApp.
      </p>

      <div className="card" style={{ maxWidth: 420, alignItems: "center", textAlign: "center" }}>
        <div className="qr-box">
          <QRCodeSVG value={link} size={200} />
        </div>
        <CopyValue value={link} />
        <a className="btn-whatsapp icon" href={waLink} target="_blank" rel="noreferrer" style={{ width: "100%", justifyContent: "center" }}>
          <Icon name="chat" size={18} /> Share via WhatsApp
        </a>
      </div>
    </div>
  );
}
