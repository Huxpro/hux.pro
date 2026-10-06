import assert from "node:assert/strict";
import test from "node:test";

import {
  detailKeywords,
  exactKeywords,
  scorePaletteItem,
} from "../../systems/command/search-filter.ts";

test("internal namespaces and categories do not create one-letter matches", () => {
  assert.equal(
    scorePaletteItem(
      "app-react",
      "p",
      exactKeywords(["app", "apps", "web"]),
    ),
    0,
  );
  assert.equal(
    scorePaletteItem(
      "blog-quiet-notes",
      "b",
      exactKeywords(["blog", "post", "article"]),
    ),
    0,
  );
});

test("complete category queries still reveal their collection", () => {
  assert.ok(
    scorePaletteItem("app-react", "app", exactKeywords(["app", "web"])) > 0,
  );
  assert.ok(
    scorePaletteItem("blog-quiet-notes", "post", exactKeywords(["post"])) > 0,
  );
  assert.ok(
    scorePaletteItem("app-react", "web", exactKeywords(["web"])) > 0,
  );
});

test("single Latin characters only search primary identity fields", () => {
  assert.equal(
    scorePaletteItem(
      "blog-quiet-notes",
      "p",
      detailKeywords(["A post about performance"]),
    ),
    0,
  );
  assert.ok(scorePaletteItem("prompt", "p", detailKeywords(["system"])) > 0);
  assert.ok(scorePaletteItem("app-flappy-bird", "p", ["Flappy Bird"]) > 0);
});

test("multi-character queries continue to search detail metadata", () => {
  assert.ok(
    scorePaletteItem(
      "blog-quiet-notes",
      "performance",
      detailKeywords(["A post about performance"]),
    ) > 0,
  );
});

test("a single CJK character remains a meaningful detail query", () => {
  assert.ok(
    scorePaletteItem(
      "blog-quiet-notes",
      "性能",
      detailKeywords(["一篇关于性能的文章"]),
    ) > 0,
  );
});
