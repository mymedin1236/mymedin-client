import { useState } from "react";
import Icon from "./Icon";

// A value shown as blue/underlined, one-tap copy to clipboard — used wherever a
// doctor needs to grab a value (account number, share link) and paste it
// somewhere else (banking app, WhatsApp).
export default function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for browsers without the async clipboard API
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button type="button" className="acct-copy" onClick={copy} title="Tap to copy">
      <span className="acct-num">{value}</span>
      <Icon name={copied ? "check" : "content_copy"} size={16} />
      <span className="acct-copied">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
