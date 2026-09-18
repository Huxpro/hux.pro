import assert from "node:assert/strict";
import {
  DEFAULT_WIDGET_SCROLL_MODE,
  isWidgetScrollMode,
  pageItems,
  parseWidgetScrollMode,
  WIDGET_SCROLL_MODES,
} from "../components/ui/widget-scroll.ts";

assert.equal(DEFAULT_WIDGET_SCROLL_MODE, "nested");
assert.deepEqual(WIDGET_SCROLL_MODES, [
  "nested",
  "peek",
  "expand",
  "lock",
  "rail",
  "pages",
  "sheet",
]);

assert.equal(parseWidgetScrollMode("pages"), "pages");
assert.equal(parseWidgetScrollMode("nope"), undefined);
assert.equal(parseWidgetScrollMode(null), undefined);
assert.equal(isWidgetScrollMode("rail"), true);
assert.equal(isWidgetScrollMode("vertical"), false);

assert.deepEqual(pageItems(["a", "b", "c", "d", "e"], 2), [
  ["a", "b"],
  ["c", "d"],
  ["e"],
]);
assert.deepEqual(pageItems([], 3), [[]]);
assert.deepEqual(pageItems(["a"], 0), [["a"]]);

console.log("widget-scroll helpers ok");
