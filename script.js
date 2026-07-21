(() => {
  const scene = document.getElementById("envelopeScene");
  const envelope = document.getElementById("envelope");
  const invitation = document.getElementById("invitation");
  const form = document.getElementById("rsvpForm");
  const success = document.getElementById("rsvpSuccess");
  const successText = document.getElementById("rsvpSuccessText");
  const guestsField = document.getElementById("guestsField");
  const attendanceInputs = form.querySelectorAll('input[name="attendance"]');
  const bgMusic = document.getElementById("bgMusic");
  const musicToggle = document.getElementById("musicToggle");

  let opened = false;
  let musicStarted = false;
  const previewParam = new URLSearchParams(window.location.search).get("preview");
  const previewOpen = previewParam !== null;
  const OPEN_MS = 1500;
  const MUSIC_VOLUME = 0.35;

  document.body.classList.add("is-locked");

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

  function openEnvelope() {
    if (opened) return;
    opened = true;

    envelope.disabled = true;
    document.body.classList.add("is-opening-envelope");
    fadeInMusic();

    // Reveal invitation under the dissolving fullscreen envelope
    invitation.hidden = false;
    // Force layout so the reveal transition can run
    void invitation.offsetWidth;
    invitation.classList.add("is-revealed");
    scene.classList.add("is-opening");

    window.setTimeout(() => {
      document.body.classList.remove("is-locked", "is-opening-envelope");
      scene.remove();
      observeReveals();
    }, OPEN_MS);
  }

  envelope.addEventListener("click", openEnvelope);
  envelope.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEnvelope();
    }
  });

  if (previewOpen) {
    opened = true;
    envelope.disabled = true;
    scene.remove();
    invitation.hidden = false;
    invitation.classList.add("is-revealed");
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-preview");
    fadeInMusic();
    invitation.querySelectorAll(".section, .footer").forEach((el) => {
      el.classList.add("reveal", "is-visible");
    });

    if (previewParam === "details" || previewParam === "rsvp" || previewParam === "portrait") {
      document.body.classList.add(`preview-${previewParam}`);
      const hero = invitation.querySelector(".hero");
      if (hero) hero.style.display = "none";
      invitation.querySelectorAll(".section, .footer").forEach((el) => {
        const keep =
          (previewParam === "details" && (el.classList.contains("details") || el.classList.contains("story"))) ||
          (previewParam === "rsvp" && el.classList.contains("rsvp")) ||
          (previewParam === "portrait" && el.classList.contains("portrait"));
        if (!keep) el.style.display = "none";
      });
    }
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const attending = data.get("attendance") === "si";
    const guests = data.get("guests") || "1";

    form.hidden = true;
    success.hidden = false;

    successText.textContent = attending
      ? `${name}, la tua partecipazione per ${guests} ${Number(guests) === 1 ? "persona" : "persone"} è stata registrata. Non vediamo l'ora di festeggiare con te.`
      : `${name}, grazie per averci fatto sapere. Ci mancherai, ma terrremo un pensiero speciale per te.`;

    try {
      localStorage.setItem(
        "wedding-rsvp",
        JSON.stringify({
          name,
          email: data.get("email"),
          attendance: data.get("attendance"),
          guests: attending ? guests : null,
          menu: data.get("menu"),
          message: data.get("message"),
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // ignore storage errors
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
