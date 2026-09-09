import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import api from "./api/axios";
import { useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import ProfileMenu from "./components/ProfileMenu";
import ClinicSwitcher from "./components/ClinicSwitcher";
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
import DoctorDashboard from "./pages/DoctorDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import ClientAppointments from "./pages/ClientAppointments";
import ClientTreatments from "./pages/ClientTreatments";
import Family from "./pages/Family";
import Clients from "./pages/Clients";
import Staff from "./pages/Staff";
import MyClinics from "./pages/MyClinics";
import Share from "./pages/Share";
import ClientLedger from "./pages/ClientLedger";
import Appointments from "./pages/Appointments";
import Treatments from "./pages/Treatments";
import FindDoctor from "./pages/FindDoctor";
import DoctorProfile from "./pages/DoctorProfile";
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
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  const home =
    user.role === "admin"
      ? "/admin/dashboard"
      : user.role === "doctor" || user.role === "assistant"
      ? "/doctor"
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
  // For patients: know their associated doctor so the "Find a doctor" tab
  // becomes "My doctor" pointing to that doctor's profile.
  const [myDoctorId, setMyDoctorId] = useState(null);

  useEffect(() => {
    if (user?.role !== "client") {
      setMyDoctorId(null);
      return;
    }
    const refresh = () =>
      api
        .get("/associations/me", { skipLoader: true })
        .then((r) => setMyDoctorId(r.data?.doctor?._id || null))
        .catch(() => {});
    refresh();
    // Update instantly when the association changes — a doctor approval/decline
    // arrives as a notification, and the patient's own leave/request fires an event.
    window.addEventListener("association-changed", refresh);
    return () => window.removeEventListener("association-changed", refresh);
  }, [user, items.length]);

  // Admin has its own full-page layout (topbar + tabs), not the
  // patient/doctor/vendor sidebar chrome.
  if (!user || user.role === "admin") return children;

  return (
    <div className="app-shell">
      <Sidebar myDoctorId={myDoctorId} />
      <div className="app-main">
        <ImpersonationBanner />
        <header className="topbar">
          <Link to="/" className="topbar-brand icon">
            <Icon name="stethoscope" /> MyMedin
          </Link>
          <div className="row gap">
            {user.role === "assistant" && <ClinicSwitcher />}
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        {children}
      </div>
      <MobileNav role={user.role} myDoctorId={myDoctorId} />
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
        <Route path="/admin" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Home />} />
        <Route
          path="/doctor"
          element={
            <ProtectedRoute role={["doctor", "assistant"]}>
              <DoctorDashboard />
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
            <ProtectedRoute role={["doctor", "assistant"]}>
              <Clients key="patients" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dependents"
          element={
            <ProtectedRoute role={["doctor", "assistant"]}>
              <Clients key="dependents" mode="dependents" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <ProtectedRoute role={["doctor", "assistant"]}>
              <ClientLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute role="doctor">
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/share"
          element={
            <ProtectedRoute role={["doctor", "assistant"]}>
              <Share />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-clinics"
          element={
            <ProtectedRoute role="assistant">
              <MyClinics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute role={["doctor", "assistant"]}>
              <Appointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/treatments"
          element={
            <ProtectedRoute role="doctor">
              <Treatments />
            </ProtectedRoute>
          }
        />
        {/* Public discovery: anyone can browse doctors before signing in */}
        <Route path="/find-doctor" element={<FindDoctor />} />
        <Route path="/doctors/:id" element={<DoctorProfile />} />
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
            <ProtectedRoute role={["doctor", "assistant"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agreement"
          element={
            <ProtectedRoute role="doctor">
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
            <ProtectedRoute role="doctor">
              <Marketplace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finances"
          element={
            <ProtectedRoute role="doctor">
              <Finances />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute role="doctor">
              <Maintenance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute role="doctor">
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
