"use strict";

const { normalizeRedditObject, normalizeRedditList } = require("./reddit-normalize");
const { classifyFailure, buildResponseMeta } = require("./reddit-meta");

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";
const DEFAULT_LIMIT = 25;
const MAX_PAGE = 100;
const MAX_FETCH_ALL = 1000;

class RedditApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "RedditApiError";
    Object.assign(this, details);
  }
}

function fullname(id, kind) {
  if (!id) {
    throw new RedditApiError("A Reddit content id is required.", { code: "INVALID_ID" });
  }
  if (/^t[1-6]_/.test(id)) return id;
  const prefixes = {
    comment: "t1_",
    submission: "t3_",
    link: "t3_",
    pm: "t4_",
    private_message: "t4_",
    message: "t4_"
  };
  const prefix = prefixes[kind];
  if (!prefix) {
    throw new RedditApiError(`Unsupported Reddit content type: ${kind}`, { code: "INVALID_TYPE" });
  }
  return prefix + id;
}

function id36(id) {
  return String(id || "").replace(/^t[1-6]_/, "");
}

function listingChildren(payload) {
  const listing = payload && payload.data ? payload : null;
  if (!listing || !Array.isArray(listing.data.children)) return [];
  return listing.data.children.map(child => child && child.data ? child.data : child);
}

class RedditClient {
  constructor(options = {}) {
    this.userAgent = options.userAgent;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshToken = options.refreshToken;
    this.accessToken = options.accessToken;
    this.username = options.username;
    this.password = options.password;
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.apiBase = options.apiBase || API_BASE;
    this.tokenUrl = options.tokenUrl || TOKEN_URL;
    this._cachedToken = null;
    this._tokenExpiresAt = 0;
    this.lastResponseMeta = null;

    if (typeof this.fetch !== "function") {
      throw new RedditApiError("Global fetch() is unavailable. Node.js 22+ is required.", {
        code: "FETCH_UNAVAILABLE"
      });
    }
    if (!this.userAgent) {
      throw new RedditApiError("A descriptive Reddit user agent is required.", {
        code: "USER_AGENT_REQUIRED"
      });
    }
  }

