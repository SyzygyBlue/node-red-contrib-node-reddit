# Reddit Authentication

This maintained fork supports three OAuth authentication modes.

Reddit currently requires OAuth for Data API authentication. Reddit also warns that some legacy API documentation may be outdated, so deployments should follow the current Developer Terms, Data API Terms, and Responsible Builder requirements.

## 1. OAuth Refresh Token — Recommended

Use this for normal persistent Node-RED deployments.

Required configuration:

- descriptive User-Agent;
- Reddit app Client ID;
- Reddit app Client Secret;
- Refresh Token.

The connector exchanges the refresh token for a short-lived bearer access token and caches that access token until it approaches expiration.

The refresh token remains inside Node-RED's credential store and is not added to normal messages.

### Why this is the default

A long-running Node-RED flow should not require a user password to obtain a new access token. Refresh-token OAuth separates authorization from normal runtime operation and is the preferred mode for new integrations.

## 2. Existing Access Token — Advanced

Use this when another trusted process has already obtained an OAuth access token.

Required configuration:

- descriptive User-Agent;
- Access Token.

Client ID and Client Secret are not required by this connector in this mode because no token exchange is performed.

The caller is responsible for replacing the token when it expires.

This is useful for:

- development;
- controlled tests;
- external token-management systems.

## 3. Legacy Script App — Username/Password

This mode is retained for compatibility with existing Reddit script applications that use the OAuth password grant.

Required configuration:

- descriptive User-Agent;
- Reddit app Client ID;
- Reddit app Client Secret;
- Reddit username;
- Reddit password.

The username/password pair is sent only to Reddit's OAuth token endpoint to obtain an access token. Normal Data API calls use the resulting bearer token.

### Compatibility status

This is **legacy compatibility mode**, not the recommended setup for a new integration.

Retaining it avoids breaking public Node-RED users with existing script-app deployments. New integrations should prefer refresh-token OAuth.

## Node-RED credential storage

The following values are registered as Node-RED credential properties:

- password;
- client ID;
- client secret;
- refresh token;
- access token.

They are not normal flow properties and are not intentionally emitted in `msg`.

For production Node-RED instances, configure a persistent `credentialSecret` so credential encryption remains recoverable across deployments.

## Machine-readable authentication failures

The connector places a sanitized failure descriptor at:

```text
msg.reddit.error
```

Possible authentication-related codes include:

- `AUTH_CONFIG` — missing/invalid connector configuration;
- `OAUTH_CLIENT_REQUIRED` — OAuth client credentials missing;
- `OAUTH_GRANT_REQUIRED` — no usable OAuth grant configured;
- `OAUTH_TOKEN_FAILED` — Reddit rejected the token exchange, including invalid refresh-token/password grants;
- `AUTH_FAILED` — Reddit rejected a bearer access token with HTTP 401.

The message metadata intentionally excludes passwords, client secrets, refresh tokens, access tokens, OAuth request bodies, and Authorization headers.

## User-Agent

Configure a descriptive User-Agent that identifies the integration. Do not use the default User-Agent of a generic HTTP library.

Example shape:

```text
node-red-contrib-node-reddit/1.1 by u/example-user
```

Use an identifier appropriate to your application/account.

## Current Reddit references

- Reddit Data API Wiki: https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki
- Reddit Data API reference: https://www.reddit.com/dev/api/
- Reddit Developer Terms: https://redditinc.com/policies/developer-terms
- Reddit Data API Terms: https://redditinc.com/policies/data-api-terms

## Future improvement

An interactive authorization-code setup flow ("Connect Reddit") would make refresh-token onboarding easier for public Node-RED users. That can be added without changing the runtime client contract established here.
