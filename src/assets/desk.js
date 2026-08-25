(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
  }

  const reveals = document.querySelectorAll("[data-reveal]");
  if (reduce) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
    window.setTimeout(() => reveals.forEach((el) => el.classList.add("is-in")), 2500);
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  const ats = document.querySelector("[data-ats]");
  if (ats) {
    const setPos = (pos) => {
      ats.dataset.pos = pos;
      ats.style.setProperty("--throw", pos);
    };
    document.querySelectorAll("[data-throw]").forEach((el) => {
      const apply = () => setPos(el.getAttribute("data-throw"));
      el.addEventListener("mouseenter", apply);
      el.addEventListener("focusin", apply);
    });
  }

  const house = document.querySelector("[data-house]");
  if (house && "IntersectionObserver" in window && !reduce) {
    const beats = document.querySelectorAll("[data-beat]");
    const houseIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            house.dataset.phase = entry.target.getAttribute("data-beat");
          }
        });
      },
      { threshold: 0.55 }
    );
    beats.forEach((el) => houseIo.observe(el));
  }

  const form = document.querySelector("[data-circuit-form]");
  const out = document.querySelector("[data-circuit-out]");
  if (form && out) {
    const copy = {
      essentials: {
        href: "/portable-power-stations/",
        label: "Portable power stations",
        text: "Fridge, CPAP, and Wi-Fi is a station job. Start in silo 3, then add portable panels if the outage outlasts the pack.",
      },
      partial: {
        href: "/home-batteries/",
        label: "Home batteries",
        text: "Selected circuits and some 240 V wants an expandable kit and a legal inlet — silo 2, not a Powerwall quote.",
      },
      whole: {
        href: "/whole-house-generators/",
        label: "Whole-house generators",
        text: "HVAC, well, and a whole panel is a pad plant with a transfer switch. Install cost will dominate.",
      },
    };
    form.addEventListener("change", (event) => {
      const value = event.target.value;
      const pick = copy[value];
      if (!pick) return;
      out.hidden = false;
      out.innerHTML = `<p>${pick.text}</p><p><a class="cta" href="${pick.href}">Open ${pick.label}</a></p>`;
    });
  }
})();
