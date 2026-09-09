import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

const ClinicContext = createContext(null);

// An assistant may be actively engaged with several doctors at once. This
// resolves which one is "active" for the whole app BEFORE any clinic-scoped
// page renders (see ProtectedRoute) — otherwise a page could fire an API call
// before a clinic was chosen and hit the server's "no active clinic" guard.
export const ClinicProvider = ({ children }) => {
  const { user } = useAuth();
  const [engagements, setEngagements] = useState([]);
  const [activeClinicId, setActiveClinicIdState] = useState(
    () => localStorage.getItem("activeClinicId") || null
  );
  // True once we've resolved (or confirmed there's nothing to resolve).
  const [ready, setReady] = useState(false);

  const setActiveClinicId = useCallback((id) => {
    setActiveClinicIdState(id);
    if (id) localStorage.setItem("activeClinicId", id);
    else localStorage.removeItem("activeClinicId");
    window.dispatchEvent(new Event("clinic-changed"));
  }, []);

  const refresh = useCallback(async () => {
    if (user?.role !== "assistant") {
      setEngagements([]);
      setReady(true);
      return;
    }
    try {
      const { data } = await api.get("/engagements", { skipLoader: true });
      const active = data.filter((e) => e.status === "active");
      setEngagements(data);

      const current = localStorage.getItem("activeClinicId");
      const stillActive = active.some((e) => e.doctor?._id === current);
      // Previously-selected clinic is gone (or none was ever selected) — fall
      // back to the first active engagement, if any. Routes through
      // setActiveClinicId so this also fires "clinic-changed" on first login,
      // letting the notification feed refresh immediately instead of waiting
      // for its next poll.
      if (!stillActive) setActiveClinicId(active[0]?.doctor?._id || null);
    } catch {
      /* leave whatever was already resolved */
    } finally {
      setReady(true);
    }
  }, [user, setActiveClinicId]);

  useEffect(() => {
    setReady(false);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.role]);

  const activeClinics = engagements.filter((e) => e.status === "active");
  const pendingInvites = engagements.filter((e) => e.status === "pending");
  const activeClinic = activeClinics.find((e) => e.doctor?._id === activeClinicId) || null;

  return (
    <ClinicContext.Provider
      value={{
        ready,
        activeClinicId,
        activeClinic,
        activeClinics,
        pendingInvites,
        setActiveClinicId,
        refresh,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => useContext(ClinicContext);
