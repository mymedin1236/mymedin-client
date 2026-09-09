// Shared role-based navigation items, used by the desktop sidebar and mobile bottom bar.
export const ROLE_LINKS = {
  doctor: [
    { to: "/doctor", icon: "today", label: "Today's Schedule" },
    { to: "/appointments", icon: "calendar_month", label: "Appointments" },
    { to: "/clients", icon: "group", label: "Patients" },
    { to: "/dependents", icon: "escalator_warning", label: "Dependents" },
    { to: "/finances", icon: "payments", label: "Finances" },
    // Supplies temporarily hidden from the sidebar (route still exists).
    // { to: "/supplies", icon: "shopping_cart", label: "Supplies" },
    { to: "/expenses", icon: "receipt_long", label: "Expenses" },
    { to: "/invoices", icon: "request_quote", label: "Invoices" },
    { to: "/staff", icon: "badge", label: "Staff" },
    { to: "/settings", icon: "settings", label: "Settings" },
    { to: "/agreement", icon: "handshake", label: "E-Agreement" },
  ],
  // Assistant: same clinic tools as the doctor, minus staff management, plus
  // their own multi-clinic membership page (not shown to a doctor — they only
  // ever have the one clinic, themselves).
  assistant: [
    { to: "/doctor", icon: "today", label: "Today's Schedule" },
    { to: "/appointments", icon: "calendar_month", label: "Appointments" },
    { to: "/clients", icon: "group", label: "Patients" },
    { to: "/dependents", icon: "escalator_warning", label: "Dependents" },
    { to: "/settings", icon: "settings", label: "Settings" },
    { to: "/my-clinics", icon: "storefront", label: "My clinics" },
  ],
  client: [
    { to: "/client", icon: "home", label: "Home" },
    { to: "/client/appointments", icon: "calendar_month", label: "Appointments" },
    { to: "/client/treatments", icon: "medical_services", label: "Treatments" },
    { to: "/client/family", icon: "escalator_warning", label: "My family" },
    { to: "/find-doctor", icon: "person_search", label: "Find a doctor" },
  ],
  vendor: [{ to: "/vendor", icon: "storefront", label: "My Store" }],
};

// When a patient is associated, the "Find a doctor" tab becomes "My doctor"
// and points to their doctor's profile.
export const decorateClientLinks = (links, myDoctorId) =>
  links.map((l) =>
    l.to === "/find-doctor" && myDoctorId
      ? { ...l, to: `/doctors/${myDoctorId}`, icon: "medical_information", label: "My doctor" }
      : l
  );
