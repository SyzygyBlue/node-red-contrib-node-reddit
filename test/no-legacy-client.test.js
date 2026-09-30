"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const files = [
  "package.json",
  "node-reddit.js",
  path.join("lib", "reddit-client.js")
];

const forbidden = [
  "snoowrap",
  "snoostorm-es6",
  "request-promise",
  "\"request\""
];

for (const file of files) {
  const content = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  for (const token of forbidden) {
    assert.equal(
      content.includes(token),
      false,
      `${file} still references legacy dependency token: ${token}`
    );
  }
}

console.log("Legacy Reddit client dependency check passed.");
