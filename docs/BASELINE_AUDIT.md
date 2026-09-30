# Baseline Compatibility and Dependency Audit

Issue: #2  
Branch: `modernize/reddit-adapter`  
Completed: 2026-09-30

## Runtime compatibility

The inherited package now has a CI baseline against:

- Node.js 22
- Node.js 24
- Node-RED 5.0.7

The CI workflow performs:

1. npm install;
2. JavaScript syntax checks;
3. Node-RED registration smoke tests;
4. dependency-tree inspection;
5. npm audit;
6. installation of Node-RED 5;
7. installation of this fork into a clean temporary Node-RED user directory;
8. startup of a real Node-RED runtime;
9. a Node-RED Admin API query for this module.

The runtime probe confirmed Node-RED loaded:

- module: `node-red-contrib-node-reddit`
- version: `1.0.11`
- node types:
  - `reddit-credentials`
  - `stream`
  - `get`
  - `create`
  - `reply`
  - `search`
  - `edit`
  - `delete`
  - `react`

CI run: https://github.com/SyzygyBlue/node-red-contrib-node-reddit/actions/runs/36707758073

## Dependency findings

The inherited runtime dependency tree currently installs successfully, but npm reports:

- 9 vulnerabilities total;
- 5 moderate;
- 2 high;
- 2 critical.

The vulnerable/deprecated chain is primarily inherited through `snoowrap` and its legacy HTTP stack.

Observed deprecated packages include:

- `snoowrap@1.23.0`;
- `request@2.88.2`;
- `request-promise@4.2.6`;
- `har-validator@5.1.5`;
- `uuid@3.4.0`.

Audit findings include:

- `form-data` — critical vulnerabilities via the legacy request stack;
- `qs` — moderate denial-of-service vulnerabilities;
- `tough-cookie` — moderate prototype-pollution vulnerability;
- `uuid` — moderate buffer-bounds vulnerability;
- `ws` — high-severity denial-of-service vulnerabilities.

These findings are not being treated as acceptable production risk. They are the primary motivation for Issue #3, which will isolate and replace or retire the inherited Reddit client stack.

## Lockfile decision

A permanent `package-lock.json` is **not committed yet**.

Reason: the current inherited dependency tree is known to contain deprecated and vulnerable packages and is expected to change materially in Issue #3. Committing a lockfile now would stabilize a dependency graph we already intend to replace.

CI does generate an ephemeral lockfile during installation so that `npm audit` can produce a deterministic report for each run.

After the client-layer decision in Issue #3, the maintained dependency tree should receive a committed lockfile and npm caching can be enabled safely.

## Baseline conclusion

There are no Node 22, Node 24, or Node-RED 5 loading blockers in the inherited Node-RED module itself.

The blocking production concern is dependency quality/security, not Node-RED runtime compatibility.

Next engineering task: Issue #3.
