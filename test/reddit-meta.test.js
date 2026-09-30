"use strict";

const assert = require("node:assert/strict");
const {
  classifyFailure,
  buildResponseMeta,
  buildErrorMeta
} = require("../lib/reddit-meta");

function headers(values = {}) {
  const lowered = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)])
  );
  return {
    get(name) {
      return lowered[String(name).toLowerCase()] ?? null;
    }
  };
}

function response(status, values = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers(values)
  };
}

function testSuccessMetadata() {
  const meta = buildResponseMeta(
    response(200, {
      "x-ratelimit-used": "3",
      "x-ratelimit-remaining": "97",
      "x-ratelimit-reset": "412",
      "x-reddit-trace": "trace-123"
    }),
    {
      method: "GET",
      endpoint: "/r/example/search"
    }
  );

  assert.deepEqual(meta, {
    status: 200,
    ok: true,
    method: "GET",
    endpoint: "/r/example/search",
    requestId: "trace-123",
    rateLimit: {
      used: 3,
      remaining: 97,
      resetSeconds: 412
    },
    retryAfterSeconds: null
  });
}

function testClassification() {
  assert.deepEqual(
    classifyFailure({ status: 401, headers: headers() }),
    {
      category: "authentication",
      code: "AUTH_FAILED",
      retryable: false,
      retryAfterSeconds: null
    }
  );

  assert.deepEqual(
    classifyFailure({ status: 403, headers: headers() }),
    {
      category: "permission",
      code: "PERMISSION_DENIED",
      retryable: false,
      retryAfterSeconds: null
    }
  );

  assert.deepEqual(
    classifyFailure({
      status: 429,
      headers: headers({
        "retry-after": "17",
        "x-ratelimit-reset": "30"
      })
    }),
    {
      category: "rate_limit",
      code: "RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: 17
    }
  );

  assert.deepEqual(
    classifyFailure({
      status: 200,
      apiErrors: [["RATELIMIT", "try again later", "ratelimit"]],
      headers: headers({ "x-ratelimit-reset": "45" })
    }),
    {
      category: "rate_limit",
      code: "RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: 45
    }
  );

  assert.deepEqual(
    classifyFailure({
      status: 503,
      headers: headers({ "retry-after": "12" })
    }),
    {
      category: "server",
      code: "SERVER_ERROR",
      retryable: true,
      retryAfterSeconds: 12
    }
  );

  assert.deepEqual(
    classifyFailure({ status: 404, headers: headers() }),
    {
      category: "client",
      code: "CLIENT_ERROR",
      retryable: false,
      retryAfterSeconds: null
    }
  );
}

function testSanitizedErrorProjection() {
  const err = new Error("failure");
  err.code = "RATE_LIMITED";
  err.category = "rate_limit";
  err.status = 429;
  err.retryable = true;
  err.retryAfterSeconds = 8;
  err.apiErrors = [["RATELIMIT", "wait", "ratelimit"]];
  err.meta = {
    status: 429,
    method: "GET",
    endpoint: "/search",
    requestId: "trace-456",
    rateLimit: {
      used: 100,
      remaining: 0,
      resetSeconds: 8
    }
  };
  err.payload = {
    access_token: "must-not-leak",
    refresh_token: "must-not-leak"
  };

  const meta = buildErrorMeta(err);

  assert.equal(meta.code, "RATE_LIMITED");
  assert.equal(meta.category, "rate_limit");
  assert.equal(meta.status, 429);
  assert.equal(meta.retryable, true);
  assert.equal(meta.retryAfterSeconds, 8);
  assert.equal(meta.requestId, "trace-456");
  assert.equal(meta.method, "GET");
  assert.equal(meta.endpoint, "/search");
  assert.equal(meta.rateLimit.remaining, 0);

  const serialized = JSON.stringify(meta);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("refresh_token"), false);
  assert.equal(serialized.includes("must-not-leak"), false);
}

testSuccessMetadata();
testClassification();
testSanitizedErrorProjection();

console.log("Reddit transport metadata tests passed.");
