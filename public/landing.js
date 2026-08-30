// If the visitor is already signed in, skip the marketing page and go straight
// to their dashboard. Runs before the page renders (script is at the top of
// <body>) so logged-in users never see a flash of marketing.
(function () {
  try {
    var token = localStorage.getItem("token");
    var user = JSON.parse(localStorage.getItem("user") || "null");
    if (token && user && user.role) {
      var home =
        user.role === "doctor" || user.role === "assistant"
          ? "/doctor"
          : user.role === "vendor"
          ? "/vendor"
          : "/client";
      window.location.replace(home);
    }
  } catch (e) {
    /* ignore — just show the landing page */
  }
})();
