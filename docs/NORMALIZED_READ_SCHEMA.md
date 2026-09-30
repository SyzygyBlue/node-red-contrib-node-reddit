# Normalized Reddit Read Schema

The adapter returns a stable application-neutral schema for Reddit objects obtained through read operations.

The purpose of normalization is to make downstream Node-RED flows easy to process without forcing them to understand Reddit wrapper classes or provider-specific field variations.

Normalization does **not** perform discovery, classification, scoring, filtering, or business decisions.

## Contract

Each normalized read object has this shape:

```json
{
  "schemaVersion": 1,
  "provider": "reddit",
  "kind": "submission",
  "id": "abc123",
  "fullname": "t3_abc123",
  "subreddit": "example",
  "author": "example-user",
  "createdUtc": 1790772000,
  "permalink": "/r/example/comments/abc123/example/",
  "url": "https://example.com/",
  "title": "Example title",
  "body": "Example body",
  "subject": null,
  "parentFullname": null,
  "linkFullname": null,
  "raw": {}
}
```

## Fields

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | integer | Version of this normalized adapter contract. |
| `provider` | string | Always `reddit`. |
| `kind` | string | `submission`, `comment`, `message`, or `unknown`. |
| `id` | string/null | Reddit base36 ID when available. |
| `fullname` | string/null | Reddit fullname such as `t3_abc123`. |
| `subreddit` | string/null | Subreddit name when applicable. |
| `author` | string/null | Reddit author name when available. |
| `createdUtc` | number/null | Reddit `created_utc` Unix timestamp. |
| `permalink` | string/null | Reddit permalink or message context when available. |
| `url` | string/null | Provider-supplied URL when applicable. |
| `title` | string/null | Submission title when applicable. |
| `body` | string/null | Submission self-text, comment body, or message body. |
| `subject` | string/null | Message subject when applicable. |
| `parentFullname` | string/null | Parent fullname when supplied by Reddit. |
| `linkFullname` | string/null | Associated submission fullname when supplied by Reddit. |
| `raw` | object | Original Reddit object returned by the Data API. |

Fields are intentionally present with `null` when unavailable so downstream indexing, database mapping, and JSON processing can use a stable shape.

## Read operations

The normalized contract applies to read results returned by:

- Search;
- subreddit/home submission listings;
- user submissions;
- subreddit/user comments;
- comments on a submission;
- Get submission by ID;
- Get comment by ID;
- inbox/messages;
- saved/upvoted/downvoted/gilded/hidden listings;
- Stream-compatible polling batches.

Identity information returned internally by `/api/v1/me` is not a normalized content object.

Write-operation responses are not covered by this schema; their stable response contract is handled separately.

## Search separation of concerns

Search accepts parameters supplied by the caller:

- query;
- subreddit;
- sort;
- time;
- limit.

The adapter sends those values to Reddit. It does not:

- invent keywords;
- expand queries;
- choose subreddits;
- schedule searches;
- classify returned content;
- rank relevance;
- infer business intent;
- decide whether a result should trigger another action.

## Raw payload

The `raw` field preserves the provider response object so downstream consumers can reach Reddit-specific properties without forcing those properties into the stable adapter contract.

Consumers should prefer normalized fields for common processing and use `raw` only when a Reddit-specific property is required.

## Schema evolution

Breaking changes to normalized fields require incrementing `schemaVersion`. Adding a new nullable field may be done compatibly when it does not change existing field semantics.
