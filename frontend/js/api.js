
// ---------------------------------------------------------------------------
// api.js - communicates with the deployed FastAPI backend.
// Automatically retries temporary connection failures and Render cold starts.
// ---------------------------------------------------------------------------

window.Eco = window.Eco || {};

Eco.api = (function () {
  const REQUEST_TIMEOUT_MS = 90000;
  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 2500;

  // Base URL: ?api=... overrides config.js
  function baseUrl() {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    const configuredUrl = window.ECO_CONFIG?.API_BASE_URL;

    const url = fromQuery || configuredUrl;

    if (!url) {
      throw new Error("Backend API URL is not configured.");
    }

    return url.replace(/\/+$/, "");
  }

  class ApiError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = "ApiError";
      this.kind = details.kind || "http";
      this.status = details.status || null;
      this.fieldErrors = details.fieldErrors || {};
    }
  }

  // Notify the application about the current backend connection state.
  function emitStatus(state, message, attempt = 1) {
    window.dispatchEvent(
      new CustomEvent("eco:backend-status", {
        detail: {
          state,
          message,
          attempt,
          maxAttempts: MAX_ATTEMPTS
        }
      })
    );
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function readErrorDetail(data, status) {
    const fieldErrors = {};
    let message = `The backend returned an error (HTTP ${status}).`;

    if (data && typeof data.detail === "string") {
      message = data.detail;
    } else if (data && Array.isArray(data.detail)) {
      const parts = data.detail.map(item => {
        const field = Array.isArray(item.loc)
          ? item.loc[item.loc.length - 1]
          : "input";

        fieldErrors[field] = item.msg || "Invalid value";
        return `${field}: ${item.msg}`;
      });

      message = "Some answers were rejected by the backend: " +
        parts.join("; ");
    }

    return { message, fieldErrors };
  }

  async function requestOnce(path, options = {}) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    let response;

    try {
      response = await fetch(baseUrl() + path, {
        method: options.method || "GET",
        headers: options.body
          ? { "Content-Type": "application/json" }
          : {},
        body: options.body
          ? JSON.stringify(options.body)
          : undefined,
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new ApiError(
          "The backend took too long to respond.",
          { kind: "timeout" }
        );
      }

      throw new ApiError(
        "The hosted backend could not be reached.",
        { kind: "network" }
      );
    } finally {
      clearTimeout(timer);
    }

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      // Response body was empty or was not JSON.
    }

    if (!response.ok) {
      const { message, fieldErrors } =
        readErrorDetail(data, response.status);

      throw new ApiError(message, {
        kind: "http",
        status: response.status,
        fieldErrors
      });
    }

    return data;
  }

  function shouldRetry(error) {
    if (error.kind === "network" || error.kind === "timeout") {
      return true;
    }

    return [502, 503, 504].includes(error.status);
  }

  async function request(path, options = {}) {
    emitStatus(
      "connecting",
      "Connecting to the Eco Lifestyle Predictor backend..."
    );

    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await requestOnce(path, options);

        emitStatus("online", "Backend connected.");
        return data;

      } catch (error) {
        lastError = error;

        if (!shouldRetry(error) || attempt === MAX_ATTEMPTS) {
          emitStatus(
            "offline",
            "The hosted backend is still unavailable. Please try again shortly."
          );
          throw error;
        }

        emitStatus(
          "retrying",
          "The server may be waking up. Retrying automatically...",
          attempt
        );

        await delay(RETRY_DELAY_MS);
      }
    }

    throw lastError;
  }

  return {
    baseUrl,
    ApiError,

    getHealth: () => request("/health"),

    getAnalytics: () => request("/analytics"),

    getModelInsights: () => request("/model-insights"),

    predict: profile =>
      request("/predict", {
        method: "POST",
        body: profile
      })
  };
})();
