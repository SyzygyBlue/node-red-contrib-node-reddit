# Acceptance Tests

These tests define when the maintained fork is safe to use as the Reddit adapter in the Ocular Warlock marketing pipeline.

## A. Installation and Node-RED loading

- [ ] `npm install` succeeds on Node.js 22.
- [ ] `npm install` succeeds on Node.js 24.
- [ ] `npm test` passes on Node.js 22.
- [ ] `npm test` passes on Node.js 24.
- [ ] Node-RED 5 starts with the package installed.
- [ ] All expected node types appear in the editor.

Expected registered types:

- `reddit-credentials`
- `get`
- `reply`
- `search`
- `create`
- `stream`
- `edit`
- `delete`
- `react`

## B. OAuth

Use a dedicated Reddit application/account suitable for testing.

- [ ] Refresh-token authentication succeeds.
- [ ] Invalid refresh token produces a structured authentication error.
- [ ] No secret is emitted into `msg`, Debug output, or normal logs.
- [ ] Username/password authentication is not required for production use.

## C. Read/search acceptance

Against a controlled or public subreddit where API access is permitted:

- [ ] Search returns current submissions for a known query.
- [ ] A no-match query returns a clean empty result.
- [ ] Get-by-submission-ID returns the expected submission.
- [ ] Get-by-comment-ID returns the expected comment.
- [ ] Returned objects contain stable Reddit IDs.
- [ ] Permalink/subreddit/author/timestamp/title/body fields can be normalized reliably.
- [ ] API/rate-limit state is observable.

## D. Write acceptance

Only use content/accounts we control for these tests.

- [ ] Reply to a controlled test submission.
- [ ] Returned result contains the created comment ID.
- [ ] Fetch the created reply and confirm its content.
- [ ] Edit the reply and verify the new content.
- [ ] Delete the reply and verify rollback behavior.
- [ ] A forbidden write returns a structured permanent error rather than a generic 403.

## E. Reliability

- [ ] 429 responses are distinguishable from other failures.
- [ ] Retryable 5xx errors are distinguishable from permanent failures.
- [ ] Duplicate polling results can be deduplicated downstream by stable ID.
- [ ] Restarting/redeploying Node-RED does not itself cause duplicate deployment actions.
- [ ] Errors can be caught with standard Node-RED Catch nodes.

## F. Marketing-pipeline readiness

- [ ] Search/polling can run on a schedule without Stream.
- [ ] Candidate events can be passed into an external classifier unchanged.
- [ ] Human approval can occur before a Reply/Create node receives a message.
- [ ] Every successful write returns enough metadata to record a deployment in PostgreSQL.
- [ ] Every failed write returns enough metadata to classify and audit the failure.

Passing sections A–F is the gate for using this fork in production marketing flows.
