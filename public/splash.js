// Boot splash progress + handoff. External (not inline) so the app can run a
// strict Content-Security-Policy with no 'unsafe-inline' for scripts.
(function () {
  var pct = 0;
  var bar = document.getElementById("splash-bar");
  var txt = document.getElementById("splash-pct");
  // Ease toward 90% while the app boots; finishSplash() completes it to 100%.
  var timer = setInterval(function () {
    pct += Math.max(0.6, (90 - pct) * 0.08);
    if (pct > 90) pct = 90;
    if (bar) bar.style.width = pct + "%";
    if (txt) txt.textContent = Math.round(pct) + "%";
  }, 90);
  window.finishSplash = function () {
    if (window.__splashDone) return;
    window.__splashDone = true;
    clearInterval(timer);
    if (bar) bar.style.width = "100%";
    if (txt) txt.textContent = "100%";
    var s = document.getElementById("splash");
    if (!s) return;
    setTimeout(function () {
      s.classList.add("hide");
      setTimeout(function () { if (s) s.remove(); }, 450);
    }, 200);
  };
  // Safety: never let the splash hang forever
  setTimeout(function () { window.finishSplash(); }, 8000);
})();
