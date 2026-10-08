import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import Icon from "./Icon";
import { trackInvoice } from "../utils/analytics";

// Error bodies come back as a Blob when the request asked for a PDF.
async function blobErrorMessage(err, fallback) {
  try {
    const data = err.response?.data;
    if (data instanceof Blob) return JSON.parse(await data.text()).message || fallback;
    return data?.message || fallback;
  } catch {
    return fallback;
  }
}

// wa.me needs an international number; stored ones are free text (0300…).
// Same rules as the server's toChatId, default country Pakistan.
function waNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (d.length <= 10) d = "92" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

// Download, print, email or WhatsApp a patient's invoice PDF.
// `treatment` narrows it to one treatment; omit it for the full statement.
export default function InvoiceModal({ client, treatment, onClose }) {
  const [pdf, setPdf] = useState(null); // { blob, url }
  const [error, setError] = useState("");
  const [status, setStatus] = useState(""); // success message
  const [emailing, setEmailing] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const frameRef = useRef(null);

  const params = treatment ? { treatment: treatment._id } : undefined;
  const scope = treatment ? "treatment" : "all";
  const filename = `Invoice-${client.name.replace(/[^\w]+/g, "-")}${
    treatment ? `-${treatment.procedure.replace(/[^\w]+/g, "-")}` : ""
  }.pdf`;
  const email = client.managed ? client.guardianEmail : client.email;
  const phone = client.managed ? client.guardianPhone : client.phone;

  // Fetch the PDF up front so the buttons act instantly — print and share must
  // run inside the click, or browsers block them as not user-initiated.
  useEffect(() => {
    let url;
    api
      .get(`/treatments/invoice/${client._id}`, { params, responseType: "blob" })
      .then(({ data }) => {
        const blob = new Blob([data], { type: "application/pdf" });
        url = URL.createObjectURL(blob);
        setPdf({ blob, url });
      })
      .catch(async (err) => setError(await blobErrorMessage(err, "Could not generate the invoice.")));
    return () => url && URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client._id, treatment?._id]);

  const download = () => {
    const a = document.createElement("a");
    a.href = pdf.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    trackInvoice("downloaded", { client_id: client._id, scope });
  };

  const print = () => {
    trackInvoice("printed", { client_id: client._id, scope });
    // Mobile browsers can't print a PDF from a frame — open it in the viewer,
    // which has its own print / share action.
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.open(pdf.url, "_blank");
      return;
    }
    try {
      frameRef.current.contentWindow.focus();
      frameRef.current.contentWindow.print();
    } catch {
      window.open(pdf.url, "_blank");
    }
  };

  const sendEmail = async () => {
    setError("");
    setStatus("");
    setEmailing(true);
    try {
      const { data } = await api.post(`/treatments/invoice/${client._id}/email`, null, { params });
      setStatus(`Invoice emailed to ${data.sentTo}.`);
      trackInvoice("emailed", { client_id: client._id, scope });
    } catch (err) {
      setError(err.response?.data?.message || "Could not email the invoice.");
    } finally {
      setEmailing(false);
    }
  };

  // Send the invoice summary as a WhatsApp text from the clinic's number.
  const sendWhatsAppText = async () => {
    setError("");
    setStatus("");
    setMessaging(true);
    try {
      const { data } = await api.post(`/treatments/invoice/${client._id}/whatsapp`, null, { params });
      setStatus(`Invoice details sent on WhatsApp to ${data.sentTo}.`);
      trackInvoice("shared", { client_id: client._id, scope, via: "whatsapp_text" });
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the WhatsApp message.");
    } finally {
      setMessaging(false);
    }
  };

  // Share the actual PDF through the OS share sheet (WhatsApp shows up there on
  // phones). Where files can't be shared (most desktops), download it and open
  // the patient's chat so it can be attached.
  const sendWhatsApp = async () => {
    setError("");
    setStatus("");
    const text = `Hi ${client.managed ? client.guardianName || "" : client.name}, please find your invoice attached.`;
    const file = new File([pdf.blob], filename, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        trackInvoice("shared", { client_id: client._id, scope, via: "share_sheet" });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    download();
    const n = waNumber(phone);
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setStatus("The PDF was downloaded — attach it in the WhatsApp chat that just opened.");
    trackInvoice("shared", { client_id: client._id, scope, via: "whatsapp_link" });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="icon"><Icon name="receipt_long" size={18} /> Invoice</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {treatment ? `${treatment.procedure} for ${client.name}` : `All treatments & payments for ${client.name}`}
        </p>
        {error && <div className="error">{error}</div>}
        {status && <div className="info-banner" style={{ marginBottom: 0 }}>{status}</div>}
        {!pdf && !error && <p className="muted">Preparing PDF…</p>}
        <div className="invoice-actions">
          <button type="button" className="icon" disabled={!pdf} onClick={download}>
            <Icon name="download" size={18} /> Download PDF
          </button>
          <button type="button" className="btn-secondary icon" disabled={!pdf} onClick={print}>
            <Icon name="print" size={18} /> Print
          </button>
          <button
            type="button"
            className="btn-secondary icon"
            disabled={!pdf || !email || emailing}
            title={email ? `Send to ${email}` : "No email address on file"}
            onClick={sendEmail}
          >
            <Icon name="mail" size={18} /> {emailing ? "Sending…" : "Email to patient"}
          </button>
          <button
            type="button"
            className="btn-whatsapp"
            disabled={!phone || messaging}
            title={phone ? `Send to ${phone}` : "No phone number on file"}
            onClick={sendWhatsAppText}
          >
            <Icon name="chat" size={18} /> {messaging ? "Sending…" : "Send on WhatsApp"}
          </button>
          <button type="button" className="btn-secondary icon" disabled={!pdf} onClick={sendWhatsApp}>
            <Icon name="share" size={18} /> Share PDF
          </button>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          “Send on WhatsApp” messages the invoice details from the clinic’s number. “Share PDF” sends the file itself
          from this device.
          {!email && " Add an email address to this patient to send the invoice by email."}
        </span>
        {pdf && <iframe ref={frameRef} src={pdf.url} title="Invoice" className="invoice-print-frame" />}
      </div>
    </div>
  );
}
