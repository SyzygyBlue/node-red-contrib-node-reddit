"use strict";

const assert = require("node:assert/strict");
const { RedditClient, RedditApiError, fullname } = require("../lib/reddit-client");

function response(status, body, headers = {}) {
  const lowered = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
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
      if (body === null || body === undefined) return "";
      return typeof body === "string" ? body : JSON.stringify(body);
    }
  };
}

function queueFetch(entries) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (!entries.length) throw new Error("Unexpected fetch call");
    const next = entries.shift();
    if (typeof next === "function") return next(String(url), init);
    return response(next.status ?? 200, next.body, next.headers);
  };
  return { fetchImpl, calls };
}

async function testFullnames() {
  assert.equal(fullname("abc", "comment"), "t1_abc");
  assert.equal(fullname("abc", "submission"), "t3_abc");
  assert.equal(fullname("t3_abc", "submission"), "t3_abc");
  assert.equal(fullname("abc", "message"), "t4_abc");
}

async function testSearchWithAccessToken() {
  const q = queueFetch([
    {
      body: {
        data: {
          after: null,
          children: [
            { kind: "t3", data: { name: "t3_post1", title: "smart protagonist" } }
          ]
        }
      },
      headers: {
        "x-ratelimit-used": "1",
        "x-ratelimit-remaining": "99",
        "x-ratelimit-reset": "600"
      }
    }
  ]);

  const client = new RedditClient({
    userAgent: "node-red-test/1.0",
    accessToken: "token",
    fetchImpl: q.fetchImpl
  });

  const results = await client.search({
    subreddit: "ProgressionFantasy",
    query: "smart protagonist",
    sort: "new",
    time: "week",
    limit: 10
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].name, "t3_post1");
  assert.match(q.calls[0].url, /oauth\.reddit\.com\/r\/ProgressionFantasy\/search/);
  assert.match(q.calls[0].url, /q=smart\+protagonist/);
  assert.match(q.calls[0].url, /restrict_sr=true/);
  assert.equal(q.calls[0].init.headers.Authorization, "Bearer token");
  assert.equal(client.lastResponseMeta.rateLimit.remaining, 99);
}

async function testRefreshTokenAndReply() {
  const q = queueFetch([
    {
      body: {
        access_token: "refreshed",
        token_type: "bearer",
        expires_in: 3600,
        scope: "read submit edit"
      }
    },
    {
      body: {
        json: {
          errors: [],
          data: {
            things: [
              { kind: "t1", data: { name: "t1_reply1", body: "hello" } }
            ]
          }
        }
      }
    }
  ]);

  const client = new RedditClient({
    userAgent: "node-red-test/1.0",
    clientId: "client",
    clientSecret: "secret",
    refreshToken: "refresh",
    fetchImpl: q.fetchImpl
  });

  const reply = await client.reply({
    kind: "submission",
    id: "post1",
    text: "hello"
  });

  assert.equal(reply.name, "t1_reply1");
  assert.equal(q.calls.length, 2);
  assert.equal(q.calls[0].url, "https://www.reddit.com/api/v1/access_token");
  assert.match(String(q.calls[0].init.body), /grant_type=refresh_token/);
  assert.match(String(q.calls[0].init.body), /refresh_token=refresh/);
  assert.match(q.calls[1].url, /oauth\.reddit\.com\/api\/comment/);
  assert.equal(q.calls[1].init.headers.Authorization, "Bearer refreshed");
  assert.match(String(q.calls[1].init.body), /thing_id=t3_post1/);
}

async function testWriteEndpoints() {
  const q = queueFetch([
    { body: { json: { errors: [], data: { name: "t3_newpost", url: "https://reddit.test/x" } } } },
    { body: { json: { errors: [], data: { things: [{ data: { name: "t1_c1", body: "edited" } }] } } } },
    { status: 204, body: null },
    { status: 204, body: null },
    { status: 204, body: null }
  ]);

  const client = new RedditClient({
    userAgent: "node-red-test/1.0",
    accessToken: "token",
    fetchImpl: q.fetchImpl
  });

  const created = await client.create({
    type: "self",
    subreddit: "test",
    title: "title",
    text: "body"
  });
  assert.equal(created.name, "t3_newpost");

  const edited = await client.edit({ kind: "comment", id: "c1", text: "edited" });
  assert.equal(edited.name, "t1_c1");

  const deleted = await client.delete({ kind: "comment", id: "c1" });
  assert.equal(deleted.deleted, true);

  const reacted = await client.react({
    kind: "submission",
    id: "p1",
    vote: "upvote",
    save: "save"
  });
  assert.deepEqual(reacted.actions, ["upvote", "save"]);

  const urls = q.calls.map(call => call.url);
  assert.match(urls[0], /\/api\/submit/);
  assert.match(urls[1], /\/api\/editusertext/);
  assert.match(urls[2], /\/api\/del/);
  assert.match(urls[3], /\/api\/vote/);
  assert.match(urls[4], /\/api\/save/);
}

async function testApiError() {
  const q = queueFetch([
    {
      status: 200,
      body: {
        json: {
          errors: [["RATELIMIT", "you are doing that too much", "ratelimit"]]
        }
      }
    }
  ]);

  const client = new RedditClient({
    userAgent: "node-red-test/1.0",
    accessToken: "token",
    fetchImpl: q.fetchImpl
  });

  await assert.rejects(
    () => client.reply({ kind: "comment", id: "c1", text: "x" }),
    err => err instanceof RedditApiError && /RATELIMIT/.test(err.message)
  );
}

async function main() {
  await testFullnames();
  await testSearchWithAccessToken();
  await testRefreshTokenAndReply();
  await testWriteEndpoints();
  await testApiError();
  console.log("Native Reddit client tests passed.");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
