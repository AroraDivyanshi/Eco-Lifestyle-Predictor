// Small helper functions shared by all the other scripts.
// Everything is attached to one global object called Eco so the files can talk to each other.
window.Eco = window.Eco || {};

Eco.util = {
  // Shorthand for document.getElementById
  byId(id) { return document.getElementById(id); },

  // Escape text before putting it into HTML (protects against accidentally injecting markup)
  escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  },

  // "TransportationMode" -> "Transportation mode", "MonthlyElectricityConsumption" -> "Monthly electricity consumption"
  prettyFeature(name) {
    const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  },

  // Short labels for the correlation heatmap
  shortLabels: {
    Age: "Age", HomeSize: "Home size", EnvironmentalAwareness: "Awareness",
    MonthlyElectricityConsumption: "Electricity", MonthlyWaterConsumption: "Water", Rating: "Rating"
  },

  formatNumber(value, digits = 0) {
    return Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  },

  percent(value, digits = 1) { return `${Number(value).toFixed(digits)}%`; },

  // Colours used by the charts (kept in one place so every chart matches the page theme)
  colors: {
    forest: "#2f6f54", sage: "#9db99a", peach: "#f6bb9a", coral: "#e5775a", lavender: "#d4caee",
    lilac: "#9583c8", sun: "#f4cb4d", lime: "#c8e38a", ink: "#1f2d26",
    classLow: "#e5775a", classMedium: "#f4cb4d", classHigh: "#4f9a70"
  },
  cycle: ["#2f6f54", "#f6bb9a", "#9583c8", "#f4cb4d", "#9db99a", "#e5775a", "#d4caee", "#c8e38a"],
  classColor(name) {
    return { Low: "#e5775a", Medium: "#f4cb4d", High: "#4f9a70" }[name] || "#9db99a";
  },

  // Insert an element into the page's tooltip system (see charts.js) by giving it a data-tip attribute
  tip(text) { return `data-tip="${Eco.util.escapeHtml(text)}"`; }
};

// ---------------------------------------------------------------------------
// UI states: loading skeleton, error box with a retry button, and empty state.
// ---------------------------------------------------------------------------
Eco.ui = {
  loading(container, height = 200) {
    container.innerHTML = `<div class="skeleton" style="min-height:${height}px" role="status" aria-label="Loading"></div>`;
  },

  error(container, message, onRetry) {
    container.innerHTML = `
      <div class="state-box" role="alert">
        <div class="icon-circle">${Eco.icon("alert")}</div>
        <p><strong>Could not load this section.</strong><br>${Eco.util.escapeHtml(message)}</p>
        ${onRetry ? `<button type="button" class="btn btn-soft btn-small">${Eco.icon("refresh")} Try again</button>` : ""}
      </div>`;
    if (onRetry) container.querySelector("button").addEventListener("click", onRetry);
  },

  // Render the same message into several containers (used when one request feeds many charts)
  errorAll(containers, message, onRetry) {
    containers.forEach((container, index) => Eco.ui.error(container, message, index === 0 ? onRetry : null));
  }
};
