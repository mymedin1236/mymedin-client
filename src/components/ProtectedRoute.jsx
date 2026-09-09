import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClinic } from "../context/ClinicContext";
import FullScreenLoader from "./FullScreenLoader";

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const { ready: clinicReady } = useClinic();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // An assistant's active clinic must be resolved before any clinic-scoped page
  // renders — otherwise it could fire an API call before one was chosen and hit
  // the server's "no active clinic selected" guard (see ClinicContext).
  if (user.role === "assistant" && !clinicReady) return <FullScreenLoader />;
  // `role` may be a single role or an array of allowed roles.
  const allowed = role == null || (Array.isArray(role) ? role.includes(user.role) : user.role === role);
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
