import assert from "node:assert/strict";
import test from "node:test";
import { headingIds, linkDocs } from "../lib/doc-links.ts";

const zh = new Map([["glass", headingIds("# 玻璃\n\n## 放置（placement）\n\n```sh\n# not a heading\n```\n")]]);
const idsOf = (slug: string, lang: "en" | "zh") => (lang === "zh" ? zh.get(slug) : undefined);

test("heading ids are the page's: h1–h3, markup stripped, code skipped", () => {
  assert.deepEqual(
    [...headingIds("# The `Dock`\n## [Glass](./glass.md) *rules*\n#### Deep\n```\n# comment\n```")],
    ["the-dock", "glass-rules"],
  );
});

test("an English page links the English page, anchor kept", () => {
  assert.equal(linkDocs("see [Glass](./glass.md#placement).", "en", idsOf), "see [Glass](/docs/glass/en#placement).");
});

test("a Chinese page stays in Chinese when the target has the heading", () => {
  assert.equal(linkDocs("[x](./glass.md)", "zh", idsOf), "[x](/docs/glass/zh)");
  assert.equal(linkDocs("[x](./glass.md#放置placement)", "zh", idsOf), "[x](/docs/glass/zh#放置placement)");
});

test("a Chinese page goes to English for an English-only anchor or doc", () => {
  assert.equal(linkDocs("[x](./glass.md#placement)", "zh", idsOf), "[x](/docs/glass/en#placement)");
  assert.equal(linkDocs("[x](./dock.md)", "zh", idsOf), "[x](/docs/dock/en)");
});

test("images, URLs and same-page links are left alone", () => {
  const md = "![a](/img/docs/x.png#bleed) [b](https://x.dev/a.md) [c](#rules) [d](../content/apps.json)";
  assert.equal(linkDocs(md, "en", idsOf), md);
});
