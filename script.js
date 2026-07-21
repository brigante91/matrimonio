(() => {
  const scene = document.getElementById("envelopeScene");
  const envelope = document.getElementById("envelope");
  const invitation = document.getElementById("invitation");
  const form = document.getElementById("rsvpForm");
  const success = document.getElementById("rsvpSuccess");
  const successText = document.getElementById("rsvpSuccessText");
  const guestsField = document.getElementById("guestsField");
  const attendanceInputs = form.querySelectorAll('input[name="attendance"]');

  let opened = false;
  const previewParam = new URLSearchParams(window.location.search).get("preview");
  const previewOpen = previewParam !== null;

  document.body.classList.add("is-locked");

  function openEnvelope() {
    if (opened) return;
    opened = true;

    envelope.disabled = true;
    scene.classList.add("is-opening");

    // Timeline: soft open → fade to invitation
    window.setTimeout(() => {
      scene.classList.add("is-leaving");
      invitation.hidden = false;
      document.body.classList.remove("is-locked");

      window.setTimeout(() => {
        scene.remove();
        observeReveals();
      }, 1150);
    }, 2100);
  }

  envelope.addEventListener("click", openEnvelope);
  envelope.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEnvelope();
    }
  });

  if (previewOpen) {
    // Instant open for screenshots / anteprima (?preview or ?preview=details|rsvp)
    opened = true;
    envelope.disabled = true;
    scene.remove();
    invitation.hidden = false;
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-preview");
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

    // Persist locally so refreshed page can still show confirmation intent
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
