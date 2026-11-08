// Icons (Lucide-style line icons drawn as inline SVG) and custom illustrations.
window.Eco = window.Eco || {};

Eco.iconPaths = {
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  walk: '<circle cx="13" cy="4" r="1.5"/><path d="m9 20 3-6 2 2v4"/><path d="m6 12 3-3 4 1 2 3 3 1"/><path d="m12 14-1.5-4"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  recycle: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 3v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
};

// Returns an inline SVG string for an icon, e.g. Eco.icon("leaf", "icon")
Eco.icon = function (name, cssClass = "icon") {
  const paths = Eco.iconPaths[name] || Eco.iconPaths.leaf;
  return `<svg class="${cssClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
};

// ---------------------------------------------------------------------------------------------
// Custom illustrations (drawn by hand as SVG; they are decoration, not data)
// ---------------------------------------------------------------------------------------------
Eco.art = {
  // Hero landscape: sun, hills, wind turbine, house with solar roof, tree, recycling badge, floating leaves
  hero() {
    return `
<svg viewBox="0 0 560 480" role="img" aria-label="Illustration of green hills with a wind turbine, a house with solar panels, a tree and a recycling symbol">
  <path d="M70 250C52 120 170 36 292 50c128 14 214 92 210 200-4 112-96 196-226 200C160 454 90 372 70 250Z" fill="#fde2d0"/>
  <circle cx="420" cy="118" r="70" fill="#f4cb4d" opacity=".22"/>
  <circle cx="420" cy="118" r="46" fill="#f4cb4d"/>
  <g stroke="#f4cb4d" stroke-width="5" stroke-linecap="round" opacity=".8">
    <path d="M420 44v-14"/><path d="M420 206v14"/><path d="M346 118h-14"/><path d="M494 118h14"/>
    <path d="m368 66-10-10"/><path d="m472 170 10 10"/><path d="m472 66 10-10"/><path d="m368 170-10 10"/>
  </g>
  <path d="M0 330C90 262 176 276 266 318c82 38 176-52 294-8V480H0Z" fill="#d4caee"/>
  <path d="M0 372c96-44 196-24 288 0 100 26 180-30 272-10V480H0Z" fill="#a9c8a0"/>
  <path d="M0 428c120-34 240-8 332 4 96 12 168-14 228-4V480H0Z" fill="#2f6f54"/>
  <!-- wind turbine -->
  <polygon points="117,372 123,372 122,236 118,236"
           fill="#fffdf8" stroke="#e7e0cf" stroke-width="1.5"/>

  <g class="turbine-blades">

    <!-- Blade 1: Top -->
    <path d="M120 232 L115 160 Q120 150 125 160 Z"
          fill="#fffdf8" stroke="#e7e0cf" stroke-width="1.5"/>

    <!-- Blade 2: Right -->
    <path d="M120 232 L115 160 Q120 150 125 160 Z"
          fill="#fffdf8" stroke="#e7e0cf" stroke-width="1.5"
          transform="rotate(90 120 232)"/>

    <!-- Blade 3: Bottom -->
    <path d="M120 232 L115 160 Q120 150 125 160 Z"
          fill="#fffdf8" stroke="#e7e0cf" stroke-width="1.5"
          transform="rotate(180 120 232)"/>

    <!-- Blade 4: Left -->
    <path d="M120 232 L115 160 Q120 150 125 160 Z"
          fill="#fffdf8" stroke="#e7e0cf" stroke-width="1.5"
          transform="rotate(270 120 232)"/>

  </g>

  <!-- Central hub -->
  <circle cx="120" cy="232" r="6" fill="#f6bb9a"/>
  <!-- house with solar roof -->
  <rect x="268" y="338" width="96" height="64" rx="4" fill="#fffdf8"/>
  <polygon points="258,342 316,292 374,342" fill="#9583c8"/>
  <g fill="#6c5aa6" opacity=".75"><rect x="292" y="316" width="14" height="10" rx="1.5"/><rect x="310" y="316" width="14" height="10" rx="1.5"/><rect x="301" y="304" width="14" height="10" rx="1.5"/></g>
  <rect x="304" y="364" width="24" height="38" rx="4" fill="#f6bb9a"/>
  <rect x="276" y="352" width="18" height="18" rx="3" fill="#fbe6a0"/>
  <rect x="338" y="352" width="18" height="18" rx="3" fill="#fbe6a0"/>
  <!-- tree -->
  <rect x="446" y="352" width="12" height="62" rx="5" fill="#8a6a4f"/>
  <circle cx="452" cy="330" r="42" fill="#5f9c74"/>
  <circle cx="430" cy="344" r="28" fill="#8fbd86"/>
  <circle cx="476" cy="342" r="30" fill="#c8e38a"/>
  <circle cx="452" cy="308" r="24" fill="#a6cf8c"/>
  <!-- recycling badge -->
   <!-- recycling badge -->
  <g transform="translate(86 118)">
    <!-- Outer badge -->
    <circle r="38" fill="#f6bb9a"/>
    <circle r="31" fill="#fff0e5"/>

    <!-- Arrowhead definition -->
    <defs>
      <marker
        id="recycle-arrowhead"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="12"
        markerHeight="12"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M1 1 L9 5 L1 9"
          fill="none"
          stroke="#b9482c"
          stroke-width="3.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </marker>
    </defs>

    <!-- Three evenly spaced circular arrows -->
    <g
      fill="none"
      stroke="#b9482c"
      stroke-width="4.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <!-- First arrow -->
      <path
        d="M-13 -7.5 A15 15 0 0 1 7.5 -13"
        marker-end="url(#recycle-arrowhead)"
      />

      <!-- Second arrow -->
      <path
        d="M13 -7.5 A15 15 0 0 1 7.5 13"
        marker-end="url(#recycle-arrowhead)"
      />

      <!-- Third arrow -->
      <path
        d="M0 15 A15 15 0 0 1 -15 0"
        marker-end="url(#recycle-arrowhead)"
      />
    </g>
  </g>
  <!-- sprouts -->
  <g fill="#c8e38a" stroke="#1b4733" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M200 450v-24" fill="none"/><path d="M200 436c-14 0-20-10-20-20 14 0 20 8 20 20Z"/><path d="M200 430c12 0 18-10 18-18-12 0-18 8-18 18Z"/>
    <path d="M520 452v-20" fill="none"/><path d="M520 442c-12 0-18-8-18-18 12 0 18 8 18 18Z"/><path d="M520 436c10 0 16-8 16-16-10 0-16 6-16 16Z"/>
  </g>
  <!-- floating leaves -->
  <path class="float-leaf" d="M230 150c18-4 34 8 34 26-18 4-34-8-34-26Z" fill="#c8e38a"/>
  <path class="float-leaf slow" d="M330 78c14-2 26 8 26 22-14 2-26-8-26-22Z" fill="#9583c8" opacity=".85"/>
  <path class="float-leaf" d="M180 70c10-2 20 6 20 16-10 2-20-6-20-16Z" fill="#f4cb4d"/>
</svg>`;
  },

  // Seedling in a pot, used for empty states
  seedling() {
    return `
<svg viewBox="0 0 200 180" width="170" role="img" aria-label="Seedling in a pot">
  <ellipse cx="100" cy="162" rx="62" ry="9" fill="#ebe5f8"/>
  <path d="M62 112h76l-9 46a8 8 0 0 1-8 6H79a8 8 0 0 1-8-6Z" fill="#f6bb9a"/>
  <rect x="56" y="104" width="88" height="14" rx="7" fill="#e5775a"/>
  <path d="M100 104V66" stroke="#2f6f54" stroke-width="5" stroke-linecap="round"/>
  <path d="M100 82C78 82 64 68 64 48c22 0 36 14 36 34Z" fill="#9db99a" stroke="#1b4733" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M100 72c20 0 34-12 34-30-20 0-34 12-34 30Z" fill="#c8e38a" stroke="#1b4733" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="150" cy="40" r="10" fill="#f4cb4d"/><circle cx="46" cy="76" r="6" fill="#d4caee"/>
</svg>`;
  },

  // Growth stage for a predicted class: Low = sprout, Medium = young plant, High = full tree (a visual metaphor only)
  growth(className) {
    const trunk = '<rect x="72" y="86" width="10" height="46" rx="4" fill="#8a6a4f"/>';
    const ground = '<ellipse cx="77" cy="136" rx="52" ry="8" fill="rgba(31,45,38,.12)"/>';
    if (className === "High") {
      return `<svg class="result-art" viewBox="0 0 154 150" role="img" aria-label="A full tree, representing the High category">${ground}${trunk}
        <circle cx="77" cy="64" r="40" fill="#4f9a70"/><circle cx="52" cy="78" r="26" fill="#8fbd86"/><circle cx="104" cy="76" r="28" fill="#c8e38a"/><circle cx="78" cy="42" r="24" fill="#a6cf8c"/>
        <circle cx="108" cy="30" r="9" fill="#f4cb4d"/></svg>`;
    }
    if (className === "Medium") {
      return `<svg class="result-art" viewBox="0 0 154 150" role="img" aria-label="A young plant, representing the Medium category">${ground}
        <rect x="74" y="78" width="7" height="56" rx="3" fill="#2f6f54"/>
        <path d="M77 100C52 100 40 84 40 64c24 0 37 14 37 36Z" fill="#9db99a" stroke="#1b4733" stroke-width="3" stroke-linejoin="round"/>
        <path d="M78 88c24 0 38-12 38-32-24 0-38 12-38 32Z" fill="#c8e38a" stroke="#1b4733" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="116" cy="30" r="9" fill="#f4cb4d"/></svg>`;
    }
    return `<svg class="result-art" viewBox="0 0 154 150" role="img" aria-label="A small sprout, representing the Low category">${ground}
      <rect x="75" y="100" width="5" height="34" rx="2.5" fill="#2f6f54"/>
      <path d="M77 108c-18 0-28-10-28-24 18 0 28 10 28 24Z" fill="#c8e38a" stroke="#1b4733" stroke-width="3" stroke-linejoin="round"/>
      <path d="M78 104c16 0 26-9 26-22-16 0-26 9-26 22Z" fill="#9db99a" stroke="#1b4733" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="116" cy="34" r="9" fill="#f4cb4d"/></svg>`;
  },

  // Wavy section divider; the colour is taken from the next section's background
  wave(color) {
    return `<svg class="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30C180 62 360 0 540 22s360 40 540 12 260-22 360 0V60H0Z" fill="${color}"/></svg>`;
  }
};
