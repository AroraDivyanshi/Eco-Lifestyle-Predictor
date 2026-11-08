// ---------------------------------------------------------------------------
// api.js - talks to the FastAPI backend.
//   GET  /health          GET /analytics          GET /model-insights          POST /predict
// Every function returns the parsed JSON or throws an ApiError with a friendly message.
// ---------------------------------------------------------------------------
window.Eco = window.Eco || {};

Eco.api = (function () {
  const REQUEST_TIMEOUT_MS = 20000;

  // Base URL: ?api=... in the page address wins, otherwise config.js. Trailing slashes are removed.
  function baseUrl() {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    return (fromQuery || window.ECO_CONFIG.API_BASE_URL).replace(/\/+$/, "");
  }

  // Our own error type so the screens can show a clear message.
  class ApiError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = "ApiError";
      this.kind = details.kind || "http";        // "network" | "timeout" | "http"
      this.status = details.status || null;      // HTTP status code if the server answered
      this.fieldErrors = details.fieldErrors || {};   // {FieldName: "message"} for 422 validation errors
    }
  }

  // FastAPI sends 422 errors as {detail: [{loc: ["body", "Age"], msg: "..."}]} and other errors as {detail: "text"}
  function readErrorDetail(data, status) {
    const fieldErrors = {};
    let message = `The backend returned an error (HTTP ${status}).`;
    if (data && typeof data.detail === "string") {
      message = data.detail;
    } else if (data && Array.isArray(data.detail)) {
      const parts = data.detail.map((item) => {
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "input";
        fieldErrors[field] = item.msg || "Invalid value";
        return `${field}: ${item.msg}`;
      });
      message = "Some answers were rejected by the backend: " + parts.join("; ");
    }
    return { message, fieldErrors };
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(baseUrl() + path, {
        method: options.method || "GET",
        headers: options.body ? { "Content-Type": "application/json" } : {},
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new ApiError("The backend took too long to respond. Please try again.", { kind: "timeout" });
      }
      throw new ApiError(`Cannot reach the backend at ${baseUrl()}. Is it running? Start it with: uvicorn backend.app:app --reload`, { kind: "network" });
    } finally {
      clearTimeout(timer);
    }

    let data = null;
    try { data = await response.json(); } catch (e) { /* the body was not JSON */ }

    if (!response.ok) {
      const { message, fieldErrors } = readErrorDetail(data, response.status);
      throw new ApiError(message, { kind: "http", status: response.status, fieldErrors });
    }
    return data;
  }

  return {
    baseUrl,
    ApiError,
    getHealth: () => request("/health"),
    getAnalytics: () => request("/analytics"),
    getModelInsights: () => request("/model-insights"),
    predict: (profile) => request("/predict", { method: "POST", body: profile })
  };
})();
