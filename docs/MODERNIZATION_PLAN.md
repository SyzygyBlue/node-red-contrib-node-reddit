# Modernization Plan

## Purpose

Modernize the inherited Node-RED Reddit nodes into a dependable Reddit adapter for the Ocular Warlock marketing CI/CD pipeline while preserving upstream provenance.

## Principles

1. Preserve `master` as the upstream baseline until a modernized release is ready.
2. Use OAuth; do not rely on username/password authentication.
3. Prefer deterministic polling/search plus downstream deduplication over the inherited streaming implementation.
4. Expose errors and Reddit rate-limit state as structured message metadata.
5. Keep platform-specific mechanics in this adapter; keep marketing scoring/canon/policy logic outside it.
6. Add tests before materially changing behavior.

## Target runtime

- Node-RED 5.x
- Node.js 22.9+ and Node.js 24
- Linux/Docker as the primary deployment environment

## Phase 0 — Baseline

- [x] Preserve upstream fork relationship.
- [x] Create modernization branch.
- [x] Add CI baseline.
- [x] Add module registration smoke test.
- [x] Define live acceptance tests.
- [x] Run CI on Node 22 and 24.
- [x] Capture dependency audit results.

## Phase 1 — Authentication and client layer

- [x] Make OAuth refresh-token authentication the primary supported mode while retaining legacy script-app compatibility.
- [ ] Deprecate username/password authentication in the editor.
- [x] Evaluate replacement of deprecated `snoowrap`.
- [x] Replace `snoowrap`/`snoostorm-es6` completely with the native fetch client.
- [x] Ensure credentials never appear in normal Node-RED messages or logs.
- [x] Add authentication failure tests.

## Phase 2 — Reader-request ingestion

- [ ] Validate subreddit search on current Reddit API behavior.
- [ ] Normalize search results into stable message fields.
- [ ] Surface post/comment IDs, subreddit, author, timestamps, permalink, title, body, and raw payload.
- [ ] Add pagination/limit controls.
- [ ] Surface rate-limit headers/metadata.
- [ ] Document recommended polling cadence.
- [ ] Do not rely on Stream for production reader-request discovery.

## Phase 3 — Deployment actions

- [ ] Validate Get by submission/comment ID.
- [ ] Validate Reply to a controlled test thread.
- [ ] Validate Create where required.
- [ ] Validate Edit/Delete for rollback of our own test content.
- [ ] Return stable IDs and permalinks after write operations.
- [ ] Make write failures machine-readable.

## Phase 4 — Reliability

- [ ] Add retry classification for 429, transient 5xx, auth failures, and permanent 4xx.
- [ ] Add idempotency guidance for downstream workflows.
- [ ] Add structured status output suitable for PostgreSQL telemetry.
- [ ] Add unit tests around error parsing and message normalization.
- [ ] Add Node-RED runtime integration tests.

## Phase 5 — Ocular Warlock integration

This repository should remain a Reddit adapter, not contain story-specific marketing intelligence.

The larger Node-RED flow will provide:

- opportunity qualification;
- Ocular Warlock canon context;
- subreddit/promotion policy;
- duplicate-deployment checking;
- human approval;
- marketing telemetry.

This adapter will provide:

- authenticated Reddit reads;
- normalized Reddit objects;
- approved Reddit writes;
- rate-limit/error metadata;
- stable IDs for observability and rollback.

## Out of scope initially

- Autonomous unsolicited promotion.
- General-purpose Reddit bot behavior.
- Production use of the inherited Stream node.
- Re-implementing marketing scoring inside this package.
