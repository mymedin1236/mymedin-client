import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import api from "./api/axios";
import { useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import ProfileMenu from "./components/ProfileMenu";
import NotificationBell from "./components/NotificationBell";
import { useNotifications } from "./context/NotificationsContext";
import Icon from "./components/Icon";
import GlobalLoader from "./components/GlobalLoader";
import UpdatePrompt from "./components/UpdatePrompt";
import FullScreenLoader from "./components/FullScreenLoader";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DentistDashboard from "./pages/DentistDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import ClientAppointments from "./pages/ClientAppointments";
import ClientTreatments from "./pages/ClientTreatments";
import Family from "./pages/Family";
import Clients from "./pages/Clients";
import Staff from "./pages/Staff";
import ClientLedger from "./pages/ClientLedger";
import Appointments from "./pages/Appointments";
import Treatments from "./pages/Treatments";
import FindDentist from "./pages/FindDentist";
import DentistProfile from "./pages/DentistProfile";
import VendorDashboard from "./pages/VendorDashboard";
import Marketplace from "./pages/Marketplace";
import Finances from "./pages/Finances";
import Maintenance from "./pages/Maintenance";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Agreement from "./pages/Agreement";
import Impersonate from "./pages/Impersonate";
import ImpersonationBanner from "./components/ImpersonationBanner";
import Invoices from "./pages/Invoices";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  const home =
    user.role === "dentist" || user.role === "assistant"
      ? "/dentist"
      : user.role === "vendor"
      ? "/vendor"
      : "/client";
  return <Navigate to={home} replace />;
}

// App chrome: fixed sidebar on desktop; top bar (brand + profile) and a
// bottom tab bar on mobile. Auth pages (no user) render full-screen, no chrome.
function Shell({ children }) {
  const { user } = useAuth();
  const { items } = useNotifications();
  // For patients: know their associated dentist so the "Find a dentist" tab
  // becomes "My dentist" pointing to that dentist's profile.
  const [myDentistId, setMyDentistId] = useState(null);

  useEffect(() => {
    if (user?.role !== "client") {
      setMyDentistId(null);
      return;
    }
    const refresh = () =>
      api
        .get("/associations/me", { skipLoader: true })
        .then((r) => setMyDentistId(r.data?.dentist?._id || null))
        .catch(() => {});
    refresh();
    // Update instantly when the association changes — a dentist approval/decline
    // arrives as a notification, and the patient's own leave/request fires an event.
    window.addEventListener("association-changed", refresh);
    return () => window.removeEventListener("association-changed", refresh);
  }, [user, items.length]);

  if (!user) return children;

  return (
    <div className="app-shell">
      <Sidebar myDentistId={myDentistId} />
      <div className="app-main">
        <ImpersonationBanner />
        <header className="topbar">
          <Link to="/" className="topbar-brand icon">
            <Icon name="stethoscope" /> MyMedin
          </Link>
          <div className="row gap">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        {children}
      </div>
      <MobileNav role={user.role} myDentistId={myDentistId} />
    </div>
  );
}

export default function App() {
  return (
    <>
      <GlobalLoader />
      <UpdatePrompt />
      <Shell>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/impersonate" element={<Impersonate />} />
        <Route path="/" element={<Home />} />
        <Route
          path="/dentist"
          element={
            <ProtectedRoute role={["dentist", "assistant"]}>
              <DentistDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client"
          element={
            <ProtectedRoute role="client">
              <ClientDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/appointments"
          element={
            <ProtectedRoute role="client">
              <ClientAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/treatments"
          element={
            <ProtectedRoute role="client">
              <ClientTreatments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/family"
          element={
            <ProtectedRoute role="client">
              <Family />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute role={["dentist", "assistant"]}>
              <Clients key="patients" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dependents"
          element={
            <ProtectedRoute role={["dentist", "assistant"]}>
              <Clients key="dependents" mode="dependents" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <ProtectedRoute role={["dentist", "assistant"]}>
              <ClientLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute role="dentist">
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute role={["dentist", "assistant"]}>
              <Appointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/treatments"
          element={
            <ProtectedRoute role="dentist">
              <Treatments />
            </ProtectedRoute>
          }
        />
        {/* Public discovery: anyone can browse dentists before signing in */}
        <Route path="/find-dentist" element={<FindDentist />} />
        <Route path="/dentists/:id" element={<DentistProfile />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute role={["dentist", "assistant"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agreement"
          element={
            <ProtectedRoute role="dentist">
              <Agreement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor"
          element={
            <ProtectedRoute role="vendor">
              <VendorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supplies"
          element={
            <ProtectedRoute role="dentist">
              <Marketplace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finances"
          element={
            <ProtectedRoute role="dentist">
              <Finances />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute role="dentist">
              <Maintenance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute role="dentist">
              <Invoices />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </>
  );
}
