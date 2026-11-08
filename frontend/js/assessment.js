// ---------------------------------------------------------------------------
// assessment.js - the lifestyle form (17 inputs), the call to POST /predict, and the results screen.
// The field names and option values below must match backend/schemas.py exactly.
// ---------------------------------------------------------------------------
window.Eco = window.Eco || {};

Eco.assessment = (function () {
  const { byId, escapeHtml, formatNumber, classColor } = Eco.util;

  // ---- The 17 fields, grouped into four categories ----
  const GROUPS = [
    { id: "about", title: "About you & your home", subtitle: "Who you are and where you live", icon: "home", tone: "t-peach", fields: [
      { name: "Age", type: "number", label: "Age", unit: "years", min: 0, max: 120, integer: true, hint: "Whole years, 0 to 120." },
      { name: "Location", type: "choice", label: "Where do you live?", options: ["Urban", "Suburban", "Rural"] },
      { name: "HomeType", type: "choice", label: "Home type", options: ["House", "Apartment", "Other"] },
      { name: "HomeSize", type: "number", label: "Home size", unit: "sq ft", min: 1, hint: "Floor area in square feet (1 or more)." },
      { name: "EnvironmentalAwareness", type: "scale", label: "How aware are you of environmental issues?", options: [1, 2, 3, 4, 5], lowLabel: "1 = low", highLabel: "5 = high", integer: true }
    ] },
    { id: "energy", title: "Getting around & home energy", subtitle: "Transport, power and water", icon: "zap", tone: "t-sun", fields: [
      { name: "TransportationMode", type: "choice", label: "How do you mostly get around?", options: ["Car", "Public Transit", "Bike", "Walk"], icons: { "Car": "car", "Public Transit": "bus", "Bike": "bike", "Walk": "walk" } },
      { name: "EnergySource", type: "choice", label: "Main home energy source", options: ["Renewable", "Mixed", "Non-Renewable"], icons: { "Renewable": "sun", "Mixed": "layers", "Non-Renewable": "zap" } },
      { name: "MonthlyElectricityConsumption", type: "number", label: "Monthly electricity use", unit: "kWh", min: 0, hint: "Kilowatt-hours per month (0 or more)." },
      { name: "MonthlyWaterConsumption", type: "number", label: "Monthly water use", unit: "litres", min: 0, hint: "Litres per month (0 or more)." }
    ] },
    { id: "food", title: "Food & shopping", subtitle: "What you eat and buy", icon: "utensils", tone: "t-lime", fields: [
      { name: "DietType", type: "choice", label: "Your diet", options: ["Mostly Plant-Based", "Balanced", "Mostly Animal-Based"] },
      { name: "LocalFoodFrequency", type: "choice", label: "How often do you buy local food?", options: ["Always", "Often", "Sometimes", "Rarely"] },
      { name: "ClothingFrequency", type: "choice", label: "How often do you buy new clothes?", options: ["Rarely", "Sometimes", "Often", "Always"], hint: "The dataset has no data dictionary; this is read as how often clothing is bought." },
      { name: "SustainableBrands", type: "boolean", label: "Do you prefer sustainable brands?" },
      { name: "UsingPlasticProducts", type: "choice", label: "How often do you use plastic products?", options: ["Never", "Rarely", "Sometimes", "Often"], hint: "For example bags, bottles and packaging." }
    ] },
    { id: "waste", title: "Waste, community & activity", subtitle: "Habits beyond the home", icon: "recycle", tone: "t-lavender", fields: [
      { name: "DisposalMethods", type: "choice", label: "How do you mainly dispose of waste?", options: ["Landfill", "Recycling", "Composting", "Combination"] },
      { name: "CommunityInvolvement", type: "choice", label: "Community or environmental involvement", options: ["None", "Low", "Moderate", "High"] },
      { name: "PhysicalActivities", type: "choice", label: "How physically active are you?", options: ["None", "Low", "Moderate", "High"], hint: "A model input; no recommendation rule uses it." }
    ] }
  ];
  const ALL_FIELDS = GROUPS.flatMap((g) => g.fields);

  // Example answers to try the form quickly (these are inputs only, not predictions)
  const EXAMPLES = {
    "Car commuter": { Age: 35, Location: "Suburban", HomeType: "Apartment", HomeSize: 1000, EnvironmentalAwareness: 3, TransportationMode: "Car", EnergySource: "Mixed", MonthlyElectricityConsumption: 300, MonthlyWaterConsumption: 3300, DietType: "Balanced", LocalFoodFrequency: "Sometimes", ClothingFrequency: "Sometimes", SustainableBrands: true, UsingPlasticProducts: "Sometimes", DisposalMethods: "Recycling", CommunityInvolvement: "Moderate", PhysicalActivities: "Moderate" },
    "Green household": { Age: 29, Location: "Urban", HomeType: "Apartment", HomeSize: 800, EnvironmentalAwareness: 5, TransportationMode: "Bike", EnergySource: "Renewable", MonthlyElectricityConsumption: 150, MonthlyWaterConsumption: 2000, DietType: "Mostly Plant-Based", LocalFoodFrequency: "Always", ClothingFrequency: "Rarely", SustainableBrands: true, UsingPlasticProducts: "Never", DisposalMethods: "Combination", CommunityInvolvement: "High", PhysicalActivities: "High" },
    "High-use home": { Age: 48, Location: "Rural", HomeType: "House", HomeSize: 2400, EnvironmentalAwareness: 2, TransportationMode: "Car", EnergySource: "Non-Renewable", MonthlyElectricityConsumption: 450, MonthlyWaterConsumption: 5000, DietType: "Mostly Animal-Based", LocalFoodFrequency: "Rarely", ClothingFrequency: "Always", SustainableBrands: false, UsingPlasticProducts: "Often", DisposalMethods: "Landfill", CommunityInvolvement: "None", PhysicalActivities: "Low" }
  };

  // Emoji for each recommendation rule (used sparingly, only on result cards)
  const RULE_EMOJI = { transport: "🚲", energy: "☀️", waste: "♻️", plastic: "🛍️", electricity: "💡", water: "💧", diet: "🥗", local_food: "🥕", clothing: "👕", brands: "🏷️", community: "🤝", awareness: "📘", fallback_maintain: "🌱" };
  const CLASS_TEXT = {
    High: "Your answers resemble the participants whose lifestyles were rated High in the dataset.",
    Medium: "Your answers resemble the participants whose lifestyles were rated Medium in the dataset.",
    Low: "Your answers resemble the participants whose lifestyles were rated Low in the dataset."
  };

  let lastPayload = null;

  // ---------------------------------------------------------------------------
  // Building the form
  // ---------------------------------------------------------------------------
  function choiceHtml(field, option, value, label) {
    const id = `${field.name}-${String(value).replace(/\s+/g, "_")}`;
    const icon = field.icons && field.icons[option] ? Eco.icon(field.icons[option]) : "";
    return `<label class="choice"><input type="radio" name="${field.name}" id="${id}" value="${escapeHtml(value)}"><span>${icon}${escapeHtml(label)}</span></label>`;
  }

  function fieldHtml(field) {
    let control = "";
    if (field.type === "number") {
      const attrs = `${field.min !== undefined ? `min="${field.min}"` : ""} ${field.max !== undefined ? `max="${field.max}"` : ""} step="${field.integer ? 1 : "any"}" inputmode="decimal"`;
      control = `<div class="input-unit"><input type="number" id="${field.name}" name="${field.name}" ${attrs} placeholder="e.g. ${field.name === "Age" ? 35 : field.name === "HomeSize" ? 1000 : field.name.includes("Electricity") ? 300 : 3300}"><span>${field.unit}</span></div>`;
    } else if (field.type === "boolean") {
      control = `<div class="chip-row">${choiceHtml(field, "Yes", "true", "Yes, I do")}${choiceHtml(field, "No", "false", "No")}</div>`;
    } else if (field.type === "scale") {
      control = `<div class="chip-row">${field.options.map((o) => choiceHtml(field, o, o, String(o))).join("")}</div><div class="scale-labels"><span>${field.lowLabel}</span><span>${field.highLabel}</span></div>`;
    } else {
      control = `<div class="chip-row">${field.options.map((o) => choiceHtml(field, o, o, o)).join("")}</div>`;
    }
    const labelTag = field.type === "number" ? `<label for="${field.name}">${escapeHtml(field.label)}</label>` : `<legend>${escapeHtml(field.label)}</legend>`;
    const wrapper = field.type === "number" ? "div" : "fieldset";
    return `<${wrapper} class="field" data-field="${field.name}">${labelTag}
      <p class="hint" id="hint-${field.name}">${escapeHtml(field.hint || "")}</p>${control}
      <div class="error-text" role="alert"></div></${wrapper}>`;
  }

  function buildForm() {
    byId("category-grid").innerHTML = GROUPS.map((g) => `
      <section class="category-card ${g.tone}" aria-labelledby="cat-${g.id}">
        <div class="category-head"><div class="tile">${Eco.icon(g.icon)}</div><div><h3 id="cat-${g.id}">${g.title}</h3><p>${g.subtitle}</p></div></div>
        ${g.fields.map(fieldHtml).join("")}
      </section>`).join("");

    byId("example-buttons").innerHTML = Object.keys(EXAMPLES).map((name) => `<button type="button" class="btn btn-lavender btn-small" data-example="${name}">${Eco.icon("sparkles")} ${name}</button>`).join("");
    document.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => fillForm(EXAMPLES[b.dataset.example])));

    const form = byId("assessment-form");
    form.addEventListener("input", updateProgress);
    form.addEventListener("change", updateProgress);
    form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
    byId("reset-form").addEventListener("click", resetForm);
    updateProgress();
  }

  // Show real dataset ranges next to the numeric inputs (after /analytics has loaded)
  function setDatasetHints(summaries) {
    const text = (key, unit) => {
      const s = summaries[key];
      return `Dataset: typical ${formatNumber(s.p25)} to ${formatNumber(s.p75)} ${unit} (middle half), median ${formatNumber(s.median)}, range ${formatNumber(s.min)} to ${formatNumber(s.max)}.`;
    };
    const set = (name, hint) => { const el = byId(`hint-${name}`); if (el) el.textContent = hint; };
    set("Age", `Whole years, 0 to 120. Dataset ages range from ${formatNumber(summaries.Age.min)} to ${formatNumber(summaries.Age.max)}.`);
    set("HomeSize", text("HomeSize", "sq ft"));
    set("MonthlyElectricityConsumption", text("MonthlyElectricityConsumption", "kWh"));
    set("MonthlyWaterConsumption", text("MonthlyWaterConsumption", "litres"));
  }

  // ---------------------------------------------------------------------------
  // Reading, validating, filling
  // ---------------------------------------------------------------------------
  // Returns the raw answer of one field, or null when it is not answered / not valid
  function readField(field) {
    if (field.type === "number") {
      const input = byId(field.name);
      if (input.value.trim() === "") return { value: null, problem: "Please enter a number." };
      const number = Number(input.value);
      if (Number.isNaN(number)) return { value: null, problem: "Please enter a valid number." };
      if (field.integer && !Number.isInteger(number)) return { value: null, problem: "Please enter a whole number." };
      if (field.min !== undefined && number < field.min) return { value: null, problem: `Must be ${field.min} or more.` };
      if (field.max !== undefined && number > field.max) return { value: null, problem: `Must be ${field.max} or less.` };
      return { value: number, problem: null };
    }
    const checked = document.querySelector(`input[name="${field.name}"]:checked`);
    if (!checked) return { value: null, problem: "Please choose one option." };
    if (field.type === "boolean") return { value: checked.value === "true", problem: null };
    if (field.type === "scale") return { value: Number(checked.value), problem: null };
    return { value: checked.value, problem: null };
  }

  function setFieldError(name, message) {
    const wrapper = document.querySelector(`[data-field="${name}"]`);
    if (!wrapper) return;
    wrapper.classList.toggle("has-error", Boolean(message));
    wrapper.querySelector(".error-text").textContent = message || "";
  }

  function updateProgress() {
    const answered = ALL_FIELDS.filter((f) => readField(f).value !== null).length;
    byId("progress-fill").style.width = `${(answered / ALL_FIELDS.length) * 100}%`;
    byId("progress-text").textContent = `${answered} of ${ALL_FIELDS.length} answered`;
    byId("progress-bar").setAttribute("aria-valuenow", answered);
    // clear an error as soon as that field becomes valid
    ALL_FIELDS.forEach((f) => { if (readField(f).value !== null) setFieldError(f.name, ""); });
  }

  function fillForm(values) {
    ALL_FIELDS.forEach((field) => {
      const value = values[field.name];
      if (field.type === "number") byId(field.name).value = value;
      else { const radio = document.querySelector(`input[name="${field.name}"][value="${String(value)}"]`); if (radio) radio.checked = true; }
    });
    updateProgress();
    hideFormAlert();
  }

  function resetForm() {
    byId("assessment-form").reset();
    ALL_FIELDS.forEach((f) => setFieldError(f.name, ""));
    hideFormAlert();
    updateProgress();
  }

  function showFormAlert(html) { const box = byId("form-alert"); box.innerHTML = html; box.hidden = false; }
  function hideFormAlert() { byId("form-alert").hidden = true; }

  // Collect the 17 answers into the object the backend expects (names and types as in schemas.py)
  function buildPayload() {
    const payload = {};
    const problems = [];
    ALL_FIELDS.forEach((field) => {
      const result = readField(field);
      setFieldError(field.name, result.problem);
      if (result.problem) problems.push(field);
      else payload[field.name] = result.value;
    });
    return { payload, problems };
  }

  // ---------------------------------------------------------------------------
  // Submit -> POST /predict -> results
  // ---------------------------------------------------------------------------
  async function submit() {
    hideFormAlert();
    const { payload, problems } = buildPayload();
    if (problems.length) {
      showFormAlert(`<span class="alert alert-error" style="padding:0;background:none;border:0">${Eco.icon("alert")}<span>Please complete ${problems.length} highlighted ${problems.length === 1 ? "question" : "questions"} before continuing.</span></span>`);
      const first = document.querySelector(`[data-field="${problems[0].name}"]`);
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    lastPayload = payload;
    const button = byId("submit-button");
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Analysing...`;
    showResultsState("loading");
    byId("results").scrollIntoView({ behavior: "smooth" });
    try {
      const result = await Eco.api.predict(payload);
      renderResults(result, payload);
    } catch (error) {
      // 422: highlight the fields the backend rejected
      Object.entries(error.fieldErrors || {}).forEach(([name, message]) => setFieldError(name, message));
      showResultsState("error", error);
    } finally {
      button.disabled = false;
      button.innerHTML = `${Eco.icon("sparkles")} Get my prediction`;
    }
  }

  // ---------------------------------------------------------------------------
  // Results screen states: empty, loading, error, success
  // ---------------------------------------------------------------------------
  function showResultsState(state, error) {
    const box = byId("results-box");
    if (state === "empty") {
      box.innerHTML = `<div class="card state-box" id="results-empty">${Eco.art.seedling()}
        <h3>No assessment yet</h3><p>Answer the 17 questions above to see your predicted category, estimated probabilities and personalised suggestions.</p>
        <a class="btn btn-primary" href="#assess">${Eco.icon("clipboard")} Go to the assessment</a></div>`;
    } else if (state === "loading") {
      box.innerHTML = `<div class="card" id="results-loading" role="status" aria-live="polite"><div class="skeleton" style="min-height:150px;margin-bottom:16px"></div><div class="skeleton" style="min-height:240px"></div><p class="note" style="justify-content:center">Contacting the backend...</p></div>`;
    } else if (state === "error") {
      const help = error.kind === "network" ? "Check that the backend is running and that the address in frontend/config.js is correct." : error.status === 503 ? "The backend is running but cannot make predictions yet. Train the model first with: python -m backend.train_model" : "Please check your answers and try again.";
      box.innerHTML = `<div class="card state-box" id="results-error" role="alert"><div class="icon-circle">${Eco.icon("alert")}</div>
        <h3>We could not get a prediction</h3><p>${escapeHtml(error.message)}</p><p style="font-size:.9rem">${help}</p>
        <div class="results-actions" style="justify-content:center"><button type="button" class="btn btn-primary" id="retry-predict">${Eco.icon("refresh")} Try again</button><a class="btn btn-outline" href="#assess">Edit answers</a></div></div>`;
      byId("retry-predict").addEventListener("click", submit);
    }
  }

  function renderResults(result, payload) {
    const prediction = result.prediction, recs = result.recommendations;
    const cls = prediction.predicted_class;

    // Probability bars (always Low, Medium, High order)
    const probabilityRows = ["Low", "Medium", "High"].map((name) => {
      const p = prediction.probabilities[name];
      return `<div class="prob-row ${name === cls ? "top" : ""}"><span class="name"><i style="background:${classColor(name)}"></i>${name}</span>
        <div class="prob-track" role="img" aria-label="${name}: ${(p * 100).toFixed(1)} percent"><div class="prob-fill" data-width="${(p * 100).toFixed(1)}" style="background:${classColor(name)}"></div></div>
        <span class="val">${(p * 100).toFixed(1)}%</span></div>`;
    }).join("");

    const recCards = recs.recommendations.map((r) => `
      <article class="rec-card p-${r.priority.toLowerCase()}">
        <div class="top"><div class="emoji-tile" aria-hidden="true">${RULE_EMOJI[r.rule_id] || "🌿"}</div><span class="badge badge-${r.priority.toLowerCase()}">${r.priority} priority</span></div>
        <div><div class="category">${escapeHtml(r.category)}</div><h4>${escapeHtml(r.title)}</h4></div>
        <p>${escapeHtml(r.description)}</p>
        <div class="trigger"><b>Because you answered:</b> ${escapeHtml(r.triggered_by)}</div>
      </article>`).join("");

    const strengthCards = recs.strengths.map((s) => `
      <div class="strength-card"><div class="tick">${Eco.icon("check")}</div><div><h4>${escapeHtml(s.title)}</h4><p>${escapeHtml(s.message)}</p><small>${escapeHtml(s.triggered_by)}</small></div></div>`).join("");

    const summary = recs.summary;
    const countText = summary.suggestions_not_shown > 0
      ? `Showing the top ${summary.suggestions_shown} of ${summary.suggestions_triggered} suggestions, most important first.`
      : `${summary.suggestions_shown} ${summary.suggestions_shown === 1 ? "suggestion" : "suggestions"} for you.`;

    byId("results-box").innerHTML = `
      <div class="results-box">
        <div class="result-hero class-${cls.toLowerCase()}">
          ${Eco.art.growth(cls)}
          <div>
            <div class="result-label">Predicted sustainability rating category</div>
            <div class="result-class" id="predicted-class">${escapeHtml(cls)}</div>
            <p>${CLASS_TEXT[cls]} This is the model's prediction of the dataset's rating category, not a measurement of your real environmental impact.</p>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div><h3>Estimated class probabilities</h3><p class="card-sub">Vote shares of the classifier's trees for each category.</p></div><span class="badge badge-warn">${Eco.icon("alert")} Uncalibrated</span></div>
          ${probabilityRows}
          <p class="note">${Eco.icon("info")}<span>${escapeHtml(prediction.probability_note)}</span></p>
        </div>

        <div>
          <div class="rec-header"><div><h3>${Eco.icon("sparkles")} Personalised suggestions</h3><p class="card-sub">${escapeHtml(recs.message)} ${countText}</p></div></div>
          <div class="rec-grid" id="rec-grid">${recCards}</div>
        </div>

        ${strengthCards ? `<div><div class="rec-header"><h3>${Eco.icon("checkCircle")} Already doing well</h3></div><div class="strength-grid" id="strength-grid">${strengthCards}</div></div>` : ""}

        <div class="disclaimer">${Eco.icon("info")}<span>${escapeHtml(recs.disclaimer)} The suggestions come from hand-written rules that read your actual answers; they are separate from the machine-learning prediction.</span></div>

        <details class="payload"><summary>${Eco.icon("code")} Show the 17 answers sent to the API</summary><pre id="payload-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre></details>

        <div class="results-actions"><a class="btn btn-outline" href="#assess">${Eco.icon("rotate")} Edit my answers</a><button type="button" class="btn btn-soft" id="new-assessment">Start a new assessment</button></div>
      </div>`;
    byId("new-assessment").addEventListener("click", () => { resetForm(); byId("assess").scrollIntoView({ behavior: "smooth" }); });
    // animate the probability bars after they are in the page
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll(".prob-fill").forEach((bar) => { bar.style.width = bar.dataset.width + "%"; });
    }));
  }

  function init() {
    buildForm();
    showResultsState("empty");
  }

  return { init, setDatasetHints, getLastPayload: () => lastPayload, fieldNames: () => ALL_FIELDS.map((f) => f.name) };
})();
