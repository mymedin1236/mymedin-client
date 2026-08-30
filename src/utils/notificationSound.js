// The MyDentalBooking notification signature — a calm, rising bell-like triad
// (D5 → F#5 → A5, a bright major chord) synthesised with the Web Audio API.
// No audio file needed (CSP-safe, tiny), and it reads as a reassuring
// health-app cue rather than a harsh system beep.

let ctx;
let unlocked = false;
let lastPlayed = 0;

function getCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  return ctx;
}

// Browsers block audio until the user has interacted with the page. Resume the
// shared context on the first interaction so the chime can fire later (e.g. when
// a push arrives) without needing a gesture at that moment.
function unlock() {
  const c = getCtx();
  if (!c) return;
  c.resume?.();
  unlocked = true;
  window.removeEventListener("pointerdown", unlock);
  window.removeEventListener("keydown", unlock);
  window.removeEventListener("touchstart", unlock);
}
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock);
}

// "Spa chimes" — a gentle descending 4-note figure (A5 → F#5 → D5 → A4) with
// soft, lingering decays. Calm and wellness-like, the MyDentalBooking signature.
function playChime() {
  const c = getCtx();
  if (!c) return;
  c.resume?.();
  const start = c.currentTime + 0.02;

  const master = c.createGain();
  master.gain.value = 0.8;
  const warm = c.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 3400;
  master.connect(warm);
  warm.connect(c.destination);

  // freq, delay from start, decay length — later notes ring a little longer.
  const notes = [
    { freq: 880.0, delay: 0.0, decay: 0.8 },
    { freq: 739.99, delay: 0.12, decay: 0.9 },
    { freq: 587.33, delay: 0.24, decay: 1.0 },
    { freq: 440.0, delay: 0.36, decay: 1.2 },
  ];
  // Timbre: fundamental + soft 2nd and faint 3rd harmonic (chime shimmer).
  const partials = [
    [1, 1.0],
    [2, 0.18],
    [3, 0.05],
  ];

  notes.forEach(({ freq, delay, decay }) => {
    const t = start + delay;
    const noteGain = c.createGain();
    noteGain.connect(master);
    noteGain.gain.setValueAtTime(0.0001, t);
    noteGain.gain.exponentialRampToValueAtTime(0.16, t + 0.006); // soft attack
    noteGain.gain.exponentialRampToValueAtTime(0.0001, t + decay); // gentle decay

    partials.forEach(([ratio, amp]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      g.gain.value = amp;
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      osc.connect(g);
      g.connect(noteGain);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    });
  });
}

function vibrate() {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* ignore */
  }
}

// Single entry point: play the branded chime + a short vibration. Throttled so a
// push and the background poll arriving together don't double-trigger it.
export function playNotificationAlert() {
  const now = Date.now();
  if (now - lastPlayed < 1500) return;
  lastPlayed = now;
  try {
    playChime();
    vibrate();
  } catch {
    /* ignore */
  }
}
