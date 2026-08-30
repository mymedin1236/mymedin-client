import mixpanel from "mixpanel-browser";

const token = import.meta.env.VITE_MIXPANEL_TOKEN;
let enabled = false;

export const initAnalytics = () => {
  if (!token || enabled) return;
  mixpanel.init(token, {
    api_host: "https://api.mixpanel.com",
    track_pageview: false,
    persistence: "localStorage",
  });
  enabled = true;
};

export const identify = (user) => {
  if (!enabled || !user) return;
  mixpanel.identify(user._id);
  mixpanel.people.set({
    $email: user.email,
    $name: user.name,
    role: user.role,
  });
};

export const resetAnalytics = () => {
  if (!enabled) return;
  mixpanel.reset();
};

export const track = (event, props) => {
  if (!enabled) return;
  mixpanel.track(event, props);
};

export const trackLogIn = (user) => track("Log In", { role: user?.role });

export const trackLogOut = () => track("Log Out");

export const trackSignUp = (user) => track("Sign Up", { role: user?.role });

export const trackAgreementSigned = () => track("Agreement Signed");

// action: "requested" | "booked" | "updated" | "deleted" | "confirmed" |
// "declined" | "rescheduled" | "status_changed" | "arrival_updated"
export const trackAppointment = (action, props) => track("Appointment", { action, ...props });

// action: "created" | "updated" | "deleted"
export const trackTreatment = (action, props) => track("Treatment", { action, ...props });

// action: "created" | "updated" | "deleted"
export const trackPayment = (action, props) => track("Payment", { action, ...props });

// action: "reported" | "resolved"
export const trackFollowUp = (action, props) => track("Follow-up", { action, ...props });

export const trackDentistAssociationRequested = (dentistId) =>
  track("Dentist Association Requested", { dentist_id: dentistId });

export const trackNotificationViewed = (type) =>
  track("Notification Viewed", { notification_type: type });

export const trackNotificationDismissed = (type) =>
  track("Notification Dismissed", { notification_type: type });

export const trackTabViewed = (tab, path) => track("Tab Viewed", { tab, path });
