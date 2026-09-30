"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

function mockResponse(status, body, headerValues = {}) {
  const lowered = Object.fromEntries(
    Object.entries(headerValues).map(([key, value]) => [key.toLowerCase(), String(value)])
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERROR",
    headers: {
      get(name) {
        return lowered[String(name).toLowerCase()] ?? null;
      }
    },
    async text() {
      return body === null || body === undefined
        ? ""
        : typeof body === "string"
          ? body
          : JSON.stringify(body);
    }
  };
}

function makeRed() {
  const types = new Map();
  const credentialConfig = {
    auth_type: "access_token",
    user_agent: "node-red-metadata-test/1.0",
    credentials: {
      access_token: "test-access-token"
    }
  };

  return {
    _types: types,
    nodes: {
      registerType(name, ctor) {
        types.set(name, ctor);
      },
      createNode(node) {
        const emitter = new EventEmitter();
        node.on = emitter.on.bind(emitter);
        node.emit = emitter.emit.bind(emitter);
        node.status = value => {
          node._status = value;
        };
        node.send = value => {
          node._sent = node._sent || [];
          node._sent.push(value);
        };
        node.error = (message, msg) => {
          node._errors = node._errors || [];
          node._errors.push({ message, msg });
        };
      },
      getNode(id) {
        return id === "credentials" ? credentialConfig : null;
      }
    },
    util: {
      cloneMessage(msg) {
        return structuredClone(msg);
      }
    }
  };
}

async function waitFor(predicate) {
  for (let i = 0; i < 40; i += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error("Timed out waiting for Node-RED node output.");
}

async function testSuccessMetadataOnMessage() {
  global.fetch = async url => {
    assert.match(String(url), /\/r\/CallerSub\/search/);
    return mockResponse(
      200,
      {
        data: {
          after: null,
          children: [
            {
              kind: "t3",
              data: {
                id: "abc",
                name: "t3_abc",
                subreddit: "CallerSub",
                author: "alice",
                created_utc: 1790772000,
                permalink: "/r/CallerSub/comments/abc/test/",
                title: "Title",
                selftext: "Body"
              }
            }
          ]
        }
      },
      {
        "x-ratelimit-used": "4",
        "x-ratelimit-remaining": "96",
        "x-ratelimit-reset": "300",
        "x-reddit-trace": "trace-success"
      }
    );
  };

  const RED = makeRed();
  require("../node-reddit.js")(RED);
  const SearchNode = RED._types.get("search");
  const node = new SearchNode({
    reddit: "credentials",
    subreddit: "CallerSub",
    query: "{{payload.query}}",
    sort: "new",
    time: "week",
    limit: "10"
  });

  node.emit("input", { payload: { query: "exact caller query" } });
  await waitFor(() => node._sent && node._sent.length);

  const outputMsg = node._sent[0][0][0];

  assert.equal(outputMsg.payload.fullname, "t3_abc");
  assert.equal(outputMsg.reddit.response.status, 200);
  assert.equal(outputMsg.reddit.response.ok, true);
  assert.equal(outputMsg.reddit.response.method, "GET");
  assert.equal(outputMsg.reddit.response.endpoint, "/r/CallerSub/search");
  assert.equal(outputMsg.reddit.response.requestId, "trace-success");
  assert.equal(outputMsg.reddit.response.rateLimit.remaining, 96);
  assert.equal(outputMsg.reddit.response.rateLimit.resetSeconds, 300);

  const serialized = JSON.stringify(outputMsg.reddit.response);
  assert.equal(serialized.includes("exact caller query"), false);
  assert.equal(serialized.includes("test-access-token"), false);
}

async function testRateLimitMetadataReachesCatchMessage() {
  global.fetch = async () => mockResponse(
    429,
    { message: "Too Many Requests" },
    {
      "retry-after": "19",
      "x-ratelimit-used": "100",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "25",
      "x-request-id": "request-rate-limit"
    }
  );

  const RED = makeRed();
  require("../node-reddit.js")(RED);
  const SearchNode = RED._types.get("search");
  const node = new SearchNode({
    reddit: "credentials",
    subreddit: "CallerSub",
    query: "caller query",
    sort: "new",
    time: "week",
    limit: "10"
  });

  const input = { payload: { unchanged: true } };
  node.emit("input", input);
  await waitFor(() => node._errors && node._errors.length);

  const error = node._errors[0];
  assert.strictEqual(error.msg, input);
  assert.equal(error.msg.payload.unchanged, true);
  assert.equal(error.msg.reddit.error.code, "RATE_LIMITED");
  assert.equal(error.msg.reddit.error.category, "rate_limit");
  assert.equal(error.msg.reddit.error.status, 429);
  assert.equal(error.msg.reddit.error.retryable, true);
  assert.equal(error.msg.reddit.error.retryAfterSeconds, 19);
  assert.equal(error.msg.reddit.error.rateLimit.remaining, 0);
  assert.equal(error.msg.reddit.error.requestId, "request-rate-limit");
  assert.equal(error.msg.reddit.error.endpoint, "/r/CallerSub/search");
  assert.match(error.message, /429/);
}

async function main() {
  const originalFetch = global.fetch;
  try {
    await testSuccessMetadataOnMessage();
    await testRateLimitMetadataReachesCatchMessage();
  } finally {
    global.fetch = originalFetch;
  }

  console.log("Node-RED transport metadata integration tests passed.");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
