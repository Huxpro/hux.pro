/**
 * Editor selection model.
 *
 * The inspector can have exactly one thing selected at a time: a commit
 * (optionally focused on one of its media items) or a tag — or nothing.
 * Modelling that as a discriminated union (rather than several parallel
 * `useState`s) makes the mutual exclusion structural: it's impossible to
 * represent "a commit AND a tag selected", so no handler has to remember to
 * clear the others. These helpers are pure so the logic is unit-testable
 * without React (see selection.test.mts).
 */

export type EditorSelection =
  | { type: "commit"; id: string; mediaIndex: number | null }
  | { type: "tag"; id: string }
  | null;

export function createCommitSelection(
  id: string,
  mediaIndex: number | null = null,
): EditorSelection {
  return { type: "commit", id, mediaIndex };
}

export function createTagSelection(id: string): EditorSelection {
  return { type: "tag", id };
}

export function isCommitSelection(
  selection: EditorSelection,
  id: string,
): boolean {
  return selection?.type === "commit" && selection.id === id;
}

export function isTagSelection(
  selection: EditorSelection,
  id: string,
): boolean {
  return selection?.type === "tag" && selection.id === id;
}

/** The selected commit's id, or null when a tag / nothing is selected. */
export function selectionCommitId(selection: EditorSelection): string | null {
  return selection?.type === "commit" ? selection.id : null;
}

/** The selected tag's id, or null when a commit / nothing is selected. */
export function selectionTagId(selection: EditorSelection): string | null {
  return selection?.type === "tag" ? selection.id : null;
}

/** The focused media index within the selected commit, if any. */
export function selectionMediaIndex(selection: EditorSelection): number | null {
  return selection?.type === "commit" ? selection.mediaIndex : null;
}
