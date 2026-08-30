import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FullScreenLoader from "./FullScreenLoader";

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // `role` may be a single role or an array of allowed roles.
  const allowed = role == null || (Array.isArray(role) ? role.includes(user.role) : user.role === role);
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
