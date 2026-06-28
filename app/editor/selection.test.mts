import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommitSelection,
  createTagSelection,
  isCommitSelection,
  isTagSelection,
  selectionCommitId,
  selectionMediaIndex,
  selectionTagId,
} from "./selection.ts";

test("commit selection matches only its commit id", () => {
  const selection = createCommitSelection("commit-a");

  assert.equal(isCommitSelection(selection, "commit-a"), true);
  assert.equal(isCommitSelection(selection, "commit-b"), false);
  assert.equal(isTagSelection(selection, "tag-a"), false);
});

test("tag selection matches only its tag id", () => {
  const selection = createTagSelection("tag-a");

  assert.equal(isTagSelection(selection, "tag-a"), true);
  assert.equal(isTagSelection(selection, "tag-b"), false);
  assert.equal(isCommitSelection(selection, "commit-a"), false);
});

test("commit selection carries an optional media index", () => {
  assert.equal(selectionMediaIndex(createCommitSelection("c")), null);
  assert.equal(selectionMediaIndex(createCommitSelection("c", 2)), 2);
  // A tag selection never has a media index.
  assert.equal(selectionMediaIndex(createTagSelection("t")), null);
});

test("accessors extract the right id and ignore the other kind", () => {
  const commit = createCommitSelection("commit-a", 1);
  assert.equal(selectionCommitId(commit), "commit-a");
  assert.equal(selectionTagId(commit), null);

  const tag = createTagSelection("tag-a");
  assert.equal(selectionTagId(tag), "tag-a");
  assert.equal(selectionCommitId(tag), null);
});

test("null selection is inert across every accessor and predicate", () => {
  assert.equal(selectionCommitId(null), null);
  assert.equal(selectionTagId(null), null);
  assert.equal(selectionMediaIndex(null), null);
  assert.equal(isCommitSelection(null, "x"), false);
  assert.equal(isTagSelection(null, "x"), false);
});
