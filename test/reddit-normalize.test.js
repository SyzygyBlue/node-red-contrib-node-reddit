"use strict";

const assert = require("node:assert/strict");
const {
  SCHEMA_VERSION,
  inferKind,
  normalizeRedditObject,
  normalizeRedditList
} = require("../lib/reddit-normalize");

function testSubmission() {
  const raw = {
    id: "abc123",
    name: "t3_abc123",
    subreddit: "ExampleSub",
    author: "alice",
    created_utc: 1790772000,
    permalink: "/r/ExampleSub/comments/abc123/example/",
    url: "https://example.test/article",
    title: "Example title",
    selftext: "Example body",
    score: 42
  };

  const item = normalizeRedditObject(raw);

  assert.equal(item.schemaVersion, SCHEMA_VERSION);
  assert.equal(item.provider, "reddit");
  assert.equal(item.kind, "submission");
  assert.equal(item.id, "abc123");
  assert.equal(item.fullname, "t3_abc123");
  assert.equal(item.subreddit, "ExampleSub");
  assert.equal(item.author, "alice");
  assert.equal(item.createdUtc, 1790772000);
  assert.equal(item.permalink, "/r/ExampleSub/comments/abc123/example/");
  assert.equal(item.url, "https://example.test/article");
  assert.equal(item.title, "Example title");
  assert.equal(item.body, "Example body");
  assert.equal(item.subject, null);
  assert.equal(item.parentFullname, null);
  assert.equal(item.linkFullname, null);
  assert.strictEqual(item.raw, raw);
}

function testComment() {
  const raw = {
    id: "def456",
    name: "t1_def456",
    subreddit: "ExampleSub",
    author: { name: "bob" },
    created_utc: "1790772010",
    permalink: "/r/ExampleSub/comments/abc123/example/def456/",
    body: "A comment",
    parent_id: "t3_abc123",
    link_id: "t3_abc123"
  };

  const item = normalizeRedditObject(raw);

  assert.equal(item.kind, "comment");
  assert.equal(item.author, "bob");
  assert.equal(item.createdUtc, 1790772010);
  assert.equal(item.title, null);
  assert.equal(item.body, "A comment");
  assert.equal(item.parentFullname, "t3_abc123");
  assert.equal(item.linkFullname, "t3_abc123");
}

function testMessage() {
  const raw = {
    id: "msg789",
    name: "t4_msg789",
    author: "carol",
    dest: "example-user",
    created_utc: 1790772020,
    context: "/message/messages/msg789",
    subject: "Hello",
    body: "Message body"
  };

  const item = normalizeRedditObject(raw);

  assert.equal(item.kind, "message");
  assert.equal(item.subreddit, null);
  assert.equal(item.author, "carol");
  assert.equal(item.permalink, "/message/messages/msg789");
  assert.equal(item.subject, "Hello");
  assert.equal(item.body, "Message body");
}

function testInferenceAndEmptyList() {
  assert.equal(inferKind({ name: "t3_x" }), "submission");
  assert.equal(inferKind({ name: "t1_x" }), "comment");
  assert.equal(inferKind({ name: "t4_x" }), "message");
  assert.equal(inferKind({}), "unknown");
  assert.deepEqual(normalizeRedditList([]), []);
  assert.deepEqual(normalizeRedditList(null), []);
}

testSubmission();
testComment();
testMessage();
testInferenceAndEmptyList();

console.log("Normalized Reddit read schema tests passed.");
