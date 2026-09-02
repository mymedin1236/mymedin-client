import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import { ROLE_LINKS, decorateClientLinks } from "../navLinks";
import Icon from "./Icon";
import { trackTabViewed } from "../utils/analytics";

// Pending-request counts shown as a badge on the matching nav tab.
const badgeFor = (to, { associationRequests, appointmentRequests }) => {
  if (to === "/clients") return associationRequests;
  if (to === "/appointments") return appointmentRequests;
  return 0;
};

export default function Sidebar({ open, onNavigate, myDoctorId }) {
  const { user } = useAuth();
  const { associationRequests, appointmentRequests } = useNotifications() || {};
  if (!user) return null;

  const links = decorateClientLinks(ROLE_LINKS[user.role] || [], myDoctorId);

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand">
        <Link to="/" className="icon" onClick={onNavigate}>
          <Icon name="stethoscope" />
          <span>MyMedin</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        {links.map((l) => {
          const count = badgeFor(l.to, { associationRequests, appointmentRequests });
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={links.some((o) => o.to !== l.to && o.to.startsWith(`${l.to}/`))}
              className="sidebar-link"
              onClick={() => {
                trackTabViewed(l.label, l.to);
                onNavigate?.();
              }}
            >
              <span className="nav-icon-wrap">
                <Icon name={l.icon} />
                {count > 0 && <span className="nav-badge">{count > 9 ? "9+" : count}</span>}
              </span>
              <span>{l.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
