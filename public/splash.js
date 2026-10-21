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
  // The app calls finishSplash() itself once it has started (AuthContext gives
  // up on a slow session check after 12s). If it still hasn't after 15s, the
  // app code itself didn't load, so offer a reload instead of a blank screen.
  setTimeout(function () {
    if (window.__splashDone) return;
    var slow = document.getElementById("splash-slow");
    var reload = document.getElementById("splash-reload");
    if (reload) reload.addEventListener("click", function () { location.reload(); });
    if (slow) slow.hidden = false;
  }, 15000);
  // Safety: if the app did render but never handed over, don't cover it.
  setTimeout(function () {
    var root = document.getElementById("root");
    if (root && root.childElementCount > 0) window.finishSplash();
  }, 25000);
})();
