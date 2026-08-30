import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";
import { subscribeToPush, unsubscribeFromPush } from "../push";
import { playNotificationAlert } from "../utils/notificationSound";

const NotificationsContext = createContext(null);

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [enabled, setEnabledState] = useState(
    () => localStorage.getItem("notifEnabled") !== "false"
  );
  const prevUnread = useRef(0);
  const firstLoad = useRef(true);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications", {
        params: { limit },
        skipLoader: true,
      });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setTotal(data.total ?? data.items.length);
      // Branded chime + vibration only when enabled AND a new unread arrives after first load
      if (enabledRef.current && !firstLoad.current && data.unreadCount > prevUnread.current) {
        playNotificationAlert();
      }
      prevUnread.current = data.unreadCount;
      firstLoad.current = false;
    } catch {
      /* ignore poll errors */
    }
  }, [limit]);

  // Show older notifications by raising the fetch limit (the next poll fills them in).
  const loadMore = () => setLimit((n) => n + 50);

  // If the app was opened from a push "Acknowledge" action (deep link ?ack=<id>),
  // acknowledge that notification and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ackId = params.get("ack");
    if (!ackId) return;
    api
      .post(`/notifications/${ackId}/acknowledge`, null, { skipLoader: true })
      .catch(() => {})
      .finally(() => refresh());
    params.delete("ack");
    const clean =
      window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
    window.history.replaceState({}, "", clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play the branded chime the instant a push arrives (the service worker posts a
  // message), instead of waiting for the next poll. Only when the tab is visible —
  // if it's hidden, the OS notification with its own sound has already fired.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event) => {
      // Tapping the push's "Acknowledge" action (app already open) -> acknowledge.
      if (event.data?.type === "acknowledge" && event.data.ack) {
        api
          .post(`/notifications/${event.data.ack}/acknowledge`, null, { skipLoader: true })
          .catch(() => {})
          .finally(() => refresh());
        return;
      }
      if (event.data?.type !== "push-received") return;
      if (enabledRef.current && document.visibilityState === "visible") {
        playNotificationAlert();
      }
      refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      prevUnread.current = 0;
      firstLoad.current = true;
      return;
    }
    refresh();
    if (enabled) subscribeToPush(); // register background push (best-effort)
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refresh]);

  // Turn notifications on/off: controls alerts (sound/vibration) and background push
  const setEnabled = (value) => {
    setEnabledState(value);
    localStorage.setItem("notifEnabled", value ? "true" : "false");
    if (value) subscribeToPush();
    else unsubscribeFromPush();
  };

  const markAllRead = async () => {
    // Update the UI immediately so the bell badge clears instantly…
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
    prevUnread.current = 0;
    // …then persist (the next poll will reconcile if this fails).
    try {
      await api.post("/notifications/read-all", null, { skipLoader: true });
    } catch {
      /* ignore */
    }
  };

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`, null, { skipLoader: true });
    } catch {
      /* ignore */
    }
    setItems((prev) => {
      const next = prev.map((i) => (i._id === id ? { ...i, read: true } : i));
      const unread = next.filter((i) => !i.read).length;
      setUnreadCount(unread);
      prevUnread.current = unread;
      return next;
    });
  };

  const markUnread = async (id) => {
    try {
      await api.post(`/notifications/${id}/unread`, null, { skipLoader: true });
    } catch {
      /* ignore */
    }
    setItems((prev) => {
      const next = prev.map((i) => (i._id === id ? { ...i, read: false } : i));
      const unread = next.filter((i) => !i.read).length;
      setUnreadCount(unread);
      prevUnread.current = unread;
      return next;
    });
  };

  const dismiss = async (id) => {
    try {
      await api.delete(`/notifications/${id}`, { skipLoader: true });
    } catch {
      /* ignore */
    }
    setItems((prev) => {
      const next = prev.filter((i) => i._id !== id);
      const unread = next.filter((i) => !i.read).length;
      setUnreadCount(unread);
      prevUnread.current = unread;
      return next;
    });
  };

  // Patient acknowledges an appointment notification -> clinic is notified.
  const acknowledge = async (id) => {
    try {
      await api.post(`/notifications/${id}/acknowledge`, null, { skipLoader: true });
    } catch {
      return; // leave the button so they can retry
    }
    setItems((prev) => {
      const next = prev.map((i) =>
        i._id === id ? { ...i, read: true, data: { ...i.data, acknowledged: true } } : i
      );
      const unread = next.filter((i) => !i.read).length;
      setUnreadCount(unread);
      prevUnread.current = unread;
      return next;
    });
  };

  return (
    <NotificationsContext.Provider
      value={{
        items,
        unreadCount,
        total,
        hasMore: items.length < total,
        loadMore,
        refresh,
        markAllRead,
        markRead,
        markUnread,
        dismiss,
        acknowledge,
        enabled,
        setEnabled,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
