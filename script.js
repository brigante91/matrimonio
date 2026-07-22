(() => {
  const SHEETS_WEBAPP_URL =
    "https://script.google.com/macros/s/AKfycbz3qm09G5z8cJtcPNmRQ_ZNO1H2H07xWgSW7c2spHNxVYtjVhcyAgPLa2IQUmfoQXE-/exec";

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
  const petalsEl = document.getElementById("envelopePetals");
  const animDebug = document.getElementById("animDebug");
  const invitation = document.getElementById("invitation");
  const form = document.getElementById("rsvpForm");
  const success = document.getElementById("rsvpSuccess");
  const successText = document.getElementById("rsvpSuccessText");
  const guestsField = document.getElementById("guestsField");
  const attendanceInputs = form.querySelectorAll('input[name="attendance"]');
  const bgMusic = document.getElementById("bgMusic");
  const musicToggle = document.getElementById("musicToggle");
  const submitBtn = document.getElementById("rsvpSubmit");
  const errorEl = document.getElementById("rsvpError");
  const countdownEl = document.getElementById("countdown");

  let opened = false;
  let musicStarted = false;
  let petalInterval = null;
  const MUSIC_VOLUME = 0.22;
  const WEDDING_AT = new Date("2027-07-14T12:00:00+02:00").getTime();
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

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

  function fadeInMusic() {
    if (!bgMusic || musicStarted) return;
    musicStarted = true;
    bgMusic.volume = 0;
    const playPromise = bgMusic.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        musicStarted = false;
      });
    }
    musicToggle.hidden = false;
    updateMusicToggle();

    const start = performance.now();
    const duration = 1800;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      bgMusic.volume = MUSIC_VOLUME * t;
      if (t < 1 && !bgMusic.paused) requestAnimationFrame(step);
      else if (!bgMusic.paused) bgMusic.volume = MUSIC_VOLUME;
    };
    requestAnimationFrame(step);
  }

  function updateMusicToggle() {
    const muted = bgMusic.paused || bgMusic.muted || bgMusic.volume === 0;
    musicToggle.classList.toggle("is-muted", muted);
    musicToggle.setAttribute("aria-pressed", muted ? "false" : "true");
    musicToggle.setAttribute(
      "aria-label",
      muted ? "Attiva la musica" : "Disattiva la musica"
    );
  }

  musicToggle.addEventListener("click", () => {
    if (bgMusic.paused) {
      bgMusic.muted = false;
      bgMusic.volume = MUSIC_VOLUME;
      bgMusic.play().catch(() => {});
      musicStarted = true;
      musicToggle.hidden = false;
    } else {
      bgMusic.pause();
    }
    updateMusicToggle();
  });

  /* ——— Petals (SVG inline) ——— */
  function createPetal() {
    if (!petalsEl) return;
    const petal = document.createElement("span");
    petal.className = "envelope-petal";
    petal.innerHTML =
      '<svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true"><ellipse cx="5.5" cy="6.5" rx="4.5" ry="5.5" fill="#fffaf5" opacity="0.92"/><ellipse cx="5.5" cy="6.5" rx="2.8" ry="3.5" fill="#f3e6dc"/></svg>';
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.setProperty("--petal-drift", `${(Math.random() - 0.5) * 140}px`);
    petal.style.setProperty("--petal-spin", `${(Math.random() - 0.5) * 420}deg`);
    petal.style.animationDuration = `${5.5 + Math.random() * 4.5}s`;
    petal.style.animationDelay = `${Math.random() * 1.5}s`;
    petalsEl.appendChild(petal);
    petal.addEventListener("animationend", () => petal.remove());
  }

  function startPetals(rateMs = 700) {
    if (!petalsEl || reducedMotion) return;
    for (let i = 0; i < 3; i += 1) createPetal();
    if (petalInterval) clearInterval(petalInterval);
    petalInterval = window.setInterval(createPetal, rateMs);
  }

  function stopPetals() {
    if (petalInterval) {
      clearInterval(petalInterval);
      petalInterval = null;
    }
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
    stopPetals();
    scene.remove();
    observeReveals();
  }

  function finishOpenInstant() {
    invitation.hidden = false;
    invitation.classList.add("is-revealed");
    document.body.classList.remove("is-locked", "is-opening-envelope");
    stopPetals();
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
    startPetals(550);
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

  /* Musica: parte al caricamento; se il browser blocca l'autoplay, al primo tap */
  fadeInMusic();
  document.addEventListener(
    "pointerdown",
    () => {
      if (!musicStarted) fadeInMusic();
    },
    { once: true, passive: true }
  );

  /* Romantic idle petal snowfall */
  if (anim === "romantic" && !previewSection && !reducedMotion) {
    startPetals(950);
  }

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
    if (anim === "romantic" && !reducedMotion) startPetals(950);
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
