# node-red-contrib-node-reddit

> **SyzygyBlue maintained fork — modernization in progress**
>
> This fork preserves the upstream history from `jcostello93/node-red-contrib-node-reddit` while modernizing it into a reusable Reddit transport/adapter for current Node-RED and Node.js releases.
>
> Active development branch: `modernize/reddit-adapter`.
>
> The current upstream implementation is still version 1.0.11 and depends on legacy Reddit client libraries. Treat this fork as development software until the modernization acceptance tests pass.

## Overview

Interact with Reddit using [Node-RED](https://nodered.org).


## Authentication

The maintained fork supports three OAuth modes:

- **OAuth Refresh Token (Recommended)** — default for persistent Node-RED deployments.
- **Existing Access Token (Advanced)** — useful for testing or external token-management systems.
- **Legacy Script App (Username/Password)** — retained for compatibility with existing Reddit script-app deployments.

All secrets are registered with Node-RED's credential system. The connector does not intentionally emit passwords, client secrets, refresh tokens, or access tokens into normal messages.

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for configuration, security guidance, and machine-readable authentication error codes.

## Modernization goals

See [docs/MODERNIZATION_PLAN.md](docs/MODERNIZATION_PLAN.md) and [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md).

The initial target is deliberately narrow:

- current Node-RED 5 compatibility;
- Node.js 22 and 24 CI coverage;
- OAuth refresh-token authentication;
- caller-driven Reddit search/read operations with normalized results;
- reliable get/reply/create operations;
- explicit rate-limit and error metadata;
- testable behavior with durable downstream deduplication.

We will preserve upstream functionality where practical while keeping the package application-agnostic. The Ocular Warlock marketing pipeline is one intended consumer.

## Nodes

The inherited package provides:

- **Config:** authentication for the Reddit API
- **Stream:** stream submissions and comments from a subreddit or PMs from your inbox
- **Get:** retrieve submissions, comments, or private messages
- **Create:** create a Reddit submission or PM
- **Reply:** reply to a submission, comment, or PM
- **Search:** perform a Reddit search query in a subreddit
- **Edit:** edit a Reddit submission or comment
- **Delete:** delete a Reddit submission, comment, or PM
- **React:** save/unsave and vote/unvote on Reddit content

For inherited behavior details, see the [upstream wiki](https://github.com/jcostello93/node-red-contrib-node-reddit/wiki).

## Normalized read results

Search, Get, inbox, listing, and Stream-compatible read results use a stable application-neutral schema with common Reddit fields plus the original provider object under `raw`.

See [docs/NORMALIZED_READ_SCHEMA.md](docs/NORMALIZED_READ_SCHEMA.md) for the full contract and schema-versioning rules.

## Transport metadata

Successful operations expose HTTP/rate-limit metadata at `msg.reddit.response`. Input-triggered failures expose sanitized classification at `msg.reddit.error` and remain compatible with standard Node-RED Catch nodes.

The adapter reports whether a transport failure is technically retryable and surfaces Reddit/HTTP retry delays when available, but it does not perform automatic retries or choose workflow policy.

See [docs/TRANSPORT_METADATA.md](docs/TRANSPORT_METADATA.md) for the stable metadata contract.

## Adapter boundary



This package is responsible for Reddit mechanics only: authentication, execution of caller-supplied operations, normalization of Reddit objects, writes explicitly requested by the caller, and provider metadata such as IDs, rate limits, and errors.

The package does **not** choose search terms, choose subreddits, schedule discovery, classify results, score relevance, make promotion decisions, or apply application-specific business logic. Those responsibilities belong in the consuming Node-RED flow or application.

## Example flows

The inherited examples remain under [flows](flows/). They predate this modernization effort and should be treated as reference material until validated against current Node-RED and Reddit behavior.

## Upstream

Original project: https://github.com/jcostello93/node-red-contrib-node-reddit

## References

- [Reddit API docs](https://www.reddit.com/dev/api/)
- [Node-RED docs](https://nodered.org/docs/)
