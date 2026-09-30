"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const productionFiles = [
  "node-reddit.js",
  path.join("lib", "reddit-client.js"),
  path.join("lib", "reddit-normalize.js")
];

const forbiddenApplicationTerms = [
  "Ocular Warlock",
  "SyzygyBlue",
  "reader request",
  "reader-request",
  "marketing score",
  "opportunity score"
];

for (const file of productionFiles) {
  const content = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  for (const term of forbiddenApplicationTerms) {
    assert.equal(
      content.toLowerCase().includes(term.toLowerCase()),
      false,
      `${file} contains application-specific logic marker: ${term}`
    );
  }
}

const clientSource = fs.readFileSync(
  path.join(__dirname, "..", "lib", "reddit-client.js"),
  "utf8"
);

assert.match(
  clientSource,
  /q:\s*query/,
  "Search must forward the caller-supplied query."
);
assert.match(
  clientSource,
  /const base = subreddit \?/,
  "Search must derive subreddit restriction only from the caller-supplied subreddit."
);

console.log("Separation-of-concerns regression tests passed.");
