import Icon from "./Icon";

// Shown across the top whenever this tab is an admin "View as" (read-only)
// session. Makes the impersonation obvious and offers a one-tap way out.
export default function ImpersonationBanner() {
  const viewAs = sessionStorage.getItem("viewAs");
  if (viewAs === null) return null;

  const exit = () => {
    // Only this tab's view session is cleared — an admin signed in elsewhere
    // keeps their own (localStorage) session untouched.
    sessionStorage.removeItem("viewToken");
    sessionStorage.removeItem("viewUser");
    sessionStorage.removeItem("viewAs");
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
