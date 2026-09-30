# node-red-contrib-node-reddit

> **SyzygyBlue maintained fork — modernization in progress**
>
> This fork preserves the upstream history from `jcostello93/node-red-contrib-node-reddit` while modernizing it for current Node-RED/Node.js releases and use as the Reddit adapter for the Ocular Warlock marketing automation pipeline.
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
- deterministic search/polling suitable for reader-request discovery;
- reliable get/reply/create operations;
- explicit rate-limit and error metadata;
- testable behavior with durable downstream deduplication.

We will preserve upstream functionality where practical, but the Ocular Warlock marketing pipeline is the primary production use case.

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

## Production direction

For Ocular Warlock reader-request discovery, the preferred pattern will be scheduled search/polling plus durable deduplication rather than the inherited Stream node.

The adapter will remain responsible for Reddit mechanics only. Story canon, opportunity scoring, promotion policy, human approval, and campaign telemetry belong in the larger Node-RED marketing flow.

## Example flows

The inherited examples remain under [flows](flows/). They predate this modernization effort and should be treated as reference material until validated against current Node-RED and Reddit behavior.

## Upstream

Original project: https://github.com/jcostello93/node-red-contrib-node-reddit

## References

- [Reddit API docs](https://www.reddit.com/dev/api/)
- [Node-RED docs](https://nodered.org/docs/)
