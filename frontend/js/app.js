// ---------------------------------------------------------------------------
// app.js - starts the page: icons, navigation, backend status, and loading the data sections.
// ---------------------------------------------------------------------------
(function () {
  const { byId, formatNumber } = Eco.util;

  // Replace <span data-icon="leaf"></span> placeholders with real SVG icons
  function fillIcons() {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = Eco.icon(el.dataset.icon);
    });
  }

  // Add wavy dividers at the bottom of sections that declare data-wave-next="<colour of next section>"
  function addWaves() {
    document.querySelectorAll("[data-wave-next]").forEach((section) => {
      section.insertAdjacentHTML("beforeend", Eco.art.wave(section.dataset.waveNext));
    });
  }

  // ---------- Navigation ----------
  function setupNavigation() {
    const links = byId("nav-links");
    const toggle = byId("menu-toggle");
    const closeMenu = () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = Eco.icon("menu");
    };
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      toggle.innerHTML = Eco.icon(open ? "close" : "menu");
    });
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
    // Click outside the navigation closes the menu. composedPath() lists the elements that were clicked
    // at the moment of the click (event.target may already be replaced when the toggle swaps its icon).
    document.addEventListener("click", (event) => {
      if (!event.composedPath().includes(document.querySelector(".nav"))) closeMenu();
    });

    // Highlight the link of the section that is currently in the middle of the screen
    const sections = document.querySelectorAll("[data-section]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.nav === entry.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((section) => observer.observe(section));
  }

  // Fade-in on scroll for elements with class "reveal"
  function setupReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in-view")); return; }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("in-view"); observer.unobserve(entry.target); } });
    }, { threshold: 0.08 });
    items.forEach((el) => observer.observe(el));
  }

  // ---------- Backend status ----------
  async function checkHealth() {
    const pill = byId("api-pill"), text = byId("api-pill-text"), banner = byId("offline-banner");
    pill.className = "api-pill";
    text.textContent = "Checking backend...";
    try {
      const health = await Eco.api.getHealth();
      const ready = health.status === "ok";
      pill.classList.add(ready ? "online" : "offline");
      text.textContent = ready ? "Backend online" : "Backend needs setup";
      banner.hidden = ready;
      if (!ready) byId("offline-text").innerHTML = "The backend is running but some files are missing. Create the model with <code>python -m backend.train_model</code>.";
      return true;
    } catch (error) {
      pill.classList.add("offline");
      text.textContent = "Backend offline";
      banner.hidden = false;
      byId("offline-text").innerHTML = `Cannot reach the backend at <code>${Eco.util.escapeHtml(Eco.api.baseUrl())}</code>. Start it with <code>uvicorn backend.app:app --reload</code> from the project folder.`;
      return false;
    }
  }

  // ---------- Fill the numbers on the home page and methodology from real API data ----------
  function updateStats(analytics, insights) {
    if (analytics) {
      byId("stat-records").textContent = formatNumber(analytics.overview.rows);
      byId("stat-features").textContent = analytics.overview.model_features;
      byId("stat-classes").textContent = analytics.class_distribution.length;
      document.querySelectorAll('[data-bind="rows"]').forEach((el) => { el.textContent = formatNumber(analytics.overview.rows); });
      document.querySelectorAll('[data-bind="features"]').forEach((el) => { el.textContent = analytics.overview.model_features; });
    }
    if (insights) {
      const real = Object.keys(insights.cross_validation.results).filter((name) => !name.startsWith("Dummy"));
      byId("stat-models").textContent = real.length;
      byId("stat-models-sub").textContent = `${real.join(", ")} + a baseline`;
      document.querySelectorAll('[data-bind="test_rows"]').forEach((el) => { el.textContent = `${insights.split.test_rows} rows`; });
    }
  }

  async function boot() {
    fillIcons();
    byId("hero-art").innerHTML = Eco.art.hero();
    addWaves();
    byId("footer-api").textContent = Eco.api.baseUrl();
    Eco.charts.setupTooltip();
    setupNavigation();
    setupReveal();
    Eco.insights.bindToggles();
    Eco.assessment.init();
    byId("retry-health").addEventListener("click", checkHealth);

    // Called by the analytics and insights loaders whenever new data arrives (also after a "Try again")
    Eco.onDataChanged = () => {
      const analytics = Eco.analytics.getData();
      updateStats(analytics, Eco.insights.getData());
      if (analytics) Eco.assessment.setDatasetHints(analytics.numeric_summaries);
    };

    // Start all requests together; each section shows its own loading and error state
    checkHealth();
    Eco.analytics.load();
    Eco.insights.load();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
