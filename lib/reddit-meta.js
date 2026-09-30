"use strict";

function numberHeader(headers, name) {
  const value = headers && typeof headers.get === "function" ? headers.get(name) : null;
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringHeader(headers, name) {
  const value = headers && typeof headers.get === "function" ? headers.get(name) : null;
  return value === null || value === undefined || value === "" ? null : String(value);
}

function classifyFailure({ status, apiErrors = [], headers } = {}) {
  const apiCodes = apiErrors
    .map(error => Array.isArray(error) ? error[0] : null)
    .filter(Boolean)
    .map(code => String(code).toUpperCase());

  const redditRateLimited = apiCodes.includes("RATELIMIT");
  const retryAfterHeader = numberHeader(headers, "retry-after");
  const rateReset = numberHeader(headers, "x-ratelimit-reset");

  if (status === 401) {
    return {
      category: "authentication",
      code: "AUTH_FAILED",
      retryable: false,
      retryAfterSeconds: null
    };
  }

  if (status === 403) {
    return {
      category: "permission",
      code: "PERMISSION_DENIED",
      retryable: false,
      retryAfterSeconds: null
    };
  }

  if (status === 429 || redditRateLimited) {
    return {
      category: "rate_limit",
      code: "RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: retryAfterHeader ?? rateReset
    };
  }

  if (Number.isInteger(status) && status >= 500 && status <= 599) {
    return {
      category: "server",
      code: "SERVER_ERROR",
      retryable: true,
      retryAfterSeconds: retryAfterHeader
    };
  }

  if (Number.isInteger(status) && status >= 400 && status <= 499) {
    return {
      category: "client",
      code: "CLIENT_ERROR",
      retryable: false,
      retryAfterSeconds: null
    };
  }

  if (apiErrors.length) {
    return {
      category: "reddit_api",
      code: "REDDIT_API_ERROR",
      retryable: false,
      retryAfterSeconds: null
    };
  }

  return {
    category: "unknown",
    code: "API_ERROR",
    retryable: false,
    retryAfterSeconds: null
  };
}

function buildResponseMeta(response, request = {}) {
  const headers = response && response.headers;
  return {
    status: response && Number.isInteger(response.status) ? response.status : null,
    ok: Boolean(response && response.ok),
    method: request.method || "GET",
    endpoint: request.endpoint || null,
    requestId:
      stringHeader(headers, "x-reddit-trace") ||
      stringHeader(headers, "x-request-id") ||
      stringHeader(headers, "request-id"),
    rateLimit: {
      used: numberHeader(headers, "x-ratelimit-used"),
      remaining: numberHeader(headers, "x-ratelimit-remaining"),
      resetSeconds: numberHeader(headers, "x-ratelimit-reset")
    },
    retryAfterSeconds: numberHeader(headers, "retry-after")
  };
}

function buildErrorMeta(err) {
  const meta = {
    code: err && err.code ? err.code : "REDDIT_ERROR",
    category: err && err.category ? err.category : "unknown",
    retryable: Boolean(err && err.retryable),
    retryAfterSeconds:
      err && Number.isFinite(err.retryAfterSeconds) ? err.retryAfterSeconds : null
  };

  if (Number.isInteger(err && err.status)) {
    meta.status = err.status;
  }

  if (Array.isArray(err && err.apiErrors) && err.apiErrors.length) {
    meta.apiErrors = err.apiErrors;
  }

  if (err && err.meta && err.meta.rateLimit) {
    meta.rateLimit = err.meta.rateLimit;
  }

  if (err && err.meta && err.meta.requestId) {
    meta.requestId = err.meta.requestId;
  }

  if (err && err.meta && err.meta.method) {
    meta.method = err.meta.method;
  }

  if (err && err.meta && err.meta.endpoint) {
    meta.endpoint = err.meta.endpoint;
  }

  return meta;
}

module.exports = {
  numberHeader,
  stringHeader,
  classifyFailure,
  buildResponseMeta,
  buildErrorMeta
};
