# Modernization Plan

## Purpose

Modernize the inherited Node-RED Reddit nodes into a dependable, reusable Reddit transport/adapter while preserving upstream provenance. The Ocular Warlock marketing pipeline is an initial consumer, not part of the adapter's domain logic.

## Principles

1. Preserve `master` as the upstream baseline until a modernized release is ready.
2. Use OAuth; prefer refresh-token OAuth while retaining legacy script-app compatibility.
3. Execute only caller-supplied Reddit operations and parameters; do not invent discovery/search strategy.
4. Return stable, normalized Reddit objects while preserving provider-specific raw data.
5. Expose errors and Reddit rate-limit state as structured message metadata.
6. Keep application classification, scoring, scheduling, policy, deduplication, and business logic outside the adapter.
7. Add tests before materially changing behavior.

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
- [x] Label username/password script-app authentication as legacy compatibility in the editor.
- [x] Evaluate replacement of deprecated `snoowrap`.
- [x] Replace `snoowrap`/`snoostorm-es6` completely with the native fetch client.
- [x] Ensure credentials never appear in normal Node-RED messages or logs.
- [x] Add authentication failure tests.

## Phase 2 — Read result normalization

- [x] Define a stable schema for submissions, comments, and messages.
- [x] Normalize Search and Get results into stable message fields.
- [x] Surface IDs/fullnames, subreddit, author, timestamps, permalink, title/body, and raw payload where applicable.
- [x] Keep pagination/limit controls explicit and caller-controlled.
- [x] Ensure Search executes only caller-supplied query/subreddit/sort/time parameters.
- [x] Ensure empty result sets return cleanly.
- [x] Verify no query generation, discovery, classification, scoring, or application-specific logic exists in the adapter.

## Phase 3 — Deployment actions

- [ ] Validate Get by submission/comment ID.
- [ ] Validate Reply to a controlled test thread.
- [ ] Validate Create where required.
- [ ] Validate Edit/Delete for rollback of our own test content.
- [ ] Return stable IDs and permalinks after write operations.
- [x] Make write failures machine-readable.

## Phase 4 — Reliability

- [x] Add retry classification for 429, transient 5xx, auth failures, and permanent 4xx.
- [ ] Add idempotency guidance for downstream workflows.
- [x] Add structured transport metadata suitable for external telemetry and persistence.
- [x] Add unit tests around error parsing and message normalization.
- [x] Add Node-RED runtime integration tests.

## Phase 5 — Application integration boundary

This repository remains a reusable Reddit adapter and must not contain application-specific discovery or decision logic.

Consuming Node-RED applications provide:

- query/search strategy;
- scheduling;
- classification and scoring;
- business or story context;
- policy decisions;
- application-level deduplication;
- human approval;
- telemetry and persistence.

This adapter provides:

- authenticated Reddit reads;
- execution of explicit caller-supplied operations;
- normalized Reddit objects;
- caller-supplied Reddit writes;
- rate-limit/error metadata;
- stable IDs for observability and rollback.

## Out of scope initially

- Autonomous unsolicited promotion.
- General-purpose Reddit bot behavior.
- Production use of the inherited Stream node.
- Re-implementing marketing scoring inside this package.
