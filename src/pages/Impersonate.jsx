import { useEffect, useState } from "react";

// Consumes an admin "View as" link: /impersonate#token=<jwt>&name=<clinic>.
// The token is kept in the URL fragment (never sent to a server / logged) and
// swapped in as this tab's auth token, then we boot fresh into the doctor view.
export default function Impersonate() {
  const [error, setError] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("token");
    const name = hash.get("name") || "";
    if (!token) {
      setError(true);
      return;
    }
    localStorage.setItem("token", token);
    localStorage.setItem("viewAs", name);
    localStorage.removeItem("user"); // force AuthContext to re-fetch the doctor
    // Full navigation so the app re-initialises with the new token.
    window.location.replace("/doctor");
  }, []);

  if (error) {
    return (
      <div className="auth-wrap">
        <p>This view link is invalid or has expired. Please open a fresh one from the admin.</p>
      </div>
    );
  }
  return null;
}
