/* NOVA CUT — interactions & scroll choreography (zero dependencies) */
(function () {
  "use strict";
  window.__novaReady = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---- Hero intro ---- */
  const hero = $("#hero");
  if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("play")));

  /* ---- Nav scrolled state ---- */
  const nav = $("#nav");
  const onScrollNav = () => { if (nav) nav.classList.toggle("scrolled", window.scrollY > 40); };
  onScrollNav();

  /* ---- Mobile menu ---- */
  const toggle = $("#navToggle");
  const menu = $("#mobileMenu");
  if (toggle && menu) {
    const close = () => { toggle.classList.remove("open"); menu.classList.remove("open"); document.body.classList.remove("no-scroll"); };
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
      document.body.classList.toggle("no-scroll", open);
    });
    $$("a", menu).forEach((a) => a.addEventListener("click", close));
  }

  /* ---- Reveal on scroll (rAF-driven: robust to fast/fling scrolling) ---- */
  let pending = $$(".reveal, .reveal-fade, .reveal-line, .reveal-clip");
  if (reduce) { pending.forEach((el) => el.classList.add("is-visible")); pending = []; }
  function checkReveals() {
    if (!pending.length) return;
    const trigger = window.innerHeight * 0.9;
    pending = pending.filter((el) => {
      if (el.getBoundingClientRect().top < trigger) { el.classList.add("is-visible"); return false; }
      return true;
    });
  }

  /* ---- Parallax (hero + figures) ---- */
  const heroImg = $("#heroImg");
  const figs = $$("[data-parallax]").map((img) => ({
    img,
    fig: img.closest(".parallax-fig") || img.parentElement,
    amt: parseFloat(img.dataset.parallax) || 0.12,
  }));

  /* ---- Berber kartları: mobilde odağa gelen kart parlasın ----
     Masaüstünde bunu :hover yapıyor. Dokunmatikte hover yok, o yüzden
     kart ekranın ortasına yaklaştığında aynı görünümü veriyoruz. */
  const dokunmatik = window.matchMedia("(hover: none)").matches;
  const ustalar = (dokunmatik && !reduce) ? $$(".master") : [];

  function odakGuncelle(vh) {
    for (const el of ustalar) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) { el.classList.remove("odakta"); continue; }
      const kartMerkezi = r.top + r.height / 2;
      // Ekran ortasına yakınsa parlat. Bant biraz geniş ki kaydırırken
      // kart uzun süre yanık kalsın, göz kırpması gibi olmasın.
      el.classList.toggle("odakta", Math.abs(kartMerkezi - vh / 2) < vh * 0.34);
    }
  }

  let ticking = false;
  function frame() {
    const vh = window.innerHeight;
    checkReveals();
    odakGuncelle(vh);
    if (heroImg) {
      const y = Math.min(window.scrollY, vh);
      heroImg.style.transform = "translate3d(0," + (y * 0.16) + "px,0) scale(1.02)";
    }
    for (const f of figs) {
      const r = f.fig.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      const progress = (r.top + r.height / 2 - vh / 2) / vh; // ~ -1..1
      const shift = -progress * f.fig.offsetHeight * f.amt;
      f.img.style.transform = "translateY(-50%) translate3d(0," + shift.toFixed(1) + "px,0)";
    }
    ticking = false;
  }
  function requestFrame() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  window.addEventListener("scroll", () => { onScrollNav(); if (!reduce) requestFrame(); }, { passive: true });
  window.addEventListener("resize", () => { if (!reduce) requestFrame(); }, { passive: true });
  window.addEventListener("load", () => { if (!reduce) frame(); }, { passive: true });
  if (!reduce) frame();

  /* ---- Smooth anchor scroll with nav offset ---- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      const top = t.getBoundingClientRect().top + window.scrollY - 74;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    });
  });
})();
