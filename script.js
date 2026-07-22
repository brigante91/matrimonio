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

  const ANIM_VARIANTS = ["classic", "cinematic", "light", "romantic", "3d-cinema"];
  const PREVIEW_SECTIONS = ["details", "rsvp", "portrait"];

  const params = new URLSearchParams(window.location.search);
  const animParam = params.get("anim");
  const anim = ANIM_VARIANTS.includes(animParam) ? animParam : "classic";
  const debugMode = params.has("debug");
  const previewParam = params.get("preview");
  const previewSection = PREVIEW_SECTIONS.includes(previewParam) ? previewParam : null;
  const previewEnvelope = previewParam !== null && !previewSection;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = document.getElementById("envelopeScene");
  const envelope = document.getElementById("envelope");
  const stage = document.getElementById("envelopeStage");
  const animDebug = document.getElementById("animDebug");
  const invitation = document.getElementById("invitation");
  const form = document.getElementById("rsvpForm");
  const success = document.getElementById("rsvpSuccess");
  const successText = document.getElementById("rsvpSuccessText");
  const guestsField = document.getElementById("guestsField");
  const attendanceInputs = form.querySelectorAll('input[name="attendance"]');
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
  const MUSIC_VOLUME = isTouch ? 0.035 : 0.07;
  const MUSIC_PREF_KEY = "wedding-music-on";

  document.body.classList.add(`anim-${anim}`);

  /* ——— Debug switcher (?debug=1) ——— */
  if (debugMode && animDebug) {
    animDebug.hidden = false;
    animDebug.querySelectorAll(".anim-debug__btn").forEach((btn) => {
      if (btn.dataset.anim === anim) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.searchParams.set("anim", btn.dataset.anim);
        url.searchParams.set("debug", "1");
        window.location.href = url.toString();
      });
    });
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

  function fadeInVolume() {
    if (!bgMusic) return;
    const start = performance.now();
    const duration = 1800;

    const step = (now) => {
      if (!bgMusic || bgMusic.paused) return;
      const t = Math.min(1, (now - start) / duration);
      bgMusic.volume = MUSIC_VOLUME * t;
      syncMusicToggle();
      if (t < 1) musicFadeFrame = requestAnimationFrame(step);
      else {
        bgMusic.volume = MUSIC_VOLUME;
        syncMusicToggle();
      }
    };

    if (musicFadeFrame) cancelAnimationFrame(musicFadeFrame);
    musicFadeFrame = requestAnimationFrame(step);
  }

  async function tryUnlockMusic() {
    if (!bgMusic || reducedMotion || musicPausedByUser) return false;
    if (isMusicAudible()) return true;

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

  async function primeMusic() {
    if (!bgMusic || musicStarted) return;

    try {
      bgMusic.muted = true;
      bgMusic.volume = 0;
      await bgMusic.play();
      musicStarted = true;
      if (musicToggle) musicToggle.hidden = false;
      syncMusicToggle();
    } catch {
      musicStarted = false;
    }
  }

  async function initMusic() {
    if (!bgMusic) return;
    if (musicToggle) musicToggle.hidden = false;

    if (reducedMotion) {
      syncMusicToggle();
      return;
    }

    const returning = localStorage.getItem(MUSIC_PREF_KEY) === "1";
    if (returning && (await tryUnlockMusic())) return;
    if (await tryUnlockMusic()) return;

    await primeMusic();
  }

  function bindMusicUnlockGestures() {
    const unlockFromGesture = () => {
      if (musicPausedByUser || isMusicAudible()) return;
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
    musicToggle.setAttribute(
      "aria-label",
      playing ? "Metti in pausa la musica" : "Attiva la musica"
    );
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

  /* ——— Cinematic 3D tilt (desktop only) ——— */
  if (anim === "cinematic" && !isTouch && stage && envelope) {
    envelope.addEventListener("mousemove", (event) => {
      if (opened) return;
      const rect = envelope.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const max =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--anim-tilt-max")
        ) || 6;
      stage.style.transform = `rotateY(${x * max * 2}deg) rotateX(${-y * max * 2}deg)`;
    });

    envelope.addEventListener("mouseleave", () => {
      if (!opened) stage.style.transform = "";
    });
  }

  function revealInvitation(zoom = false) {
    invitation.hidden = false;
    void invitation.offsetWidth;
    invitation.classList.add(zoom ? "is-revealed-zoom" : "is-revealed");
  }

  function finishOpen() {
    document.body.classList.remove("is-locked", "is-opening-envelope");
    scene.remove();
    observeReveals();
  }

  function finishOpenInstant() {
    invitation.hidden = false;
    invitation.classList.add("is-revealed");
    document.body.classList.remove("is-locked", "is-opening-envelope");
    scene.remove();
    observeReveals();
  }

  /* ——— Variant orchestration ——— */
  async function runClassic() {
    scene.classList.add("is-flap-opening");
    await wait(parseMs("--anim-classic-crossfade"));
    revealInvitation();
    scene.classList.add("is-leaving");
    await wait(parseMs("--anim-classic-leave"));
    finishOpen();
  }

  async function runLight() {
    scene.classList.add("is-seal-breaking");
    await wait(parseMs("--anim-seal-break"));
    scene.classList.add("is-flap-opening");
    await wait(parseMs("--anim-flap-open"));
    revealInvitation();
    scene.classList.add("is-leaving");
    await wait(parseMs("--anim-light-leave"));
    finishOpen();
  }

  async function runCinematic() {
    scene.classList.add("is-seal-breaking");
    await wait(parseMs("--anim-seal-break"));
    scene.classList.add("is-flap-opening");
    await wait(parseMs("--anim-flap-open"));
    scene.classList.add("is-letter-rising");
    await wait(parseMs("--anim-letter-rise") + parseMs("--anim-letter-pause"));
    revealInvitation(true);
    scene.classList.add("is-zooming");
    await wait(parseMs("--anim-scene-zoom"));
    finishOpen();
  }

  async function run3DCinema() {
    scene.classList.add("is-seal-breaking");
    await wait(parseMs("--anim-seal-break"));
    scene.classList.add("is-flap-opening");
    await wait(parseMs("--anim-flap-open"));
    scene.classList.add("is-letter-rising");
    await wait(parseMs("--anim-letter-rise") + parseMs("--anim-letter-pause"));
    revealInvitation(true);
    scene.classList.add("is-zooming");
    await wait(parseMs("--anim-scene-zoom"));
    finishOpen();
  }

  async function runRomantic() {
    scene.classList.add("is-blooming", "is-flap-opening");
    await wait(parseMs("--anim-romantic-flap"));
    scene.classList.add("is-flashing");
    revealInvitation();
    scene.classList.add("is-leaving");
    await wait(parseMs("--anim-romantic-leave"));
    finishOpen();
  }

  async function openEnvelope() {
    if (opened) return;
    await tryUnlockMusic();
    opened = true;
    envelope.disabled = true;

    if (reducedMotion) {
      finishOpenInstant();
      return;
    }

    document.body.classList.add("is-opening-envelope");

    if (anim === "cinematic") await runCinematic();
    else if (anim === "3d-cinema") await run3DCinema();
    else if (anim === "light") await runLight();
    else if (anim === "romantic") await runRomantic();
    else await runClassic();
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

  attendanceInputs.forEach((input) => {
    input.addEventListener("change", toggleGuestsField);
  });
  toggleGuestsField();

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
    const guests = attending ? String(data.get("guests") || "1") : "";
    const payload = {
      name,
      email: String(data.get("email") || "").trim(),
      attendance: attending ? "si" : "no",
      guests,
      menu: String(data.get("menu") || ""),
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
