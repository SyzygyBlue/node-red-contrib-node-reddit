"use strict";

const assert = require("node:assert/strict");
const registerRedditNodes = require("../node-reddit.js");

const registered = [];

const RED = {
  nodes: {
    registerType(name) {
      registered.push(name);
    },
    createNode() {},
    getNode() {
      return null;
    }
  },
  util: {
    cloneMessage(msg) {
      return { ...msg };
    }
  }
};

registerRedditNodes(RED);

const expected = [
  "reddit-credentials",
  "get",
  "reply",
  "search",
  "create",
  "stream",
  "edit",
  "delete",
  "react"
];

assert.deepEqual([...registered].sort(), [...expected].sort());
console.log("Registered Node-RED types:", registered.join(", "));
