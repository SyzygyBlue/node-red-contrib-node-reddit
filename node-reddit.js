"use strict";

const { RedditClient } = require("./lib/reddit-client");

module.exports = function(RED) {
  function getPath(obj, path) {
    return String(path || "")
      .split(".")
      .reduce((value, key) => value == null ? undefined : value[key], obj);
  }

  function parseField(msg, nodeProp) {
    const value = nodeProp == null ? "" : String(nodeProp);
    if (!value.includes("{{")) return nodeProp;
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => {
      const resolved = getPath(msg, path.trim());
      return resolved == null ? "" : String(resolved);
    });
  }

  function parseLimit(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function truthy(value) {
    return value === true || value === "true";
  }

  function cloneListAsMessages(items, msg) {
    return items.map(item => {
      const cloned = RED.util.cloneMessage(msg);
      cloned.payload = item;
      return cloned;
    });
  }

  function authConfigError(message) {
    const err = new Error(message);
    err.code = "AUTH_CONFIG";
    return err;
  }

  function clientOptions(n) {
    const config = RED.nodes.getNode(n.reddit);
    if (!config) throw authConfigError("Reddit credentials configuration is missing.");

    const credentials = config.credentials || {};
    const authType = config.auth_type || (config.username ? "username_password" : "refresh_token");
    const userAgent = config.user_agent;

    if (!userAgent) {
      throw authConfigError("A descriptive Reddit user agent is required.");
    }

    if (authType === "refresh_token") {
      if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
        throw authConfigError("Refresh-token OAuth requires client ID, client secret, and refresh token.");
      }
      return {
        userAgent,
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        refreshToken: credentials.refresh_token
      };
    }

    if (authType === "access_token") {
      if (!credentials.access_token) {
        throw authConfigError("Access-token authentication requires an access token.");
      }
      return {
        userAgent,
        accessToken: credentials.access_token
      };
    }

    if (authType === "username_password") {
      if (!credentials.client_id || !credentials.client_secret || !config.username || !credentials.password) {
        throw authConfigError("Legacy script-app authentication requires client ID, client secret, username, and password.");
      }
      return {
        userAgent,
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        username: config.username,
        password: credentials.password
      };
    }

    throw authConfigError(`Unsupported Reddit authentication mode: ${authType}`);
  }

  function createClient(n) {
    return new RedditClient(clientOptions(n));
  }

  function reportError(node, msg, err) {
    const message = err && err.message ? err.message : String(err);
    const errorMeta = {
      code: err && err.code ? err.code : "REDDIT_ERROR"
    };

    if (Number.isInteger(err && err.status)) {
      errorMeta.status = err.status;
    }
    if (Array.isArray(err && err.apiErrors) && err.apiErrors.length) {
      errorMeta.apiErrors = err.apiErrors;
    }
    if (err && err.meta && err.meta.rateLimit) {
      errorMeta.rateLimit = err.meta.rateLimit;
    }

    msg.reddit = msg.reddit || {};
    msg.reddit.error = errorMeta;

    node.status({ fill: "red", shape: "dot", text: "error" });
    node.error(message, msg);
  }

  function ConfigNode(n) {
    RED.nodes.createNode(this, n);
    this.username = n.username;
    this.user_agent = n.user_agent;
    this.auth_type = n.auth_type || (n.username ? "username_password" : "refresh_token");
    this.name = n.name;
  }

  RED.nodes.registerType("reddit-credentials", ConfigNode, {
    credentials: {
      password: { type: "password" },
      client_id: { type: "password" },
      client_secret: { type: "password" },
      refresh_token: { type: "password" },
      access_token: { type: "password" }
    }
  });

  function GetNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});
    node.on("input", async function(msg) {
      node.status({ fill: "blue", shape: "dot", text: "loading" });

      try {
        const contentType = n.content_type;
        const subreddit = parseField(msg, n.subreddit) || "";
        const user = parseField(msg, n.user);
        const contentId = parseField(msg, n.content_id);
        const limit = parseLimit(n.limit, 25);
        const depth = parseLimit(n.depth, 1);
        const fetchAll = truthy(n.fetch_all);
        let items;
        let statusText;

        if (contentType === "submission") {
          if (n.submission_source === "subreddit") {
            items = await client.submissions({
              subreddit,
              sort: n.sort,
              time: n.time,
              limit,
              fetchAll: false
            });
            statusText = subreddit ? `r/${subreddit}/${n.sort}` : `home/${n.sort}`;
          } else if (n.submission_source === "user") {
            items = await client.userSubmissions({ user, limit, fetchAll });
            statusText = `u/${user}`;
          } else if (n.submission_source === "id") {
            msg.payload = await client.getThing("submission", contentId);
            node.status({ fill: "green", shape: "dot", text: contentId });
            node.send(msg);
            return;
          }
        } else if (contentType === "comment") {
          if (n.comment_source === "subreddit") {
            items = await client.subredditComments({ subreddit, limit });
            statusText = subreddit ? `r/${subreddit}` : "home";
          } else if (n.comment_source === "user") {
            items = await client.userComments({ user, limit, fetchAll });
            statusText = `u/${user}`;
          } else if (n.comment_source === "submission") {
            items = await client.submissionComments({
              submissionId: contentId,
              limit,
              depth,
              fetchAll
            });
            statusText = contentId;
          } else if (n.comment_source === "id") {
            msg.payload = await client.getThing("comment", contentId);
            node.status({ fill: "green", shape: "dot", text: contentId });
            node.send(msg);
            return;
          }
        } else if (contentType === "pm") {
          if (n.pm_source === "inbox") {
            items = await client.inbox({ limit, fetchAll });
            statusText = "inbox";
          } else if (n.pm_source === "id") {
            msg.payload = await client.getMessage(contentId);
            node.status({ fill: "green", shape: "dot", text: contentId });
            node.send(msg);
            return;
          }
        } else if (contentType === "content") {
          items = await client.content({ source: n.content_source, limit });
          statusText = n.content_source;
        }

        if (!Array.isArray(items)) {
          throw new Error("Unsupported Get node configuration.");
        }

        node.status({ fill: "green", shape: "dot", text: statusText || "success" });
        node.send([cloneListAsMessages(items, msg)]);
      } catch (err) {
        reportError(node, msg, err);
      }
    });
  }

  RED.nodes.registerType("get", GetNode);

  function ReplyNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});
    node.on("input", async function(msg) {
      try {
        const kind = n.content_type === "pm" ? "message" : n.content_type;
        const contentId = parseField(msg, n.content_id);
        const text = parseField(msg, n.text);

        node.status({ fill: "blue", shape: "dot", text: n.content_type });
        msg.payload = await client.reply({ kind, id: contentId, text });
        node.status({
          fill: "green",
          shape: "dot",
          text: msg.payload && msg.payload.name ? msg.payload.name : "replied"
        });
        node.send(msg);
      } catch (err) {
        reportError(node, msg, err);
      }
    });
  }

  RED.nodes.registerType("reply", ReplyNode);

  function SearchNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});
    node.on("input", async function(msg) {
      const subreddit = parseField(msg, n.subreddit) || "";
      try {
        node.status({
          fill: "blue",
          shape: "dot",
          text: subreddit ? `r/${subreddit}` : "searching"
        });

        const items = await client.search({
          subreddit,
          query: parseField(msg, n.query),
          sort: n.sort,
          time: n.time,
          limit: parseLimit(n.limit, 25)
        });

        node.status({
          fill: "green",
          shape: "dot",
          text: subreddit ? `r/${subreddit}` : "success"
        });
        node.send([cloneListAsMessages(items, msg)]);
      } catch (err) {
        reportError(node, msg, err);
      }
    });
  }

  RED.nodes.registerType("search", SearchNode);

  function CreateNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});
    node.on("input", async function(msg) {
      try {
        node.status({
          fill: "blue",
          shape: "dot",
          text: n.submissionType === "pm" ? "sending" : "submitting"
        });

        msg.payload = await client.create({
          type: n.submissionType,
          subreddit: parseField(msg, n.subreddit),
          title: parseField(msg, n.title),
          url: parseField(msg, n.url),
          text: parseField(msg, n.text),
          original: parseField(msg, n.original),
          recipient: parseField(msg, n.recipient),
          subject: parseField(msg, n.subject),
          message: parseField(msg, n.message)
        });

        const display = msg.payload && (msg.payload.name || msg.payload.id);
        node.status({
          fill: "green",
          shape: "dot",
          text: display ? `success: ${display}` : "success"
        });
        node.send(msg);
      } catch (err) {
        reportError(node, msg, err);
      }
    });
  }

  RED.nodes.registerType("create", CreateNode);

  function StreamNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;
    let intervalHandle = null;
    let timeoutHandle = null;
    let running = false;
    const seen = new Set();

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});

    function remember(name) {
      if (!name) return;
      seen.add(name);
      if (seen.size > 2000) {
        const oldest = seen.values().next().value;
        seen.delete(oldest);
      }
    }

    async function poll() {
      if (running) return;
      running = true;
      try {
        const items = await client.streamBatch({
          kind: n.kind,
          subreddit: n.subreddit,
          filter: n.filter,
          limit: n.kind === "PMs" ? 25 : 100
        });

        let emitted = 0;
        for (const item of [...items].reverse()) {
          const key = item && (item.name || item.id);
          if (key && seen.has(key)) continue;
          remember(key);

          node.send({ payload: item });
          emitted += 1;

          if (n.kind === "PMs" && n.markedAsRead && item && item.name) {
            await client.markRead(item.name);
          }
        }

        node.status({
          fill: "blue",
          shape: "dot",
          text: `${n.kind}: +${emitted}`
        });
      } catch (err) {
        reportError(node, {}, err);
      } finally {
        running = false;
      }
    }

    function stop() {
      if (intervalHandle) clearInterval(intervalHandle);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      intervalHandle = null;
      timeoutHandle = null;
      node.status({ fill: "green", shape: "dot", text: "stopped" });
    }

    function start() {
      stop();
      const pollMs = Math.max(1000, parseLimit(n.pollTime, 2) * 1000);
      poll();
      intervalHandle = setInterval(poll, pollMs);

      if (n.timeout !== "") {
        const timeoutSeconds = Number.parseInt(n.timeout, 10);
        if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
          timeoutHandle = setTimeout(stop, timeoutSeconds * 1000);
        }
      }
    }

    node.on("input", start);
    node.on("close", stop);

    if (n.kind === "PMs" || (n.kind && n.subreddit)) {
      setImmediate(start);
    }
  }

  RED.nodes.registerType("stream", StreamNode);

  function EditNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});
    node.on("input", async function(msg) {
      try {
        const kind = n.content_type;
        node.status({ fill: "blue", shape: "dot", text: `editing ${kind}` });
        msg.payload = await client.edit({
          kind,
          id: parseField(msg, n.content_id),
          text: parseField(msg, n.edit_content)
        });
        node.status({ fill: "green", shape: "dot", text: `${kind} edited` });
        node.send(msg);
      } catch (err) {
        reportError(node, msg, err);
      }
    });
  }

  RED.nodes.registerType("edit", EditNode);

  function DeleteNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});
    node.on("input", async function(msg) {
      try {
        const kind = n.content_type;
        node.status({ fill: "blue", shape: "dot", text: `deleting ${kind}` });
        msg.payload = await client.delete({
          kind,
          id: parseField(msg, n.content_id)
        });
        node.status({ fill: "green", shape: "dot", text: `${kind} deleted` });
        node.send(msg);
      } catch (err) {
        reportError(node, msg, err);
      }
    });
  }

  RED.nodes.registerType("delete", DeleteNode);

  function ReactNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;
    let client;

    try {
      client = createClient(n);
    } catch (err) {
      node.error(err.message);
      return;
    }

    node.status({});
    node.on("input", async function(msg) {
      try {
        const kind = n.content_type;
        node.status({ fill: "blue", shape: "dot", text: `updating ${kind}` });
        msg.payload = await client.react({
          kind,
          id: parseField(msg, n.content_id),
          vote: n.vote,
          save: n.save
        });
        node.status({ fill: "green", shape: "dot", text: `${kind} updated` });
        node.send(msg);
      } catch (err) {
        reportError(node, msg, err);
      }
    });
  }

  RED.nodes.registerType("react", ReactNode);
};
