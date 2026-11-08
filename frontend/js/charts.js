// ---------------------------------------------------------------------------
// charts.js - small chart library written with plain SVG (no external dependency, works offline).
// Each chart function returns an <svg> element for a given pixel width, and Eco.charts.mount()
// redraws it whenever its container is resized, so text stays readable on phones.
// ---------------------------------------------------------------------------
window.Eco = window.Eco || {};

Eco.charts = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const C = () => Eco.util.colors;

  // Create an SVG element with attributes: svg("rect", {x: 0, y: 0, ...})
  function svg(tag, attrs = {}, text) {
    const el = document.createElementNS(NS, tag);
    for (const key in attrs) {
      if (attrs[key] !== undefined && attrs[key] !== null) el.setAttribute(key, attrs[key]);
    }
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function root(width, height, label) {
    return svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label });
  }

  // Round an axis maximum up to a "nice" number (e.g. 273 -> 300)
  function niceMax(value) {
    if (value <= 0) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const scaled = value / power;
    const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
    return nice * power;
  }

  function addTip(el, text) { el.setAttribute("data-tip", text); }

  // ---------- Mounting and resizing ----------
  // renderFn(width) must return an SVG (or any DOM node). It is called again when the container width changes.
  function mount(container, renderFn) {
    container.innerHTML = "";
    let lastWidth = 0;
    const draw = () => {
      const width = Math.floor(container.clientWidth);
      if (width < 40 || Math.abs(width - lastWidth) < 2) return;
      lastWidth = width;
      container.innerHTML = "";
      container.appendChild(renderFn(width));
    };
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(container);
    else window.addEventListener("resize", draw);
  }

  // ---------- Vertical bar chart ----------
  // data: [{label, value, color, tip}]
  function columnChart(width, o) {
    const height = o.height || 260;
    const m = { top: 22, right: 12, bottom: 46, left: 46 };
    const w = width - m.left - m.right, h = height - m.top - m.bottom;
    const max = niceMax(o.yMax || Math.max(...o.data.map((d) => d.value)) * 1.08);
    const s = root(width, height, o.ariaLabel || "Bar chart");
    for (let i = 0; i <= 4; i++) {
      const y = m.top + h - (h * i) / 4;
      s.appendChild(svg("line", { x1: m.left, x2: width - m.right, y1: y, y2: y, class: i === 0 ? "axis-line" : "grid-line" }));
      s.appendChild(svg("text", { x: m.left - 8, y: y + 4, "text-anchor": "end", class: "chart-text small" }, Eco.util.formatNumber((max * i) / 4)));
    }
    const slot = w / o.data.length, barWidth = Math.min(slot * 0.62, 70);
    o.data.forEach((d, i) => {
      const barHeight = Math.max((d.value / max) * h, d.value > 0 ? 2 : 0);
      const x = m.left + slot * i + (slot - barWidth) / 2, y = m.top + h - barHeight;
      const rect = svg("rect", { x, y, width: barWidth, height: barHeight, rx: 8, fill: d.color || C().forest, class: "bar", style: `animation-delay:${i * 60}ms` });
      addTip(rect, d.tip || `${d.label}: ${Eco.util.formatNumber(d.value)}`);
      s.appendChild(rect);
      if (o.showValues !== false) s.appendChild(svg("text", { x: x + barWidth / 2, y: y - 7, "text-anchor": "middle", class: "chart-text strong" }, d.valueLabel || Eco.util.formatNumber(d.value)));
      s.appendChild(svg("text", { x: x + barWidth / 2, y: height - m.bottom + 20, "text-anchor": "middle", class: "chart-text" }, d.label));
    });
    if (o.xTitle) s.appendChild(svg("text", { x: m.left + w / 2, y: height - 4, "text-anchor": "middle", class: "chart-text small" }, o.xTitle));
    if (o.yTitle) s.appendChild(svg("text", { transform: `translate(12 ${m.top + h / 2}) rotate(-90)`, "text-anchor": "middle", class: "chart-text small" }, o.yTitle));
    return s;
  }

  // ---------- Histogram ----------
  // o: {edges, counts, color, markers: [{x, label, color}], xTitle}
  function histogram(width, o) {
    const height = o.height || 270;
    const m = { top: 40, right: 14, bottom: 46, left: 44 };
    const w = width - m.left - m.right, h = height - m.top - m.bottom;
    const min = o.edges[0], maxX = o.edges[o.edges.length - 1];
    const max = niceMax(Math.max(...o.counts) * 1.05);
    const xOf = (value) => m.left + ((value - min) / (maxX - min)) * w;
    const s = root(width, height, o.ariaLabel || "Histogram");
    for (let i = 0; i <= 4; i++) {
      const y = m.top + h - (h * i) / 4;
      s.appendChild(svg("line", { x1: m.left, x2: width - m.right, y1: y, y2: y, class: i === 0 ? "axis-line" : "grid-line" }));
      s.appendChild(svg("text", { x: m.left - 8, y: y + 4, "text-anchor": "end", class: "chart-text small" }, Eco.util.formatNumber((max * i) / 4)));
    }
    o.counts.forEach((count, i) => {
      const x0 = xOf(o.edges[i]), x1 = xOf(o.edges[i + 1]);
      const barHeight = (count / max) * h;
      const rect = svg("rect", { x: x0 + 1, y: m.top + h - barHeight, width: Math.max(x1 - x0 - 2, 1), height: barHeight, rx: 4, fill: o.color, class: "bar", style: `animation-delay:${i * 25}ms` });
      addTip(rect, `${Eco.util.formatNumber(o.edges[i])} to ${Eco.util.formatNumber(o.edges[i + 1])}: ${count} participants`);
      s.appendChild(rect);
    });
    const ticks = width < 420 ? 3 : 5;
    for (let i = 0; i < ticks; i++) {
      const value = min + ((maxX - min) * i) / (ticks - 1);
      s.appendChild(svg("text", { x: xOf(value), y: height - m.bottom + 18, "text-anchor": i === 0 ? "start" : i === ticks - 1 ? "end" : "middle", class: "chart-text small" }, Eco.util.formatNumber(value)));
    }
    (o.markers || []).forEach((marker, i) => {
      const x = xOf(marker.x);
      s.appendChild(svg("line", { x1: x, x2: x, y1: m.top - 6, y2: m.top + h, stroke: marker.color, "stroke-width": 2, "stroke-dasharray": "5 4" }));
      s.appendChild(svg("text", { x, y: m.top - 12 - (i % 2) * 14, "text-anchor": "middle", class: "chart-text small strong", fill: marker.color }, marker.label));
    });
    if (o.xTitle) s.appendChild(svg("text", { x: m.left + w / 2, y: height - 4, "text-anchor": "middle", class: "chart-text small" }, o.xTitle));
    return s;
  }

  // ---------- Horizontal 100% stacked bars ----------
  // rows: [{label, n, segments: [{name, value (percent), color}]}]
  function stackedBars(width, o) {
    const rowHeight = 34, gap = 14, m = { top: 6, right: 8, bottom: 8, left: Math.min(Math.max(width * 0.3, 90), 150) };
    const height = m.top + m.bottom + o.rows.length * (rowHeight + gap);
    const w = width - m.left - m.right;
    const s = root(width, height, o.ariaLabel || "Stacked bar chart");
    o.rows.forEach((row, r) => {
      const y = m.top + r * (rowHeight + gap);
      s.appendChild(svg("text", { x: m.left - 10, y: y + rowHeight / 2 - 2, "text-anchor": "end", class: "chart-text strong" }, row.label));
      s.appendChild(svg("text", { x: m.left - 10, y: y + rowHeight / 2 + 12, "text-anchor": "end", class: "chart-text small" }, `n = ${row.n}`));
      let x = m.left;
      row.segments.forEach((seg, i) => {
        const segWidth = (seg.value / 100) * w;
        if (segWidth <= 0) return;
        const rect = svg("rect", { x, y, width: segWidth, height: rowHeight, fill: seg.color, class: "bar bar-h", style: `animation-delay:${(r * 3 + i) * 50}ms`, rx: 4 });
        addTip(rect, `${row.label} - ${seg.name}: ${seg.value.toFixed(1)}% of ${row.n} participants`);
        s.appendChild(rect);
        if (segWidth > 34) s.appendChild(svg("text", { x: x + segWidth / 2, y: y + rowHeight / 2 + 4, "text-anchor": "middle", class: "chart-text small strong", fill: seg.name === "High" ? "#fff" : "#1f2d26", style: "pointer-events:none" }, `${Math.round(seg.value)}%`));
        x += segWidth;
      });
    });
    return s;
  }

  // ---------- Donut ----------
  // Returns a <div> with the donut SVG and a legend. data: [{label, value, color}]
  function donut(width, o) {
    const size = Math.min(width, 220), radius = size / 2 - 8, inner = radius * 0.6, cx = size / 2, cy = size / 2;
    const total = o.data.reduce((sum, d) => sum + d.value, 0);
    const wrap = document.createElement("div");
    wrap.className = "donut-wrap";
    const s = root(size, size, o.ariaLabel || "Donut chart");
    let angle = -Math.PI / 2;
    o.data.forEach((d) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const a0 = angle, a1 = angle + sweep, large = sweep > Math.PI ? 1 : 0;
      const pt = (rad, a) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
      const path = svg("path", {
        d: sweep >= Math.PI * 2 - 0.001
          ? `M ${pt(radius, 0)} A ${radius} ${radius} 0 1 1 ${pt(radius, Math.PI)} A ${radius} ${radius} 0 1 1 ${pt(radius, 0)} L ${pt(inner, 0)} A ${inner} ${inner} 0 1 0 ${pt(inner, Math.PI)} A ${inner} ${inner} 0 1 0 ${pt(inner, 0)} Z`
          : `M ${pt(radius, a0)} A ${radius} ${radius} 0 ${large} 1 ${pt(radius, a1)} L ${pt(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${pt(inner, a0)} Z`,
        fill: d.color, stroke: "#fff", "stroke-width": 3, class: "slice"
      });
      addTip(path, `${d.label}: ${Eco.util.formatNumber(d.value)} (${((d.value / total) * 100).toFixed(1)}%)`);
      s.appendChild(path);
      angle = a1;
    });
    s.appendChild(svg("text", { x: cx, y: cy - 2, "text-anchor": "middle", class: "chart-text strong", style: "font-size:24px;font-family:var(--font-display)" }, Eco.util.formatNumber(total)));
    s.appendChild(svg("text", { x: cx, y: cy + 16, "text-anchor": "middle", class: "chart-text small" }, o.centerLabel || "total"));
    wrap.appendChild(s);
    const legend = document.createElement("div");
    legend.className = "donut-legend";
    o.data.forEach((d) => {
      const row = document.createElement("div");
      row.innerHTML = `<i style="background:${d.color}"></i><span><b>${Eco.util.escapeHtml(d.label)}</b> &middot; ${Eco.util.formatNumber(d.value)} (${((d.value / total) * 100).toFixed(1)}%)</span>`;
      legend.appendChild(row);
    });
    wrap.appendChild(legend);
    return wrap;
  }

  // ---------- Grouped bars with optional error bars (model comparison) ----------
  // o: {groups: [name], series: [{name, color, values: [..], errors: [..]}], yMax}
  function groupedBars(width, o) {
    const height = o.height || 320;
    const m = { top: 20, right: 12, bottom: 54, left: 44 };
    const w = width - m.left - m.right, h = height - m.top - m.bottom;
    const s = root(width, height, o.ariaLabel || "Grouped bar chart");
    for (let i = 0; i <= 5; i++) {
      const y = m.top + h - (h * i) / 5;
      s.appendChild(svg("line", { x1: m.left, x2: width - m.right, y1: y, y2: y, class: i === 0 ? "axis-line" : "grid-line" }));
      s.appendChild(svg("text", { x: m.left - 8, y: y + 4, "text-anchor": "end", class: "chart-text small" }, (i / 5).toFixed(1)));
    }
    const slot = w / o.groups.length, groupWidth = slot * 0.82, barWidth = groupWidth / o.series.length;
    const wrapNames = width < 520;
    o.groups.forEach((group, g) => {
      const x0 = m.left + slot * g + (slot - groupWidth) / 2;
      o.series.forEach((series, i) => {
        const value = series.values[g], error = (series.errors && series.errors[g]) || 0;
        const barHeight = value * h, x = x0 + barWidth * i, y = m.top + h - barHeight;
        const rect = svg("rect", { x: x + 1.5, y, width: barWidth - 3, height: barHeight, rx: 5, fill: series.color, class: "bar", style: `animation-delay:${(g * 4 + i) * 40}ms` });
        addTip(rect, `${group} - ${series.name}: ${value.toFixed(3)} (+/- ${error.toFixed(3)} across folds)`);
        s.appendChild(rect);
        if (error) {
          const cx = x + barWidth / 2, top = m.top + h - Math.min(value + error, 1) * h, bottom = m.top + h - Math.max(value - error, 0) * h;
          s.appendChild(svg("line", { x1: cx, x2: cx, y1: top, y2: bottom, stroke: "#1f2d26", "stroke-width": 1.4, "pointer-events": "none" }));
          s.appendChild(svg("line", { x1: cx - 3, x2: cx + 3, y1: top, y2: top, stroke: "#1f2d26", "stroke-width": 1.4, "pointer-events": "none" }));
          s.appendChild(svg("line", { x1: cx - 3, x2: cx + 3, y1: bottom, y2: bottom, stroke: "#1f2d26", "stroke-width": 1.4, "pointer-events": "none" }));
        }
      });
      const label = group.replace(" (most frequent)", "");
      const words = wrapNames ? label.split(" ") : [label];
      words.forEach((word, k) => s.appendChild(svg("text", { x: x0 + groupWidth / 2, y: height - m.bottom + 18 + k * 14, "text-anchor": "middle", class: "chart-text strong" }, word)));
    });
    return s;
  }

  // ---------- Horizontal bars with optional error bars (feature importance) ----------
  // o: {data: [{label, value, error, color}], valueFormat}
  function horizontalBars(width, o) {
    const rowHeight = 22, gap = 9;
    const m = { top: 8, right: 16, bottom: 30, left: Math.min(Math.max(width * 0.36, 120), 190) };
    const height = m.top + m.bottom + o.data.length * (rowHeight + gap);
    const w = width - m.left - m.right;
    const lows = o.data.map((d) => d.value - (d.error || 0)), highs = o.data.map((d) => d.value + (d.error || 0));
    const minValue = Math.min(0, ...lows), maxValue = niceMax(Math.max(...highs) * 1.05);
    const xOf = (v) => m.left + ((v - minValue) / (maxValue - minValue)) * w;
    const s = root(width, height, o.ariaLabel || "Horizontal bar chart");
    for (let i = 0; i <= 4; i++) {
      const value = minValue + ((maxValue - minValue) * i) / 4, x = xOf(value);
      s.appendChild(svg("line", { x1: x, x2: x, y1: m.top, y2: height - m.bottom, class: "grid-line" }));
      s.appendChild(svg("text", { x, y: height - m.bottom + 18, "text-anchor": "middle", class: "chart-text small" }, o.valueFormat(value)));
    }
    s.appendChild(svg("line", { x1: xOf(0), x2: xOf(0), y1: m.top, y2: height - m.bottom, class: "axis-line", stroke: "#b9b19c" }));
    o.data.forEach((d, i) => {
      const y = m.top + i * (rowHeight + gap), x0 = xOf(0), x1 = xOf(d.value);
      const rect = svg("rect", { x: Math.min(x0, x1), y, width: Math.max(Math.abs(x1 - x0), 1), height: rowHeight, rx: 6, fill: d.color || Eco.util.colors.forest, class: "bar bar-h", style: `animation-delay:${i * 35}ms` });
      addTip(rect, d.tip || `${d.label}: ${o.valueFormat(d.value)}`);
      s.appendChild(rect);
      s.appendChild(svg("text", { x: m.left - 10, y: y + rowHeight / 2 + 4, "text-anchor": "end", class: "chart-text" }, d.label));
      if (d.error) {
        const ya = y + rowHeight / 2;
        s.appendChild(svg("line", { x1: xOf(d.value - d.error), x2: xOf(d.value + d.error), y1: ya, y2: ya, stroke: "#1f2d26", "stroke-width": 1.4, "pointer-events": "none" }));
        s.appendChild(svg("line", { x1: xOf(d.value + d.error), x2: xOf(d.value + d.error), y1: ya - 4, y2: ya + 4, stroke: "#1f2d26", "stroke-width": 1.4, "pointer-events": "none" }));
      }
    });
    return s;
  }

  // ---------- Heatmap (correlation matrix, confusion matrix) ----------
  // o: {rows: [labels], cols: [labels], matrix: [[numbers]], colorFor(value, rowIndex), textFor(value, r, c), tipFor(value, r, c), rowTitle, colTitle}
  function heatmap(width, o) {
    const m = { top: o.colTitle ? 44 : 30, right: 10, bottom: 12, left: Math.min(Math.max(width * 0.22, 70), 120) };
    const cell = Math.min((width - m.left - m.right) / o.cols.length, o.maxCell || 84);
    const w = cell * o.cols.length, height = m.top + m.bottom + cell * o.rows.length;
    const s = root(width, height, o.ariaLabel || "Heatmap");
    const left = m.left + (width - m.left - m.right - w) / 2;
    o.cols.forEach((label, c) => s.appendChild(svg("text", { x: left + c * cell + cell / 2, y: m.top - 8, "text-anchor": "middle", class: "chart-text small strong" }, label)));
    if (o.colTitle) s.appendChild(svg("text", { x: left + w / 2, y: 14, "text-anchor": "middle", class: "chart-text small" }, o.colTitle));
    o.rows.forEach((label, r) => {
      s.appendChild(svg("text", { x: left - 8, y: m.top + r * cell + cell / 2 + 4, "text-anchor": "end", class: "chart-text small strong" }, label));
      o.cols.forEach((_, c) => {
        const value = o.matrix[r][c];
        const rect = svg("rect", { x: left + c * cell + 2, y: m.top + r * cell + 2, width: cell - 4, height: cell - 4, rx: 10, fill: o.colorFor(value, r, c), class: "cell", "data-value": value, "data-row": r, "data-col": c });
        addTip(rect, o.tipFor ? o.tipFor(value, r, c) : String(value));
        s.appendChild(rect);
        const text = o.textFor(value, r, c);
        const lines = String(text).split("\n");
        lines.forEach((line, k) => s.appendChild(svg("text", { x: left + c * cell + cell / 2, y: m.top + r * cell + cell / 2 + 4 + (k - (lines.length - 1) / 2) * 15, "text-anchor": "middle", class: k === 0 ? "chart-text strong" : "chart-text small", style: "pointer-events:none" }, line)));
      });
    });
    if (o.rowTitle) s.appendChild(svg("text", { transform: `translate(10 ${m.top + (cell * o.rows.length) / 2}) rotate(-90)`, "text-anchor": "middle", class: "chart-text small" }, o.rowTitle));
    return s;
  }

  // ---------- Tooltip (one shared element, driven by data-tip attributes) ----------
  function setupTooltip() {
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.setAttribute("role", "tooltip");
    document.body.appendChild(tooltip);
    const place = (event) => {
      const x = Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 10);
      tooltip.style.left = Math.max(x, 8) + "px";
      tooltip.style.top = Math.min(event.clientY + 16, window.innerHeight - tooltip.offsetHeight - 10) + "px";
    };
    document.addEventListener("mouseover", (event) => {
      const target = event.target.closest && event.target.closest("[data-tip]");
      if (!target) return;
      tooltip.textContent = target.getAttribute("data-tip");
      tooltip.classList.add("show");
      place(event);
    });
    document.addEventListener("mousemove", (event) => { if (tooltip.classList.contains("show")) place(event); });
    document.addEventListener("mouseout", (event) => {
      if (event.target.closest && event.target.closest("[data-tip]")) tooltip.classList.remove("show");
    });
  }

  return { mount, columnChart, histogram, stackedBars, donut, groupedBars, horizontalBars, heatmap, setupTooltip };
})();
