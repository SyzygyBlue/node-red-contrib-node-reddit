"use strict";

const SCHEMA_VERSION = 1;

const KIND_BY_PREFIX = {
  t1: "comment",
  t3: "submission",
  t4: "message"
};

function stringOrNull(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.name === "string") return value.name;
  if (value === null || value === undefined) return null;
  return String(value);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferKind(raw) {
  if (!raw || typeof raw !== "object") return "unknown";

  if (typeof raw.name === "string") {
    const prefix = raw.name.slice(0, 2);
    if (KIND_BY_PREFIX[prefix]) return KIND_BY_PREFIX[prefix];
  }

  if (typeof raw.kind === "string" && KIND_BY_PREFIX[raw.kind]) {
    return KIND_BY_PREFIX[raw.kind];
  }

  if (typeof raw.selftext === "string" || typeof raw.title === "string") {
    return "submission";
  }

  if (typeof raw.body === "string" && (raw.link_id || raw.parent_id)) {
    return "comment";
  }

  if (typeof raw.body === "string" && (raw.subject || raw.dest || raw.context)) {
    return "message";
  }

  return "unknown";
}

function base36Id(raw, fullname) {
  if (raw && raw.id !== undefined && raw.id !== null) {
    return String(raw.id);
  }
  if (typeof fullname === "string" && /^t[1-6]_/.test(fullname)) {
    return fullname.slice(3);
  }
  return null;
}

function bodyFor(raw, kind) {
  if (!raw || typeof raw !== "object") return null;

  if (kind === "submission") {
    return typeof raw.selftext === "string" ? raw.selftext : null;
  }

  if (typeof raw.body === "string") {
    return raw.body;
  }

  return null;
}

function normalizeRedditObject(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const kind = inferKind(source);
  const fullname = stringOrNull(source.name);

  return {
    schemaVersion: SCHEMA_VERSION,
    provider: "reddit",
    kind,
    id: base36Id(source, fullname),
    fullname,
    subreddit: stringOrNull(source.subreddit),
    author: stringOrNull(source.author),
    createdUtc: numberOrNull(source.created_utc),
    permalink: stringOrNull(source.permalink || source.context),
    url: stringOrNull(source.url),
    title: stringOrNull(source.title),
    body: bodyFor(source, kind),
    subject: stringOrNull(source.subject),
    parentFullname: stringOrNull(source.parent_id),
    linkFullname: stringOrNull(source.link_id),
    raw: source
  };
}

function normalizeRedditList(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeRedditObject);
}

module.exports = {
  SCHEMA_VERSION,
  inferKind,
  normalizeRedditObject,
  normalizeRedditList
};
