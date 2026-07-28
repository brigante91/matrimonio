(() => {
  const SHEETS_ENDPOINT =
    "aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J6M3FtMDlHNXo4Y0p0Y1BObVJRX1pOTzFIMkgwN3hXZ1NXN2Myc3BITnhWWXRqVmhjeUFnUExhMklRVW1mb1FYRS0vZXhlYw==";

  function resolveEndpoint(encoded) {
    try {
      return atob(encoded);
    } catch {
      return "";
    }
  }

  const SHEETS_WEBAPP_URL = resolveEndpoint(SHEETS_ENDPOINT);

  const PREVIEW_SECTIONS = ["details", "rsvp", "portrait"];

  const params = new URLSearchParams(window.location.search);
  const previewParam = params.get("preview");
  const previewSection = PREVIEW_SECTIONS.includes(previewParam) ? previewParam : null;
  const previewEnvelope = previewParam !== null && !previewSection;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = document.getElementById("envelopeScene");
  const envelope = document.getElementById("envelope");
  const invitation = document.getElementById("invitation");
  const form = document.getElementById("rsvpForm");
  const success = document.getElementById("rsvpSuccess");
  const successText = document.getElementById("rsvpSuccessText");
  const guestsField = document.getElementById("guestsField");
  const allergiesField = document.getElementById("allergiesField");
  const attendanceInputs = form.querySelectorAll('input[name="attendance"]');
  const allergyInputs = form.querySelectorAll('input[name="allergies"]');
  const bgMusic = document.getElementById("bgMusic");
  const musicToggle = document.getElementById("musicToggle");
  const musicToggleLabel = document.getElementById("musicToggleLabel");
  const submitBtn = document.getElementById("rsvpSubmit");
  const errorEl = document.getElementById("rsvpError");
  const countdownEl = document.getElementById("countdown");

  let opened = false;
  let musicStarted = false;
  let musicUnlocked = false;
  let musicFadeFrame = null;
  let musicPausedByUser = false;
  const WEDDING_AT = new Date("2027-07-14T12:00:00+02:00").getTime();
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const MUSIC_VOLUME = Math.min(1, Math.max(0, isTouch ? 0.14 : 0.24));
  const MUSIC_PREF_KEY = "wedding-music-on";

  function clampVolume(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  if (isTouch) document.body.classList.add("is-touch");

  function hydrateDeferredSources(root = document) {
    root.querySelectorAll("[data-src]").forEach((el) => {
      const src = el.getAttribute("data-src");
      if (!src || el.getAttribute("src") === src) return;
      el.setAttribute("src", src);
      el.removeAttribute("data-src");
    });
    root.querySelectorAll("[data-srcset]").forEach((el) => {
      const srcset = el.getAttribute("data-srcset");
      if (!srcset || el.getAttribute("srcset") === srcset) return;
      el.setAttribute("srcset", srcset);
      el.removeAttribute("data-srcset");
    });
  }

  function prefetchInvitationAssets() {
    if (invitation) hydrateDeferredSources(invitation);
  }

  document.body.classList.add("is-locked");

  function parseMs(cssVar) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    return parseInt(raw, 10) || 0;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function updateCountdown() {
    if (!countdownEl) return;

    const diff = Math.max(0, WEDDING_AT - Date.now());
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const daysEl = countdownEl.querySelector('[data-unit="days"]');
    const hoursEl = countdownEl.querySelector('[data-unit="hours"]');
    const minutesEl = countdownEl.querySelector('[data-unit="minutes"]');
    const secondsEl = countdownEl.querySelector('[data-unit="seconds"]');

    if (daysEl) daysEl.textContent = String(days);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minutesEl) minutesEl.textContent = pad(minutes);
    if (secondsEl) secondsEl.textContent = pad(seconds);

    countdownEl.classList.toggle("is-complete", diff === 0);
    countdownEl.setAttribute(
      "aria-label",
      diff === 0
        ? "Il giorno del matrimonio è arrivato"
        : `Mancano ${days} giorni, ${hours} ore, ${minutes} minuti e ${seconds} secondi`
    );

    return diff > 0;
  }

  if (updateCountdown()) {
    window.setInterval(updateCountdown, 1000);
  }

  function ensureAudioSrc() {
    if (!bgMusic) return false;
    if (bgMusic.getAttribute("src")) return true;
    const src = bgMusic.getAttribute("data-src");
    if (!src) return false;
    bgMusic.src = src;
    return true;
  }

  function fadeInVolume() {
    if (!bgMusic) return;
    const start = performance.now();
    const duration = 1800;
    const target = clampVolume(MUSIC_VOLUME);

    const step = (now) => {
      if (!bgMusic || bgMusic.paused) return;
      const elapsed = Math.max(0, now - start);
      const t = Math.min(1, elapsed / duration);
      bgMusic.volume = clampVolume(target * t);
      syncMusicToggle();
      if (t < 1) musicFadeFrame = requestAnimationFrame(step);
      else {
        bgMusic.volume = target;
        syncMusicToggle();
      }
    };

    if (musicFadeFrame) cancelAnimationFrame(musicFadeFrame);
    musicFadeFrame = requestAnimationFrame(step);
  }

  async function tryUnlockMusic() {
    if (!bgMusic || reducedMotion || musicPausedByUser) return false;
    if (isMusicAudible()) return true;
    if (!ensureAudioSrc()) return false;

    try {
      bgMusic.muted = false;
      if (bgMusic.paused) {
        bgMusic.volume = 0;
        await bgMusic.play();
      }
      musicUnlocked = true;
      musicStarted = true;
      musicPausedByUser = false;
      if (musicToggle) musicToggle.hidden = false;
      fadeInVolume();
      try {
        localStorage.setItem(MUSIC_PREF_KEY, "1");
      } catch {
        // ignore
      }
      syncMusicToggle();
      return true;
    } catch {
      return false;
    }
  }

  function initMusic() {
    if (!bgMusic) return;
    if (musicToggle) musicToggle.hidden = false;
    syncMusicToggle();
  }

  function bindMusicUnlockGestures() {
    const unlockFromGesture = () => {
      if (musicPausedByUser || isMusicAudible()) return;
      // Only start audio after a real user gesture (avoids early 2.5MB download).
      if (localStorage.getItem(MUSIC_PREF_KEY) === "0") return;
      tryUnlockMusic();
    };
    ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
      document.addEventListener(eventName, unlockFromGesture, {
        passive: true,
        capture: true,
      });
    });
  }

  function isMusicAudible() {
    if (!bgMusic || bgMusic.paused || bgMusic.muted || musicPausedByUser) return false;
    return bgMusic.volume > 0;
  }

  function syncMusicToggle() {
    if (!musicToggle) return;
    const playing = isMusicAudible();
    musicToggle.classList.toggle("is-playing", playing);
    musicToggle.classList.toggle("is-paused", !playing);
    musicToggle.setAttribute("aria-pressed", playing ? "true" : "false");
    if (musicToggleLabel) {
      musicToggleLabel.textContent = playing ? "In riproduzione" : "In pausa";
    }
  }

  if (musicToggle) {
    musicToggle.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!bgMusic) return;
      if (isMusicAudible()) {
        musicPausedByUser = true;
        bgMusic.pause();
        try {
          localStorage.setItem(MUSIC_PREF_KEY, "0");
        } catch {
          // ignore
        }
        syncMusicToggle();
        return;
      }
      musicPausedByUser = false;
      await tryUnlockMusic();
      syncMusicToggle();
    });
  }

  function finishOpen() {
    document.body.classList.add("has-opened");
    document.body.classList.remove("is-locked", "is-opening-envelope", "is-revealing-site");
    if (scene && scene.isConnected) scene.remove();
    hydrateDeferredSources(invitation);
    observeReveals();
  }

  function finishOpenInstant() {
    invitation.hidden = false;
    invitation.classList.add("is-revealed");
    document.body.classList.add("has-opened");
    document.body.classList.remove("is-locked", "is-opening-envelope", "is-revealing-site");
    if (scene && scene.isConnected) scene.remove();
    hydrateDeferredSources(invitation);
    observeReveals();
  }

  async function runGateOpen() {
    scene.classList.add("is-settling");
    await wait(parseMs("--anim-settle"));

    invitation.hidden = false;
    void invitation.offsetWidth;
    prefetchInvitationAssets();
    invitation.classList.add("is-revealed", "is-gate-blurred");
    document.body.classList.add("is-revealing-site");

    const gateOpenMs = parseMs("--anim-gate-open");
    const clearAt = Math.round(gateOpenMs * 0.35);

    scene.classList.add("is-gate-opening");
    await wait(clearAt);

    invitation.classList.remove("is-gate-blurred");
    invitation.classList.add("is-gate-clear");
    await wait(gateOpenMs - clearAt);

    scene.classList.add("is-gate-open");
    await wait(80);
    finishOpen();
  }

  async function openEnvelope() {
    if (opened) return;
    opened = true;
    envelope.disabled = true;
    prefetchInvitationAssets();
    tryUnlockMusic();

    if (reducedMotion) {
      finishOpenInstant();
      return;
    }

    document.body.classList.add("is-opening-envelope");
    await runGateOpen();
  }

  envelope.addEventListener("click", openEnvelope);
  envelope.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEnvelope();
    }
  });

  initMusic();
  bindMusicUnlockGestures();

  /* ——— Preview modes ——— */
  if (previewSection) {
    opened = true;
    envelope.disabled = true;
    scene.remove();
    invitation.hidden = false;
    invitation.classList.add("is-revealed");
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-preview");
    invitation.querySelectorAll(".section, .footer").forEach((el) => {
      el.classList.add("reveal", "is-visible");
    });
    document.body.classList.add(`preview-${previewSection}`);
    const hero = invitation.querySelector(".hero");
    if (hero) hero.style.display = "none";
    invitation.querySelectorAll(".section, .footer").forEach((el) => {
      const keep =
        (previewSection === "details" &&
          (el.classList.contains("details") || el.classList.contains("story"))) ||
        (previewSection === "rsvp" && el.classList.contains("rsvp")) ||
        (previewSection === "portrait" && el.classList.contains("portrait"));
      if (!keep) el.style.display = "none";
    });
  } else if (previewEnvelope) {
    document.body.classList.add("is-preview-envelope");
  } else if (previewParam !== null) {
    opened = true;
    envelope.disabled = true;
    scene.remove();
    invitation.hidden = false;
    invitation.classList.add("is-revealed");
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-preview");
    invitation.querySelectorAll(".section, .footer").forEach((el) => {
      el.classList.add("reveal", "is-visible");
    });
  }

  function toggleGuestsField() {
    const attending = form.querySelector('input[name="attendance"]:checked')?.value === "si";
    guestsField.hidden = !attending;
    guestsField.querySelector("input").disabled = !attending;
  }

  function toggleAllergiesField({ focusDetails = false } = {}) {
    const hasAllergies = form.querySelector('input[name="allergies"]:checked')?.value === "si";
    const details = document.getElementById("allergyDetails");
    if (!allergiesField || !details) return;

    allergiesField.hidden = !hasAllergies;
    details.required = hasAllergies;
    details.removeAttribute("disabled");
    details.readOnly = false;

    if (!hasAllergies) {
      details.value = "";
      return;
    }

    if (focusDetails) {
      requestAnimationFrame(() => {
        details.focus({ preventScroll: true });
      });
    }
  }

  attendanceInputs.forEach((input) => {
    input.addEventListener("change", toggleGuestsField);
  });
  allergyInputs.forEach((input) => {
    input.addEventListener("change", () => toggleAllergiesField({ focusDetails: true }));
  });
  toggleGuestsField();
  toggleAllergiesField();

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  async function sendToGoogleSheet(payload) {
    if (!SHEETS_WEBAPP_URL) {
      throw new Error("SHEETS_URL_MISSING");
    }

    const response = await fetch(SHEETS_WEBAPP_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        if (json.ok === false) throw new Error(json.error || "sheet_error");
      } catch (err) {
        if (err instanceof SyntaxError) {
          if (!response.ok) throw new Error("network_error");
        } else {
          throw err;
        }
      }
    } else if (!response.ok) {
      throw new Error("network_error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const attending = data.get("attendance") === "si";
    const hasAllergies = data.get("allergies") === "si";
    const guests = attending ? String(data.get("guests") || "1") : "";
    const payload = {
      name,
      phone: String(data.get("phone") || "").trim(),
      attendance: attending ? "si" : "no",
      guests,
      allergies: hasAllergies ? "si" : "no",
      allergyDetails: hasAllergies ? String(data.get("allergyDetails") || "").trim() : "",
      message: String(data.get("message") || "").trim(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Invio in corso…";

    try {
      await sendToGoogleSheet(payload);

      try {
        localStorage.setItem(
          "wedding-rsvp",
          JSON.stringify({ ...payload, savedAt: new Date().toISOString() })
        );
      } catch {
        // ignore
      }

      form.hidden = true;
      success.hidden = false;
      successText.textContent = attending
        ? `${name}, la tua partecipazione per ${guests} ${Number(guests) === 1 ? "persona" : "persone"} è stata registrata. Non vediamo l'ora di festeggiare con te.`
        : `${name}, grazie per averci fatto sapere. Ci mancherai, ma terrremo un pensiero speciale per te.`;
    } catch (err) {
      if (err && err.message === "SHEETS_URL_MISSING") {
        showError("Collegamento al foglio non ancora configurato. Riprova tra poco.");
      } else {
        showError("Non siamo riusciti a salvare la risposta. Controlla la connessione e riprova.");
      }
      submitBtn.disabled = false;
      submitBtn.textContent = "Invia partecipazione";
    }
  });

  function observeReveals() {
    const sections = invitation.querySelectorAll(".section, .footer");
    sections.forEach((el) => el.classList.add("reveal"));

    if (!("IntersectionObserver" in window)) {
      sections.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
    );

    sections.forEach((el) => observer.observe(el));
  }
})();
