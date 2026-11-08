// ---------------------------------------------------------------------------
// insights.js - the "ML Insights" section. All numbers come from GET /model-insights
// (results saved by backend/train_model.py).
// ---------------------------------------------------------------------------
window.Eco = window.Eco || {};

Eco.insights = (function () {
  const { byId, escapeHtml, prettyFeature, classColor } = Eco.util;
  let data = null;
  let matrixMode = "counts";          // "counts" or "percent"
  let importanceMode = "model";       // "model", "permutation" or "encoded"

  const containerIds = ["model-banner", "metric-tiles", "chart-cv", "chart-confusion", "chart-importance", "report-table", "regression-box", "insight-notes"];

  async function load() {
    containerIds.forEach((id) => Eco.ui.loading(byId(id), id === "metric-tiles" ? 110 : 220));
    try {
      data = await Eco.api.getModelInsights();
    } catch (error) {
      Eco.ui.errorAll(containerIds.map(byId), error.message, load);
      return null;
    }
    render();
    return data;
  }

  function render() {
    renderBanner();
    renderTiles();
    renderModelComparison();
    renderConfusion();
    renderImportance();
    renderReport();
    renderRegression();
    renderNotes();
  }

  const fmt = (value, digits = 3) => Number(value).toFixed(digits);

  function renderBanner() {
    const m = data.model, s = data.split;
    const params = Object.entries(m.best_params).map(([k, v]) => `<code>${escapeHtml(k.replace("model__", ""))} = ${v === null ? "None" : escapeHtml(v)}</code>`).join(" ");
    byId("model-banner").innerHTML = `
      <span class="badge badge-green">${Eco.icon("check")} Selected model</span>
      <strong>${escapeHtml(m.name)}</strong>
      <span>Tuned settings: ${params}</span>
      <span>5-fold CV macro F1: <b>${fmt(m.best_cv_macro_f1)}</b></span>
      <span>Evaluated on <b>${s.test_rows}</b> held-out rows (trained on ${s.train_rows}). The saved deployment model is refitted on all <b>${m.deployment_trained_on_rows}</b> rows.</span>`;
  }

  function renderTiles() {
    const test = data.evaluation.test_metrics, dummy = data.evaluation.dummy_baseline_test;
    const tiles = [
      ["Test accuracy", test.accuracy, dummy.accuracy, "tone-peach"],
      ["Macro F1", test.macro_f1, dummy.macro_f1, "tone-lavender"],
      ["Macro precision", test.macro_precision, dummy.macro_precision, "tone-sun"],
      ["Macro recall", test.macro_recall, dummy.macro_recall, "tone-sage"]
    ];
    byId("metric-tiles").innerHTML = `<div class="metric-tiles" style="margin-bottom:0">${tiles.map(([label, value, base, tone]) =>
      `<div class="metric-tile ${tone}"><div class="label">${label}</div><div class="value">${fmt(value)}</div><div class="sub">Dummy baseline: ${fmt(base)}</div></div>`).join("")}</div>`;
  }

  // Model comparison: cross-validation on the training data, mean with +/- 1 standard deviation
  function renderModelComparison() {
    const results = data.cross_validation.results;
    const groups = Object.keys(results);
    const series = [
      { name: "Accuracy", key: "accuracy", color: "#2f6f54" },
      { name: "Macro precision", key: "precision_macro", color: "#f6bb9a" },
      { name: "Macro recall", key: "recall_macro", color: "#9583c8" },
      { name: "Macro F1", key: "f1_macro", color: "#f4cb4d" }
    ].map((item) => ({ ...item, values: groups.map((g) => results[g][item.key].mean), errors: groups.map((g) => results[g][item.key].std) }));
    const holder = byId("chart-cv");
    holder.innerHTML = '<div class="chart-inner"></div>' +
      `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join("")}</div>`;
    Eco.charts.mount(holder.querySelector(".chart-inner"), (w) => Eco.charts.groupedBars(w, { groups, series, ariaLabel: "Cross-validation scores of each candidate model" }));
    byId("cv-note").textContent = `${data.cross_validation.folds}-fold stratified cross-validation on the training split only (error bars = one standard deviation across folds). The test set was not used for this comparison.`;
  }

  // Confusion matrix: rows = actual class, columns = predicted class; shading shows each row's share
  function renderConfusion() {
    const cm = data.confusion_matrix;
    const rowTotals = cm.matrix.map((row) => row.reduce((a, b) => a + b, 0));
    const holder = byId("chart-confusion");
    holder.innerHTML = `<div class="chart-inner"></div><p class="note">${Eco.icon("info")}<span>${escapeHtml(cm.note)} Shading shows the share of each actual class.</span></p>`;
    Eco.charts.mount(holder.querySelector(".chart-inner"), (w) => Eco.charts.heatmap(w, {
      rows: cm.labels, cols: cm.labels, matrix: cm.matrix, maxCell: 100, rowTitle: "Actual", colTitle: "Predicted",
      colorFor: (value, r, c) => {
        const share = rowTotals[r] ? value / rowTotals[r] : 0;
        const base = r === c ? [79, 154, 112] : [229, 119, 90];
        const mix = (channel, from) => Math.round(from + (channel - from) * Math.min(share * (r === c ? 1 : 1.6), 1));
        return `rgb(${mix(base[0], 251)},${mix(base[1], 247)},${mix(base[2], 238)})`;
      },
      textFor: (value, r) => matrixMode === "counts" ? `${value}\n${rowTotals[r] ? ((value / rowTotals[r]) * 100).toFixed(0) : 0}%` : `${rowTotals[r] ? ((value / rowTotals[r]) * 100).toFixed(0) : 0}%\n${value}`,
      tipFor: (value, r, c) => `Actual ${cm.labels[r]}, predicted ${cm.labels[c]}: ${value} participants (${rowTotals[r] ? ((value / rowTotals[r]) * 100).toFixed(1) : 0}% of actual ${cm.labels[r]})`,
      ariaLabel: "Confusion matrix on the test set"
    }));
  }

  // Feature importance with three views
  function renderImportance() {
    const fi = data.feature_importance;
    const views = {
      model: { title: "Model-based importance (share of total)", rows: fi.model_based_per_feature.map((d) => ({ label: prettyFeature(d.feature), value: d.importance_share * 100, color: "#2f6f54", tip: `${prettyFeature(d.feature)}: ${(d.importance_share * 100).toFixed(1)}% of the model's total importance` })), format: (v) => `${v.toFixed(0)}%` },
      permutation: { title: "Permutation importance on the test set (drop in macro F1 when the feature is shuffled)", rows: fi.permutation_on_test.map((d) => ({ label: prettyFeature(d.feature), value: d.mean_f1_drop, error: d.std, color: d.mean_f1_drop > 0 ? "#9583c8" : "#e5775a", tip: `${prettyFeature(d.feature)}: macro F1 drops by ${d.mean_f1_drop.toFixed(3)} (+/- ${d.std.toFixed(3)}) when shuffled` })), format: (v) => v.toFixed(2) },
      encoded: { title: "Top 10 individual (one-hot) features", rows: fi.model_based_top10_encoded.map((d) => ({ label: prettyFeature(d.feature).replace(/_/g, ": "), value: d.importance * 100, color: "#f4cb4d", tip: `${d.feature}: ${(d.importance * 100).toFixed(1)}% importance` })), format: (v) => `${v.toFixed(0)}%` }
    };
    const view = views[importanceMode];
    const holder = byId("chart-importance");
    holder.innerHTML = `<p class="card-sub" style="margin:0 0 8px">${view.title}</p><div class="chart-inner"></div><p class="note">${Eco.icon("info")}<span>${escapeHtml(fi.notes)}</span></p>`;
    Eco.charts.mount(holder.querySelector(".chart-inner"), (w) => Eco.charts.horizontalBars(w, { data: view.rows, valueFormat: view.format, ariaLabel: view.title }));
  }

  function renderReport() {
    const report = data.evaluation.classification_report;
    const row = (label, r, cls = "") => `<tr class="${cls}"><td>${label}</td><td>${r.precision.toFixed(3)}</td><td>${r.recall.toFixed(3)}</td><td>${r["f1-score"].toFixed(3)}</td><td>${r.support}</td></tr>`;
    const classRows = ["Low", "Medium", "High"].map((name) => row(`<span class="badge" style="background:${classColor(name)}33;color:#1f2d26">${name}</span>`, report[name])).join("");
    byId("report-table").innerHTML = `<div class="scroll-x"><table class="report">
      <thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr></thead>
      <tbody>${classRows}${row("Macro average", report["macro avg"], "sum")}${row("Weighted average", report["weighted avg"], "sum")}
      <tr class="sum"><td>Accuracy</td><td></td><td></td><td>${Number(report.accuracy).toFixed(3)}</td><td>${report["macro avg"].support}</td></tr></tbody></table></div>`;
  }

  function renderRegression() {
    const reg = data.supplementary_regression;
    const model = reg.linear_regression_test, base = reg.mean_predictor_baseline_test;
    const item = (label, value, baseValue) => `<div class="reg-item"><b>${value.toFixed(3)}</b><span>${label}</span><small>Mean-predictor baseline: ${baseValue.toFixed(3)}</small></div>`;
    byId("regression-box").innerHTML = `<div class="regression-grid">${item("RMSE", model.rmse, base.rmse)}${item("MAE", model.mae, base.mae)}${item("R²", model.r2, base.r2)}</div>
      <p class="note">${Eco.icon("info")}<span>${escapeHtml(reg.note)}</span></p>`;
  }

  function renderNotes() {
    byId("insight-notes").innerHTML = `<ul class="notes-list">${data.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`;
  }

  // Toggle buttons
  function bindToggles() {
    document.querySelectorAll("[data-matrix-mode]").forEach((button) => button.addEventListener("click", () => {
      matrixMode = button.dataset.matrixMode;
      document.querySelectorAll("[data-matrix-mode]").forEach((b) => b.classList.toggle("active", b === button));
      if (data) renderConfusion();
    }));
    document.querySelectorAll("[data-importance-mode]").forEach((button) => button.addEventListener("click", () => {
      importanceMode = button.dataset.importanceMode;
      document.querySelectorAll("[data-importance-mode]").forEach((b) => b.classList.toggle("active", b === button));
      if (data) renderImportance();
    }));
  }

  return { load, bindToggles, getData: () => data };
})();
