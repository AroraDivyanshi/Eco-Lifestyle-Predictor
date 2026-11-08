// ---------------------------------------------------------------------------
// app.js - starts the page: icons, navigation, backend status, and data loading.
// ---------------------------------------------------------------------------

(function () {
  const { byId, formatNumber } = Eco.util;

  // ---------- Icons ----------
  function fillIcons() {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = Eco.icon(el.dataset.icon);
    });
  }

  // ---------- Section waves ----------
  function addWaves() {
    document.querySelectorAll("[data-wave-next]").forEach((section) => {
      section.insertAdjacentHTML(
        "beforeend",
        Eco.art.wave(section.dataset.waveNext)
      );
    });
  }

  // ---------- Navigation ----------
  function setupNavigation() {
    const links = byId("nav-links");
    const toggle = byId("menu-toggle");

    const closeMenu = () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      toggle.innerHTML = Eco.icon("menu");
    };

    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");

      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      toggle.innerHTML = Eco.icon(open ? "close" : "menu");
    });

    links.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    document.addEventListener("click", (event) => {
      const nav = document.querySelector(".nav");

      if (nav && !event.composedPath().includes(nav)) {
        closeMenu();
      }
    });

    // Highlight the navigation link for the section near the screen centre.
    const sections = document.querySelectorAll("[data-section]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          links.querySelectorAll("a").forEach((a) => {
            a.classList.toggle(
              "active",
              a.dataset.nav === entry.target.id
            );
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach((section) => observer.observe(section));
  }

  // ---------- Scroll reveal ----------
  function setupReveal() {
    const items = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in-view"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    items.forEach((el) => observer.observe(el));
  }

  // ---------- Backend status ----------
  function setBackendStatus(state, message = "") {
    const pill = byId("api-pill");
    const text = byId("api-pill-text");
    const banner = byId("offline-banner");
    const offlineText = byId("offline-text");

    pill.className = "api-pill";

    if (state === "connecting") {
      text.textContent = "Connecting...";
      banner.hidden = true;
    } else if (state === "retrying") {
      text.textContent = "Waking backend...";
      banner.hidden = true;
    } else if (state === "online") {
      pill.classList.add("online");
      text.textContent = "Backend online";
      banner.hidden = true;
    } else if (state === "offline") {
      pill.classList.add("offline");
      text.textContent = "Backend unavailable";
      banner.hidden = false;

      offlineText.textContent = message ||
        "The hosted backend is temporarily unavailable or still waking up. " +
        "Please try the connection again shortly. You do not need to start " +
        "the backend on your own computer.";
    }
  }

  // Listen for connection updates emitted by api.js.
  function setupBackendStatusListener() {
    window.addEventListener("eco:backend-status", (event) => {
      const { state } = event.detail || {};

      if (["connecting", "retrying", "online", "offline"].includes(state)) {
        setBackendStatus(state);
      }
    });
  }

  let healthCheckPromise = null;

  async function checkHealth() {
    // Prevent multiple health checks from running simultaneously.
    if (healthCheckPromise) return healthCheckPromise;

    const retryButton = byId("retry-health");
    retryButton.disabled = true;

    healthCheckPromise = (async () => {
      try {
        const health = await Eco.api.getHealth();
        const ready = health.status === "ok";

        if (ready) {
          setBackendStatus("online");
          return true;
        }

        setBackendStatus(
          "offline",
          "The hosted backend responded, but it reports that one or more " +
          "required project files are missing. The deployment may need attention."
        );

        return false;
      } catch (error) {
        setBackendStatus(
          "offline",
          "The hosted backend could not be reached after the automatic retry. " +
          "This can happen while the free hosting service is waking up. " +
          "Please try again shortly. You do not need to run anything locally."
        );

        return false;
      } finally {
        retryButton.disabled = false;
        healthCheckPromise = null;
      }
    })();

    return healthCheckPromise;
  }

  // ---------- Update homepage statistics ----------
  function updateStats(analytics, insights) {
    if (analytics) {
      byId("stat-records").textContent =
        formatNumber(analytics.overview.rows);

      byId("stat-features").textContent =
        analytics.overview.model_features;

      byId("stat-classes").textContent =
        analytics.class_distribution.length;

      document.querySelectorAll('[data-bind="rows"]').forEach((el) => {
        el.textContent = formatNumber(analytics.overview.rows);
      });

      document.querySelectorAll('[data-bind="features"]').forEach((el) => {
        el.textContent = analytics.overview.model_features;
      });
    }

    if (insights) {
      const real = Object.keys(insights.cross_validation.results)
        .filter((name) => !name.startsWith("Dummy"));

      byId("stat-models").textContent = real.length;
      byId("stat-models-sub").textContent =
        `${real.join(", ")} + a baseline`;

      document.querySelectorAll('[data-bind="test_rows"]').forEach((el) => {
        el.textContent = `${insights.split.test_rows} rows`;
      });
    }
  }

  // ---------- Load backend-dependent sections ----------
  let dataSectionsStarted = false;

  async function loadDataSections() {
    if (dataSectionsStarted) return;

    dataSectionsStarted = true;

    // Load sequentially to avoid sending several requests to a sleeping server
    // at the same time.
    try {
      await Eco.analytics.load();
    } catch (error) {
      console.error("Analytics loading failed:", error);
    }

    try {
      await Eco.insights.load();
    } catch (error) {
      console.error("Model insights loading failed:", error);
    }
  }

  // ---------- Application startup ----------
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

    setupBackendStatusListener();

    // Update homepage statistics whenever analytics or insights data changes.
    Eco.onDataChanged = () => {
      const analytics = Eco.analytics.getData();

      updateStats(analytics, Eco.insights.getData());

      if (analytics) {
        Eco.assessment.setDatasetHints(analytics.numeric_summaries);
      }
    };

    // Retry button: check the backend and load data if the connection succeeds.
    byId("retry-health").addEventListener("click", async () => {
      const ready = await checkHealth();

      if (ready) {
        await loadDataSections();
      }
    });

    // First check the backend. Only load the data sections once it is ready.
    const ready = await checkHealth();

    if (ready) {
      await loadDataSections();
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();