(() => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
  }

  const bar = document.querySelector(".sticky-cta");
  if (!bar) return;
  bar.hidden = false;
  const footer = document.querySelector(".site-footer");
  if (!footer || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    ([entry]) => {
      bar.classList.toggle("is-away", entry.isIntersecting);
    },
    { threshold: 0.08 },
  );
  io.observe(footer);
})();
