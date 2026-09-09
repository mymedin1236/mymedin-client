import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ClinicProvider } from "./context/ClinicContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { initAnalytics } from "./utils/analytics";
import "./styles.css";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClinicProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </ClinicProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Service worker registration, update checks, and the "new version" prompt are
// handled in components/UpdatePrompt.jsx via virtual:pwa-register/react.
