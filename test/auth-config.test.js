"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "node-reddit.html"), "utf8");
const runtime = fs.readFileSync(path.join(__dirname, "..", "node-reddit.js"), "utf8");

assert.match(
  html,
  /auth_type:\s*\{\s*value:\s*"refresh_token"/,
  "Refresh-token OAuth must remain the default authentication mode."
);

assert.match(
  html,
  /OAuth Refresh Token \(Recommended\)/,
  "Recommended refresh-token label is missing."
);

assert.match(
  html,
  /Existing Access Token \(Advanced\)/,
  "Advanced access-token label is missing."
);

assert.match(
  html,
  /Legacy Script App \(Username\/Password\)/,
  "Legacy compatibility label is missing."
);

for (const id of [
  "node-config-input-client_id",
  "node-config-input-client_secret",
  "node-config-input-password",
  "node-config-input-refresh_token",
  "node-config-input-access_token"
]) {
  const tag = html.match(new RegExp("<input[^>]+id=\\\"" + id + "\\\"[^>]*>")) ||
              html.match(new RegExp("<input[^>]+type=\\\"password\\\"[^>]+id=\\\"" + id + "\\\"[^>]*>"));
  assert.ok(tag, `Credential input not found: ${id}`);
  assert.match(tag[0], /type="password"/, `Credential must render as password: ${id}`);
}

assert.match(
  runtime,
  /msg\.reddit\.error\s*=\s*errorMeta/,
  "Runtime must expose sanitized machine-readable Reddit error metadata."
);

for (const secretName of [
  "client_secret",
  "refresh_token",
  "access_token",
  "password"
]) {
  assert.equal(
    new RegExp("msg(?:\\.|\\[)[^\\n]*" + secretName).test(runtime),
    false,
    `Runtime appears to place ${secretName} in a normal Node-RED message.`
  );
}

console.log("Authentication editor/config safety tests passed.");
