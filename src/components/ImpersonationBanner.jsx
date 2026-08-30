import Icon from "./Icon";

// Shown across the top whenever this tab is an admin "View as" (read-only)
// session. Makes the impersonation obvious and offers a one-tap way out.
export default function ImpersonationBanner() {
  const viewAs = localStorage.getItem("viewAs");
  if (viewAs === null) return null;

  const exit = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("viewAs");
    window.location.replace("/login");
  };

  return (
    <div className="impersonate-banner">
      <span className="row gap icon">
        <Icon name="visibility" size={16} />
        Viewing {viewAs || "clinic"} — read-only
      </span>
      <button type="button" className="impersonate-exit" onClick={exit}>
        Exit view
      </button>
    </div>
  );
}
