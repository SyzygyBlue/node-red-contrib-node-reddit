# Transport Metadata and Error Contract

The Reddit adapter reports transport facts in a stable machine-readable form. It does **not** decide retry schedules, perform automatic retries, or apply workflow policy.

## Separation of concerns

The adapter reports:

- HTTP status;
- request method and API endpoint;
- Reddit/request correlation ID when available;
- Reddit rate-limit headers;
- Retry-After when supplied;
- failure category;
- whether a failure is technically retryable.

The consuming Node-RED flow decides:

- whether to retry;
- when to retry;
- how many attempts to make;
- whether to alert;
- whether to abandon the operation;
- whether a failure has application significance.

## Successful request metadata

After a successful Reddit API operation, the output message contains:

```json
{
  "reddit": {
    "response": {
      "status": 200,
      "ok": true,
      "method": "GET",
      "endpoint": "/r/example/search",
      "requestId": null,
      "rateLimit": {
        "used": 3,
        "remaining": 97,
        "resetSeconds": 412
      },
      "retryAfterSeconds": null
    }
  }
}
```

Header-derived fields are `null` when Reddit does not supply them.

The adapter intentionally records the API endpoint path rather than the complete URL/query string. This avoids unnecessarily echoing caller content into telemetry.

## Error metadata

When an input-triggered node operation fails, the original message passed to Node-RED's standard error handling contains:

```json
{
  "reddit": {
    "error": {
      "code": "RATE_LIMITED",
      "category": "rate_limit",
      "status": 429,
      "retryable": true,
      "retryAfterSeconds": 30,
      "rateLimit": {
        "used": 100,
        "remaining": 0,
        "resetSeconds": 30
      },
      "requestId": null,
      "method": "GET",
      "endpoint": "/r/example/search"
    }
  }
}
```

The node still calls `node.error(message, msg)`, so standard Node-RED Catch nodes continue to work.

## Classification

| Condition | code | category | retryable |
|---|---|---|---|
| HTTP 401 | `AUTH_FAILED` | `authentication` | false |
| HTTP 403 | `PERMISSION_DENIED` | `permission` | false |
| HTTP 429 | `RATE_LIMITED` | `rate_limit` | true |
| Reddit `RATELIMIT` API error | `RATE_LIMITED` | `rate_limit` | true |
| HTTP 5xx | `SERVER_ERROR` | `server` | true |
| Other HTTP 4xx | `CLIENT_ERROR` | `client` | false |
| Other Reddit JSON API errors | `REDDIT_API_ERROR` | `reddit_api` | false |
| Unclassified adapter failure | `REDDIT_ERROR` or specific local code | `unknown` | false |

`retryable` means only that the transport failure is generally transient enough that a caller may choose to retry. It is not an instruction to retry.

## Retry delay

For a rate-limit response, `retryAfterSeconds` is chosen from:

1. HTTP `Retry-After`, when numeric;
2. Reddit `x-ratelimit-reset`, when available.

For 5xx responses, a numeric HTTP `Retry-After` is surfaced when supplied.

The adapter does not invent exponential-backoff intervals.

## Security

Transport metadata excludes:

- Authorization headers;
- access tokens;
- refresh tokens;
- passwords;
- client secrets;
- OAuth token request bodies;
- complete request URLs containing query text.

The endpoint field is the API path only.

## OAuth token exchange failures

OAuth token exchange errors continue to use codes such as `OAUTH_TOKEN_FAILED`. They are sanitized before being attached to Node-RED messages. A rejected refresh-token exchange is not automatically retried by this adapter.
