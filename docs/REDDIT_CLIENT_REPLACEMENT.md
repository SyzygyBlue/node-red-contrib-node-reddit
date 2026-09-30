# Reddit Client Replacement Decision

Issue: #3  
Branch: `modernize/reddit-adapter`

## Decision

Remove `snoowrap` and `snoostorm-es6` completely.

The maintained fork now uses the native `fetch()` implementation provided by the supported Node.js runtime. The Reddit-specific transport and OAuth behavior live in `lib/reddit-client.js`.

This is preferable to adopting another wrapper because:

1. the production API surface we need is small;
2. Node.js 22+ already supplies HTTP/fetch primitives;
3. Reddit's Data API is HTTP/OAuth based;
4. the inherited wrapper stack pulled in deprecated request libraries and known vulnerabilities;
5. a direct adapter makes Reddit API behavior, rate limiting, and failures visible to Node-RED rather than hiding them behind a stale wrapper.

## Removed runtime dependencies

The following inherited dependencies are no longer required:

- `snoowrap`
- `snoostorm-es6`
- `mustache`

Removing `snoowrap` also removes its legacy transitive request stack from this package:

- `request`
- `request-promise`
- `request-promise-core`
- vulnerable legacy `form-data`, `ws`, `qs`, `tough-cookie`, and `uuid` versions pulled through that graph

The package has no runtime npm dependencies at this stage.

## Original call inventory and replacement mapping

| Inherited wrapper behavior | Native client behavior |
|---|---|
| `getHot` | GET `[/r/subreddit]/hot` |
| `getNew` | GET `[/r/subreddit]/new` |
| `getRising` | GET `[/r/subreddit]/rising` |
| `getTop` | GET `[/r/subreddit]/top` |
| `getControversial` | GET `[/r/subreddit]/controversial` |
| `getUser(user).getSubmissions` | GET `/user/{user}/submitted` |
| `getUser(user).getComments` | GET `/user/{user}/comments` |
| `getSubmission(id).fetch` | GET `/api/info?id=t3_...` |
| `getComment(id).fetch` | GET `/api/info?id=t1_...` |
| `getSubreddit(sr).getNewComments` | GET `/r/{sr}/comments` |
| `getSubmission(id).expandReplies` | GET `/comments/{id}` |
| `getInbox` | GET `/message/inbox` |
| `getMessage(id).fetch` | documented inbox listing + fullname match |
| `getMe()` | GET `/api/v1/me` |
| saved/upvoted/downvoted/gilded/hidden listings | GET `/user/{me}/{listing}` |
| `getSubreddit(sr).search` | GET `/r/{sr}/search` |
| `.reply()` | POST `/api/comment` |
| `submitSelfpost` | POST `/api/submit` with `kind=self` |
| `submitLink` | POST `/api/submit` with `kind=link` |
| `submitCrosspost` | POST `/api/submit` with crosspost fields |
| `composeMessage` | POST `/api/compose` |
| `.edit()` | POST `/api/editusertext` |
| `.delete()` Link/Comment | POST `/api/del` |
| `deleteFromInbox` | POST `/api/del_msg` |
| `.upvote/.downvote/.unvote` | POST `/api/vote` |
| `.save/.unsave` | POST `/api/save`, `/api/unsave` |
| `markAsRead` | POST `/api/read_message` |
| `snoostorm.Stream` | scheduled native API polling with stable-ID deduplication |

## Authentication boundary

`RedditClient` currently accepts:

- an existing access token;
- client id/client secret + refresh token;
- the inherited username/password grant temporarily for compatibility.

The username/password grant remains only so Issue #3 does not combine API-client replacement with the authentication UX migration. Issue #4 will make refresh-token OAuth the supported production path and deprecate/remove username/password authentication.

OAuth token requests are made directly to Reddit's token endpoint. API requests use `https://oauth.reddit.com` and include the configured descriptive user agent.

## Stream replacement

The inherited Stream node depended on `snoostorm-es6`, which implemented streams by polling.

The maintained fork now performs that polling itself:

- submissions: new listing;
- comments: subreddit comments listing;
- PMs: inbox/unread listing;
- stable Reddit IDs are retained in an in-memory seen set to prevent repeat emission during a running Node-RED process.

Issue #8 will separately decide how prominently the Stream node should remain supported for production marketing use. Reader-request discovery will prefer scheduled Search/Get flows with durable PostgreSQL deduplication.

## Message lookup

Reddit's documented `/api/info` endpoint supports Links and Comments but not private Messages. Rather than depend on undocumented message-by-id behavior, `getMessage` searches the authenticated user's documented inbox listing for the requested `t4_` fullname.

This is intentionally conservative. Private-message behavior is not part of the Ocular Warlock reader-acquisition critical path.

## Tests

The replacement includes:

- Node registration smoke tests;
- native client tests with injected/mock `fetch`;
- OAuth refresh-token exchange test;
- search/listing test;
- Reply/Create/Edit/Delete/Vote/Save endpoint contract tests;
- API error test;
- a regression test that fails if legacy Reddit client dependency tokens return;
- real Node-RED 5 module-load testing in GitHub Actions on Node 22 and Node 24.

Live Reddit network acceptance remains Issue #7 because that requires an approved Reddit app/account and real OAuth credentials.

## API references

- https://www.reddit.com/dev/api/
- https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki
- https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data
