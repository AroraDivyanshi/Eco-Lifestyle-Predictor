// ---------------------------------------------------------------------------
// analytics.js - the "Data Analytics" section. All numbers come from GET /analytics.
// ---------------------------------------------------------------------------
window.Eco = window.Eco || {};

Eco.analytics = (function () {
  const { byId, escapeHtml, prettyFeature, formatNumber, classColor, colors } = Eco.util;
  const CLASS_ORDER = ["Low", "Medium", "High"];
  let data = null;
  let selectedFeature = "TransportationMode";

  const chartIds = ["chart-rating", "chart-class", "chart-lifestyle", "chart-energy", "chart-diet",
                    "chart-disposal", "chart-electricity", "chart-water", "chart-corr", "obs-list"];

  async function load() {
    chartIds.forEach((id) => Eco.ui.loading(byId(id), id === "obs-list" ? 260 : 220));
    byId("quality-strip").innerHTML = "";
    try {
      data = await Eco.api.getAnalytics();
    } catch (error) {
      Eco.ui.errorAll(chartIds.map(byId), error.message, load);
      return null;
    }
    render();
    return data;
  }

  function render() {
    renderRating();
    renderLifestyle();
    renderCategoryCharts();
    renderHistograms();
    renderCorrelation();
    renderObservations();
    renderQuality();
  }

  // 1. Rating distribution (1-5) and the Low/Medium/High target classes
  function renderRating() {
    const ratingColors = ["#e5775a", "#f6bb9a", "#f4cb4d", "#9db99a", "#4f9a70"];
    const bars = data.rating_distribution.map((item, i) => ({
      label: String(item.rating), value: item.count, color: ratingColors[i], valueLabel: String(item.count),
      tip: `Rating ${item.rating}: ${item.count} participants (${item.percent}%)`
    }));
    Eco.charts.mount(byId("chart-rating"), (w) => Eco.charts.columnChart(w, { data: bars, xTitle: "Original rating (1 = lowest, 5 = highest)", yTitle: "Participants", ariaLabel: "Number of participants for each rating from 1 to 5" }));
    const donutData = data.class_distribution.map((item) => ({ label: item.class, value: item.count, color: classColor(item.class) }));
    Eco.charts.mount(byId("chart-class"), (w) => Eco.charts.donut(w, { data: donutData, centerLabel: "participants", ariaLabel: "Share of Low, Medium and High rating classes" }));
  }

  // Build stacked-bar rows (class share per category) for one lifestyle feature
  function shareRows(feature) {
    return data.class_share_by_category[feature].map((row) => ({
      label: row.value, n: row.rows,
      segments: CLASS_ORDER.map((name) => ({ name, value: row[name], color: classColor(name) }))
    }));
  }

  function classLegend() {
    return `<div class="legend">${CLASS_ORDER.map((n) => `<span><i style="background:${classColor(n)}"></i>${n}</span>`).join("")}<span style="margin-left:auto">Share of each group in each rating class</span></div>`;
  }

  // 2. Lifestyle choice vs rating class (pill selector, Transportation first)
  function renderLifestyle() {
    const pills = byId("pills-lifestyle");
    const features = Object.keys(data.class_share_by_category);
    pills.innerHTML = features.map((f) => `<button type="button" class="pill ${f === selectedFeature ? "active" : ""}" data-feature="${f}">${escapeHtml(prettyFeature(f))}</button>`).join("");
    pills.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      selectedFeature = button.dataset.feature;
      renderLifestyle();
    }));
    byId("lifestyle-title").textContent = `${prettyFeature(selectedFeature)} vs rating class`;
    const holder = byId("chart-lifestyle");
    holder.innerHTML = '<div class="chart-inner"></div>' + classLegend();
    Eco.charts.mount(holder.querySelector(".chart-inner"), (w) => Eco.charts.stackedBars(w, { rows: shareRows(selectedFeature), ariaLabel: `Rating class shares for each ${prettyFeature(selectedFeature)} option` }));
  }

  // 3. Energy source donut, diet and waste-disposal patterns
  function renderCategoryCharts() {
    const energy = data.categorical_distributions.EnergySource.map((item, i) => ({ label: item.value, value: item.count, color: Eco.util.cycle[[0, 3, 1][i % 3]] }));
    Eco.charts.mount(byId("chart-energy"), (w) => Eco.charts.donut(w, { data: energy, centerLabel: "households", ariaLabel: "Distribution of household energy sources" }));
    ["DietType", "DisposalMethods"].forEach((feature) => {
      const holder = byId(feature === "DietType" ? "chart-diet" : "chart-disposal");
      holder.innerHTML = '<div class="chart-inner"></div>' + classLegend();
      Eco.charts.mount(holder.querySelector(".chart-inner"), (w) => Eco.charts.stackedBars(w, { rows: shareRows(feature), ariaLabel: `Rating class shares for each ${prettyFeature(feature)} option` }));
    });
  }

  // 4. Electricity and water histograms with the dataset median / 75th percentile
  function renderHistograms() {
    const t = data.recommendation_thresholds;
    const specs = [
      { id: "chart-electricity", feature: "MonthlyElectricityConsumption", color: "#f4cb4d", median: t.electricity_median, p75: t.electricity_p75, unit: "kWh per month" },
      { id: "chart-water", feature: "MonthlyWaterConsumption", color: "#b3a4dc", median: t.water_median, p75: t.water_p75, unit: "litres per month" }
    ];
    specs.forEach((spec) => {
      const hist = data.numeric_histograms[spec.feature];
      Eco.charts.mount(byId(spec.id), (w) => Eco.charts.histogram(w, {
        edges: hist.bin_edges, counts: hist.counts, color: spec.color, xTitle: spec.unit,
        markers: [{ x: spec.median, label: `Median ${formatNumber(spec.median)}`, color: "#245a43" }, { x: spec.p75, label: `75th pct ${formatNumber(spec.p75)}`, color: "#b9482c" }],
        ariaLabel: `Distribution of ${prettyFeature(spec.feature)}`
      }));
    });
  }

  // 5. Correlation heatmap: negative = peach/coral, zero = ivory, positive = forest green
  function mixColor(from, to, amount) {
    const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const a = parse(from), b = parse(to);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("");
  }
  function correlationColor(value) {
    return value >= 0 ? mixColor("#fbf7ee", "#2f6f54", Math.min(value, 1)) : mixColor("#fbf7ee", "#e5775a", Math.min(-value, 1));
  }
  function renderCorrelation() {
    const corr = data.correlations;
    const labels = corr.labels.map((name) => Eco.util.shortLabels[name] || name);
    Eco.charts.mount(byId("chart-corr"), (w) => Eco.charts.heatmap(w, {
      rows: labels, cols: labels, matrix: corr.matrix, maxCell: 74,
      colorFor: (v) => correlationColor(v),
      textFor: (v) => v.toFixed(2),
      tipFor: (v, r, c) => `${labels[r]} and ${labels[c]}: Pearson r = ${v.toFixed(3)}`,
      ariaLabel: "Correlation heatmap of the numerical features and the rating"
    }));
  }

  // 6. Observations: written from the actual numbers (association only, never cause and effect)
  function renderObservations() {
    const items = [];
    const classShare = (feature, value) => data.class_share_by_category[feature].find((row) => row.value === value);
    const overall = Object.fromEntries(data.class_distribution.map((row) => [row.class, row.percent]));
    const rows = data.overview.rows;

    const biggest = data.class_distribution.reduce((a, b) => (b.count > a.count ? b : a));
    items.push(`<b>${biggest.class}</b> is the largest rating class: ${biggest.count} of ${rows} participants (${biggest.percent}%). The classes are imbalanced, which is why the model is judged with macro scores.`);

    // For a feature, find the category with the highest Low share and the one with the highest High share
    [["TransportationMode", "transport mode"], ["EnergySource", "energy source"], ["DisposalMethods", "disposal method"]].forEach(([feature, nice]) => {
      const list = data.class_share_by_category[feature];
      const mostLow = list.reduce((a, b) => (b.Low > a.Low ? b : a));
      const mostHigh = list.reduce((a, b) => (b.High > a.High ? b : a));
      items.push(`By ${nice}: <b>${escapeHtml(mostLow.value)}</b> has the highest Low share (${mostLow.Low}% of ${mostLow.rows}, vs ${overall.Low}% overall) and <b>${escapeHtml(mostHigh.value)}</b> the highest High share (${mostHigh.High}% of ${mostHigh.rows}, vs ${overall.High}% overall).`);
    });

    const corr = data.correlations;
    const ratingRow = corr.matrix[corr.labels.indexOf("Rating")];
    const pairs = corr.labels.map((name, i) => ({ name, r: ratingRow[i] })).filter((p) => p.name !== "Rating");
    const strongestPositive = pairs.reduce((a, b) => (b.r > a.r ? b : a));
    const strongestNegative = pairs.reduce((a, b) => (b.r < a.r ? b : a));
    items.push(`Among the numerical features, <b>${prettyFeature(strongestPositive.name).toLowerCase()}</b> has the strongest positive correlation with the rating (r = ${strongestPositive.r.toFixed(2)}) and <b>${prettyFeature(strongestNegative.name).toLowerCase()}</b> the strongest negative one (r = ${strongestNegative.r.toFixed(2)}).`);

    const q = data.data_quality;
    items.push(`${q.extra_repeated_rows} rows repeat an earlier row's 17 lifestyle answers (${q.repeated_profile_groups} repeated profiles), so scores can look slightly better than for completely new people.`);

    byId("obs-list").innerHTML = `<ul class="obs-list">${items.map((text) => `<li>${Eco.icon("sprout")}<span>${text}</span></li>`).join("")}</ul>
      <p class="note">${Eco.icon("info")}<span>These describe patterns in this dataset only. Association is not cause and effect.</span></p>`;
  }

  // 7. Data-quality strip
  function renderQuality() {
    const q = data.data_quality;
    const items = [
      [q.exact_duplicate_rows, "Exact duplicate rows"],
      [q.repeated_profile_groups, "Repeated lifestyle profiles"],
      [q.extra_repeated_rows, "Extra repeated rows"],
      [q.repeated_profiles_with_conflicting_ratings, "Repeats with conflicting ratings"]
    ];
    byId("quality-strip").innerHTML = items.map(([value, label]) => `<div class="quality-item"><b>${formatNumber(value)}</b><span>${label}</span></div>`).join("");
  }

  return { load, getData: () => data };
})();
