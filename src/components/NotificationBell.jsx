import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";
import Icon from "./Icon";
import { trackNotificationViewed, trackNotificationDismissed } from "../utils/analytics";

const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Where each notification should take the user
const routeFor = (n) => {
  switch (n.type) {
    case "association_request":
    case "association_ended":
      return "/clients";
    case "appointment_rescheduled":
    case "appointment_requested":
    case "appointment_cancelled":
    case "appointment_arrival":
      return "/appointments";
    case "association_approved":
    case "appointment_scheduled":
    case "appointment_reminder":
    case "appointment_confirmed":
    case "appointment_declined":
      return "/client";
    case "association_rejected":
      return "/find-dentist";
    default:
      return n.data?.url || "/";
  }
};

export default function NotificationBell() {
  const { items, unreadCount, markAllRead, markRead, markUnread, dismiss, acknowledge, hasMore, loadMore, enabled, setEnabled } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const openItem = (n) => {
    if (!n.read) markRead(n._id);
    trackNotificationViewed(n.type);
    setOpen(false);
    navigate(routeFor(n));
  };

  return (
    <div className="bell">
      <button className="bell-btn" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        <Icon name="notifications" />
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <>
          <div className="profile-backdrop" onClick={() => setOpen(false)} />
          <div className="bell-dropdown">
            <div className="bell-head">
              <span>Notifications</span>
              <button
                className="bell-toggle"
                onClick={() => setEnabled(!enabled)}
                aria-pressed={enabled}
                title={enabled ? "Turn notifications off" : "Turn notifications on"}
              >
                <Icon name={enabled ? "notifications_active" : "notifications_off"} size={18} />
                {enabled ? "On" : "Off"}
              </button>
            </div>

            {unreadCount > 0 && (
              <div className="bell-actions">
                <button className="bell-action" onClick={markAllRead}>
                  <Icon name="done_all" size={16} /> Mark all read
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <div className="bell-empty">No notifications.</div>
            ) : (
              items.map((n) => (
                <div
                  key={n._id}
                  className={`bell-item ${n.read ? "" : "unread"}`}
                  onClick={() => openItem(n)}
                >
                  <div className="bell-item-main">
                    <div className="bell-title">{n.title}</div>
                    {n.body && <div className="bell-body">{n.body}</div>}
                    {n.data?.canAcknowledge && (
                      n.data?.acknowledged ? (
                        <div className="bell-ack done icon">
                          <Icon name="check_circle" size={14} /> Acknowledged
                        </div>
                      ) : (
                        <button
                          className="bell-ack icon"
                          onClick={(e) => { e.stopPropagation(); acknowledge(n._id); }}
                        >
                          <Icon name="done" size={14} /> Acknowledge
                        </button>
                      )
                    )}
                    <div className="bell-time">{timeAgo(n.createdAt)}</div>
                  </div>
                  <div className="bell-item-actions">
                    <button
                      className="bell-dismiss"
                      aria-label={n.read ? "Mark as unread" : "Mark as read"}
                      title={n.read ? "Mark as unread" : "Mark as read"}
                      onClick={(e) => {
                        e.stopPropagation();
                        n.read ? markUnread(n._id) : markRead(n._id);
                      }}
                    >
                      <Icon name={n.read ? "mark_email_unread" : "mark_email_read"} size={16} />
                    </button>
                    <button
                      className="bell-dismiss"
                      aria-label="Dismiss"
                      title="Dismiss"
                      onClick={(e) => {
                        e.stopPropagation();
                        trackNotificationDismissed(n.type);
                        dismiss(n._id);
                      }}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}

            {hasMore && (
              <button className="bell-loadmore" onClick={loadMore}>
                <Icon name="expand_more" size={16} /> Load older
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
