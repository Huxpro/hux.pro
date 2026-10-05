import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationSubject,
  postSubjectFromPath,
  sameAskContext,
  shouldStartNewChat,
  type KeptChat,
} from "../systems/ask/lib/chat-continuity.ts";

const about = (doc: string, role = "user") => ({
  role,
  parts: [{ type: "data-context", data: { doc } }, { type: "text" }],
});

const plain = (role = "user") => ({ role, parts: [{ type: "text" }] });

test("a writing address is that post", () => {
  assert.equal(postSubjectFromPath("/writing/dreamer/en"), "post:dreamer:en");
  assert.equal(postSubjectFromPath("/writing/dreamer/zh/"), "post:dreamer:zh");
  assert.equal(postSubjectFromPath("/writing/pl-chart/en"), "post:pl-chart:en");
  assert.equal(postSubjectFromPath("/works"), null);
  assert.equal(postSubjectFromPath("/"), null);
});

test("the latest context names the conversation, and a bare follow-up keeps it", () => {
  assert.equal(conversationSubject([about("post:a:en"), plain(), about("post:b:en", "assistant")]), "post:a:en");
  assert.equal(conversationSubject([about("post:a:en"), plain()]), "post:a:en");
  assert.equal(conversationSubject([plain()]), null);
});

test("the same post is the same context, a paragraph of it included", () => {
  assert.equal(sameAskContext("post:dreamer:en", "post:dreamer:en"), true);
  assert.equal(sameAskContext("post:dreamer:en", "post:other:en"), false);
  assert.equal(sameAskContext("post:dreamer:en", null), true);
  assert.equal(sameAskContext("language:rust:en", "post:pl-chart:en"), true);
  assert.equal(sameAskContext("language:rust:zh", "post:pl-chart:en"), false);
  assert.equal(sameAskContext("post:pl-chart:en", "post:dreamer:en"), false);
});

test("another post starts a new chat", () => {
  const messages = [about("post:dreamer:en")];
  assert.equal(shouldStartNewChat(messages, "c1", "post:other:en", null), true);
  assert.equal(shouldStartNewChat(messages, "c1", "post:dreamer:en", null), false);
});

test("asking about a paragraph does not keep a chat about a different post", () => {
  // The paragraph is still the post it was selected on. The conversation's
  // subject stays the earlier post until that question is sent, so the page
  // decides.
  const messages = [about("post:dreamer:en", "user")];
  assert.equal(shouldStartNewChat(messages, "c1", "post:other:en", null), true);
});

test("an empty chat and a page with no post stay", () => {
  assert.equal(shouldStartNewChat([], "c1", "post:other:en", null), false);
  assert.equal(shouldStartNewChat([about("post:dreamer:en")], "c1", null, null), false);
  assert.equal(shouldStartNewChat([plain()], "c1", "post:other:en", null), false);
});

test("a conversation picked from the history stays until the post changes", () => {
  const messages = [about("post:dreamer:en")];
  const kept: KeptChat = { chatId: "c1", subject: "post:other:en" };
  assert.equal(shouldStartNewChat(messages, "c1", "post:other:en", kept), false);
  assert.equal(shouldStartNewChat(messages, "c1", "post:third:en", kept), true);
  assert.equal(shouldStartNewChat(messages, "c2", "post:other:en", kept), true);
});

test("a language switch is a different post", () => {
  assert.equal(shouldStartNewChat([about("post:dreamer:en")], "c1", "post:dreamer:zh", null), true);
});
