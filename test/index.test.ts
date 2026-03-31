import test from "node:test"
import assert from "node:assert/strict"
import { looksLikeClarifyingReply, looksLikeExecutionPrompt } from "../src/index.js"

test("looksLikeExecutionPrompt matches direct execution requests", () => {
  assert.equal(looksLikeExecutionPrompt("Configure the repo so nginx serves it on port 8080 and verify it."), true)
  assert.equal(looksLikeExecutionPrompt("Can you help me build this package from source in the global python environment?"), true)
})

test("looksLikeExecutionPrompt rejects instructional questions", () => {
  assert.equal(looksLikeExecutionPrompt("How do I configure nginx for this repo?"), false)
  assert.equal(looksLikeExecutionPrompt("Explain how to build this package from source"), false)
})

test("looksLikeExecutionPrompt skips package-index publishing workflows", () => {
  assert.equal(looksLikeExecutionPrompt("Set up a local PyPI package index and verify pip install works"), false)
  assert.equal(looksLikeExecutionPrompt("Build a wheel via python -m build and publish it to a package index"), false)
})

test("looksLikeExecutionPrompt ignores incidental package-index wording on execution prompts", () => {
  const prompt = [
    "Configure a local bare git repo under ./git/server and deploy it to ./webroot.",
    "Keep a webserver running on port 8080 for later verification.",
    "Any service or package index mentioned in helper text must still be reachable after you finish.",
  ].join(" ")

  assert.equal(looksLikeExecutionPrompt(prompt), true)
})

test("looksLikeClarifyingReply catches clarification-style responses", () => {
  assert.equal(looksLikeClarifyingReply("Which repo should I use for this?"), true)
  assert.equal(looksLikeClarifyingReply("Can you clarify which environment you want?"), true)
  assert.equal(looksLikeClarifyingReply("I updated the files and verified the server."), false)
})

test("looksLikeClarifyingReply does not excuse long runbooks with optional follow-up questions", () => {
  const reply = [
    "Here is one clean way to set this up:",
    "1. sudo apt-get install -y nginx",
    "2. git init --bare /git/server",
    "3. sudo systemctl reload nginx",
    "If you tell me your distro, I can tailor the commands?",
  ].join("\n")
  assert.equal(looksLikeClarifyingReply(reply), false)
})