  async _getAccessToken() {
    if (this.accessToken) return this.accessToken;

    if (this._cachedToken && Date.now() < this._tokenExpiresAt - 60000) {
      return this._cachedToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new RedditApiError("Reddit client id and client secret are required for OAuth.", {
        code: "OAUTH_CLIENT_REQUIRED"
      });
    }

    const form = new URLSearchParams();
    if (this.refreshToken) {
      form.set("grant_type", "refresh_token");
      form.set("refresh_token", this.refreshToken);
    } else if (this.username && this.password) {
      // Legacy script-app compatibility: obtain an OAuth access token using the password grant.
      form.set("grant_type", "password");
      form.set("username", this.username);
      form.set("password", this.password);
    } else {
      throw new RedditApiError("A refresh token or access token is required.", {
        code: "OAUTH_GRANT_REQUIRED"
      });
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    let response;
    try {
      response = await this.fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": this.userAgent
        },
        body: form
      });
    } catch (cause) {
      throw new RedditApiError("Reddit OAuth network request failed.", {
        code: "NETWORK_ERROR",
        category: "network",
        retryable: true,
        retryAfterSeconds: null,
        meta: {
          status: null,
          ok: false,
          method: "POST",
          endpoint: "/api/v1/access_token",
          requestId: null,
          rateLimit: { used: null, remaining: null, resetSeconds: null },
          retryAfterSeconds: null
        },
        cause
      });
    }

    const tokenMeta = buildResponseMeta(response, {
      method: "POST",
      endpoint: "/api/v1/access_token"
    });
    this.lastResponseMeta = tokenMeta;

    const payload = await this._parseResponse(response);
    if (!response.ok || !payload || !payload.access_token) {
      const classification = classifyFailure({
        status: response.status,
        headers: response.headers
      });
      throw new RedditApiError(
        payload && payload.error ? `Reddit OAuth error: ${payload.error}` : "Reddit OAuth token request failed.",
        {
          code: "OAUTH_TOKEN_FAILED",
          category: classification.category === "client" ? "authentication" : classification.category,
          retryable: classification.retryable,
          retryAfterSeconds: classification.retryAfterSeconds,
          status: response.status,
          payload,
          meta: tokenMeta
        }
      );
    }

    this._cachedToken = payload.access_token;
    this._tokenExpiresAt = Date.now() + (Number(payload.expires_in || 3600) * 1000);
    return this._cachedToken;
  }

  async _parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async request(path, options = {}) {
    const token = await this._getAccessToken();
    const url = new URL(path, this.apiBase);
    const query = { raw_json: 1, ...(options.query || {}) };
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = {
      "Authorization": `Bearer ${token}`,
      "User-Agent": this.userAgent,
      "Accept": "application/json"
    };
    const init = {
      method: options.method || "GET",
      headers
    };

    if (options.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(options.form)) {
        if (value !== undefined && value !== null) form.set(key, String(value));
      }
      init.body = form;
    }

    let response;
    try {
      response = await this.fetch(url, init);
    } catch (cause) {
      const networkMeta = {
        status: null,
        ok: false,
        method: init.method,
        endpoint: path,
        requestId: null,
        rateLimit: { used: null, remaining: null, resetSeconds: null },
        retryAfterSeconds: null
      };
      this.lastResponseMeta = networkMeta;
      throw new RedditApiError("Reddit API network request failed.", {
        code: "NETWORK_ERROR",
        category: "network",
        retryable: true,
        retryAfterSeconds: null,
        meta: networkMeta,
        cause
      });
    }

    const responseMeta = buildResponseMeta(response, {
      method: init.method,
      endpoint: path
    });
    this.lastResponseMeta = responseMeta;
    const payload = await this._parseResponse(response);

    const apiErrors = payload && payload.json && Array.isArray(payload.json.errors)
      ? payload.json.errors
      : [];

    if (!response.ok || apiErrors.length) {
      const detail = apiErrors.length
        ? apiErrors.map(err => Array.isArray(err) ? err.join(": ") : String(err)).join("; ")
        : (payload && payload.message) || (typeof payload === "string" ? payload : response.statusText);
      const classification = classifyFailure({
        status: response.status,
        apiErrors,
        headers: response.headers
      });
      throw new RedditApiError(
        `Reddit API request failed (${response.status}): ${detail || "unknown error"}`,
        {
          ...classification,
          status: response.status,
          payload,
          apiErrors,
          meta: responseMeta
        }
      );
    }

    return payload;
  }

  async listing(path, query = {}, fetchAll = false) {
    const requestedLimit = Number(query.limit);
    const target = fetchAll
      ? MAX_FETCH_ALL
      : (Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : DEFAULT_LIMIT);

    const results = [];
    let after = query.after || null;

    do {
      const remaining = target - results.length;
      const pageLimit = Math.min(MAX_PAGE, Math.max(1, remaining));
      const payload = await this.request(path, {
        query: { ...query, limit: pageLimit, after }
      });
      results.push(...listingChildren(payload));
      after = payload && payload.data ? payload.data.after : null;
    } while (fetchAll && after && results.length < target);

    return results.slice(0, target);
  }

  async submissions({ subreddit = "", sort = "hot", time = "all", limit, fetchAll = false } = {}) {
    const safeSort = ["hot", "new", "rising", "top", "controversial"].includes(sort) ? sort : "hot";
    const base = subreddit ? `/r/${encodeURIComponent(subreddit)}` : "";
    return normalizeRedditList(await this.listing(`${base}/${safeSort}`, {
      limit,
      t: ["top", "controversial"].includes(safeSort) ? time : undefined
    }, fetchAll));
  }

  async userSubmissions({ user, limit, fetchAll = false }) {
    return normalizeRedditList(await this.listing(
      `/user/${encodeURIComponent(user)}/submitted`,
      { limit },
      fetchAll
    ));
  }

  async subredditComments({ subreddit = "", limit }) {
    const base = subreddit ? `/r/${encodeURIComponent(subreddit)}` : "";
    return normalizeRedditList(await this.listing(`${base}/comments`, { limit }, false));
  }

  async userComments({ user, limit, fetchAll = false }) {
    return normalizeRedditList(await this.listing(
      `/user/${encodeURIComponent(user)}/comments`,
      { limit },
      fetchAll
    ));
  }

  async submissionComments({ submissionId, limit, depth, fetchAll = false }) {
    const payload = await this.request(`/comments/${encodeURIComponent(id36(submissionId))}`, {
      query: {
        limit: fetchAll ? MAX_PAGE : limit,
        depth: fetchAll ? 10 : depth
      }
    });
    const listing = Array.isArray(payload) ? payload[1] : null;
    return normalizeRedditList(listingChildren(listing));
  }

  async getThing(kind, id) {
    if (["pm", "private_message", "message"].includes(kind)) {
      return this.getMessage(id);
    }
    const itemName = fullname(id, kind);
    const payload = await this.request("/api/info", { query: { id: itemName } });
    const items = listingChildren(payload);
    if (!items.length) {
      throw new RedditApiError(`Reddit item not found: ${itemName}`, {
        code: "NOT_FOUND",
        status: 404
      });
    }
    return normalizeRedditObject(items[0]);
  }

  async inbox({ limit, fetchAll = false } = {}) {
    return normalizeRedditList(await this.listing("/message/inbox", { limit }, fetchAll));
  }

  async getMessage(id) {
    const itemName = fullname(id, "message");
    const messages = await this.inbox({ limit: MAX_PAGE, fetchAll: true });
    const found = messages.find(item => item && item.fullname === itemName);
    if (!found) {
      throw new RedditApiError(`Reddit message not found in inbox: ${itemName}`, {
        code: "NOT_FOUND",
        status: 404
      });
    }
    return found;
  }

  async identity() {
    return this.request("/api/v1/me");
  }

  async content({ source, limit }) {
    const me = await this.identity();
    const allowed = new Set(["saved", "upvoted", "downvoted", "gilded", "hidden"]);
    if (!allowed.has(source)) {
      throw new RedditApiError(`Unsupported content source: ${source}`, { code: "INVALID_SOURCE" });
    }
    return normalizeRedditList(await this.listing(
      `/user/${encodeURIComponent(me.name)}/${source}`,
      { limit },
      false
    ));
  }

  async search({ subreddit = "", query, sort = "relevance", time = "all", limit = DEFAULT_LIMIT }) {
    const base = subreddit ? `/r/${encodeURIComponent(subreddit)}` : "";
    return normalizeRedditList(await this.listing(`${base}/search`, {
      q: query,
      sort,
      t: time,
      restrict_sr: subreddit ? "true" : "false",
      type: "link",
      limit
    }, false));
  }

  async reply({ kind, id, text }) {
    const parent = fullname(id, kind);
    const payload = await this.request("/api/comment", {
      method: "POST",
      form: { api_type: "json", thing_id: parent, text }
    });
    const thing = payload && payload.json && payload.json.data &&
      Array.isArray(payload.json.data.things) ? payload.json.data.things[0] : null;
    return thing && thing.data ? thing.data : thing || { parent, text };
  }

  async create({ type, subreddit, title, url, text, original, recipient, subject, message }) {
    if (type === "pm") {
      await this.request("/api/compose", {
        method: "POST",
        form: { api_type: "json", to: recipient, subject, text: message }
      });
      return { recipient, subject, message };
    }

    const form = {
      api_type: "json",
      sr: subreddit,
      title
    };

    if (type === "self") {
      form.kind = "self";
      form.text = text || "";
    } else if (type === "link") {
      form.kind = "link";
      form.url = url;
    } else if (type === "cross") {
      form.kind = "crosspost";
      form.crosspost_fullname = fullname(original, "submission");
    } else {
      throw new RedditApiError(`Unsupported submission type: ${type}`, { code: "INVALID_TYPE" });
    }

    const payload = await this.request("/api/submit", { method: "POST", form });
    const data = payload && payload.json ? payload.json.data : null;
    return data || payload;
  }

  async edit({ kind, id, text }) {
    const itemName = fullname(id, kind);
    const payload = await this.request("/api/editusertext", {
      method: "POST",
      form: { api_type: "json", thing_id: itemName, text }
    });
    const thing = payload && payload.json && payload.json.data &&
      Array.isArray(payload.json.data.things) ? payload.json.data.things[0] : null;
    return thing && thing.data ? thing.data : thing || { name: itemName, body: text };
  }

  async delete({ kind, id }) {
    const itemName = fullname(id, kind);
    if (["pm", "private_message", "message"].includes(kind)) {
      await this.request("/api/del_msg", { method: "POST", form: { id: itemName } });
    } else {
      await this.request("/api/del", { method: "POST", form: { id: itemName } });
    }
    return { name: itemName, deleted: true };
  }

  async react({ kind, id, vote, save }) {
    const itemName = fullname(id, kind);
    const actions = [];

    const dir = vote === "upvote" ? 1 : vote === "downvote" ? -1 : vote === "unvote" ? 0 : null;
    if (dir !== null) {
      await this.request("/api/vote", { method: "POST", form: { id: itemName, dir } });
      actions.push(vote);
    }

    if (save === "save") {
      await this.request("/api/save", { method: "POST", form: { id: itemName } });
      actions.push("save");
    } else if (save === "unsave") {
      await this.request("/api/unsave", { method: "POST", form: { id: itemName } });
      actions.push("unsave");
    }

    return { name: itemName, actions };
  }

  async markRead(id) {
    const itemName = fullname(id, "message");
    await this.request("/api/read_message", { method: "POST", form: { id: itemName } });
    return { name: itemName, read: true };
  }

  async streamBatch({ kind, subreddit, filter, limit }) {
    if (kind === "submissions") {
      return this.submissions({ subreddit, sort: "new", limit: limit || MAX_PAGE });
    }
    if (kind === "comments") {
      return this.subredditComments({ subreddit, limit: limit || MAX_PAGE });
    }
    if (kind === "PMs") {
      const path = filter === "unread" ? "/message/unread" : "/message/inbox";
      return normalizeRedditList(await this.listing(path, { limit: limit || 25 }, false));
    }
    throw new RedditApiError(`Unsupported stream kind: ${kind}`, { code: "INVALID_STREAM_KIND" });
  }
}

module.exports = {
  RedditClient,
  RedditApiError,
  fullname,
  id36,
  listingChildren
};
