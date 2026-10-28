// =============================================================================
// Log View State: how much of the timeline is on screen, and which of it.
//
// /works carries more information than any one reading of it can use: 25
// commits, ~37 pieces of rich media, three eras. Folded, the page is a
// two-screen overview and every cover is invisible; fully unfolded it is a
// thirteen-screen media wall with no overview left. The two states people
// actually want ("show me everything at once" and "let me see the work")
// are the same page at two different densities, plus the ability to narrow
// what is in it.
//
// This module is the vocabulary for both, and the URL codec that makes a
// reading shareable. It is deliberately free of React and of `lib/log`'s
// data layer: the parse/serialize pair is the whole contract, so the query
// string stays the single source of truth for view state.
// =============================================================================

import {
  FILTERABLE_COMMIT_TYPES,
  type FilterableCommitType,
} from "./log";

// =============================================================================
// Form: how much of each commit is printed, as a composition.
//
// A row is made of a few independent parts: the title line (always), the
// text (the description and my line under it), the attachment object, the
// notes under it, the author fields, and whether it peeks on hover. Each part has its own small
// set of states (`RowForm`), and a *form* is one preset of all of them. So
// the three readings of the page are compositions of the same atoms, and
// switching form is resetting every row to a preset rather than four
// hand-made layouts.
//
//  - `index`: the title line only. The overview: one row per commit, the
//    whole career in two screens. Rich media is reachable but not shown
//    (hover peek on a pointer device, or open the row).
//  - `covers`: the default. the title, the text whole, and the covers at
//    a size you can recognise a slide or a screenshot at. Everything a
//    reader should know about a commit is above its covers and none of it
//    waits on a press: the page is read by scrolling. What a press adds is
//    the long form under the covers (the notes), and a row with none is
//    not pressable at all.
//  - `feed`: the grid, at half a column, with its captions written out,
//    and the notes and the author fields printed too. All the information is right there, so
//    nothing in it peeks or opens a sheet: a video plays where it is, a
//    card goes to its page.
//
// What is read and what is asked for is decided once, for every commit,
// by where it lives in the data: `description` and `commentary` are the
// text (what someone scrolling should know, short enough to print whole),
// and `details` (a programme abstract, a thesis's particulars) are the
// notes. A description that needed a clamp to fit had notes in it.
//
// The author fields (`git log --pretty=fuller`: the handle, the role, once
// the hash too) are neither. They are provenance: the chapter names the
// company, the title line the team, the handle at the head of a run opens
// the identity card, the hash is the permalink. So they are decoration
// on every form but the one that prints everything, and they never gate a
// press. When they were part of the notes every row was pressable for
// them, and a press that brought only decoration was most of the presses.
//
// A form sets every atom, but the row's press owns one of them, the notes
// (see `rowFormFor`); the rest are the page's.
//
// The page borrowed git's vocabulary for these once (`--oneline`, `--stat`,
// `-p`); those names still parse, as aliases, so old links keep working.
// =============================================================================

export const LOG_FORMS = ["index", "covers", "feed"] as const;

export type LogForm = (typeof LOG_FORMS)[number];

export const DEFAULT_FORM: LogForm = "covers";

/** The atoms a row composes. Every form is one setting of each. */
export interface RowForm {
  /**
   * The text: the description and the commentary under it. Nothing, or
   * all of it. There is no clamp: a description is written to be read
   * whole, and what only elaborates it is `details`, in the notes.
   */
  description: "none" | "full";
  /**
   * The attachment object: nothing, the strip of covers, or the grid (the
   * feed's half-column tiles with their captions written out).
   */
  media: "none" | "covers" | "grid";
  /** The notes under the picture: the details, the long form. */
  notes: boolean;
  /** The author fields. Decoration, printed only where everything is (the
   *  feed), and never brought by a press. */
  author: boolean;
  /** Whether the row, or its covers, peek on hover. The feed does not: it
   *  has already printed everything a peek would show. */
  peek: boolean;
}

export const ROW_FORM: Record<LogForm, RowForm> = {
  index: { description: "none", media: "none", notes: false, author: false, peek: true },
  covers: { description: "full", media: "covers", notes: false, author: false, peek: true },
  feed: { description: "full", media: "grid", notes: true, author: true, peek: false },
};

/**
 * Which atoms the form owns, and which the row's own press owns.
 *
 * The form owns the **text** and the **picture**. The picture is the
 * expensive atom: it decides the page's scroll length and what every frame
 * costs (see "What the page costs to scroll" in docs/system-attachments.md)
 * And the text is what the page is for: in `covers` it is the thing a
 * reader scrolls to read, so it is never behind a press.
 *
 * A row's press owns the **notes**: the long form a reader asks for row by
 * row: this abstract, that thesis. A press prints them, or folds them away where the form had
 * already printed them (the feed). The text and the picture hold still,
 * which is also what lets a row keep its press inside the feed: folding a
 * commit's notes and opening a caption are different clicks: one changes
 * the notes, the other opens the attachment.
 *
 * The exception is the index, the one form that prints no text and no
 * picture. There the title line only counts the attachments (`📎 3`), and
 * the count is a promise the row has to keep: opening an index row brings
 * its text and its covers with the notes, so an open row is the whole
 * commit whatever the form.
 */
export function rowFormFor(form: LogForm, open: boolean): RowForm {
  const base = ROW_FORM[form];
  if (!open) return base;
  return base.notes
    ? { ...base, notes: false }
    : {
        ...base,
        description: "full",
        notes: true,
        media: base.media === "none" ? "covers" : base.media,
      };
}

/** The git flags the forms were first named after. Old links carry them. */
const FORM_ALIAS: Record<string, LogForm> = {
  oneline: "index",
  stat: "covers",
  patch: "feed",
};

export function parseLogForm(value: string | null): LogForm | null {
  if (!value) return null;
  if ((LOG_FORMS as readonly string[]).includes(value)) return value as LogForm;
  return FORM_ALIAS[value] ?? null;
}

// =============================================================================
// View state
// =============================================================================

export interface LogViewState {
  /**
   * Selected artifact types. Empty means "no filter" rather than "nothing
   * selected": the rest-state of the chip row, where every commit shows.
   */
  types: FilterableCommitType[];
  form: LogForm;
}

/**
 * Toggle one type in the selection, preserving {@link FILTERABLE_COMMIT_TYPES}
 * order so the chip row never reshuffles under the tap.
 */
export function toggleType(
  types: readonly FilterableCommitType[],
  type: FilterableCommitType,
): FilterableCommitType[] {
  const next = types.includes(type)
    ? types.filter((t) => t !== type)
    : [...types, type];
  return FILTERABLE_COMMIT_TYPES.filter((t) => next.includes(t));
}

// =============================================================================
// URL codec
// =============================================================================

export const TYPE_PARAM = "type";
export const FORM_PARAM = "view";

/**
 * Read view state out of a query string.
 *
 * Tolerant on purpose: a hand-edited or stale URL degrades to the default
 * rather than rendering an empty page: unknown type names are dropped,
 * an unknown form falls back to the default.
 */
/** Type names that have been renamed. Old links carry the old word, the
 *  same way `FORM_ALIAS` carries the git flags the forms were first named
 *  after. `social` became `press` when the type stopped meaning "my social
 *  accounts" and started meaning coverage. */
const TYPE_ALIAS: Record<string, FilterableCommitType> = {
  social: "press",
};

export function parseViewState(params: URLSearchParams): LogViewState {
  const raw = params.get(TYPE_PARAM);
  const requested = (raw ? raw.split(",").map((s) => s.trim()) : []).map(
    (name) => TYPE_ALIAS[name] ?? name,
  );
  const types = FILTERABLE_COMMIT_TYPES.filter((t) => requested.includes(t));

  return {
    types,
    form: parseLogForm(params.get(FORM_PARAM)) ?? DEFAULT_FORM,
  };
}

/**
 * Write view state back into a query string, dropping both params at their
 * defaults so the plain `/works` URL stays clean. Nobody should have to
 * share `?type=&view=covers`.
 *
 * Takes the current params and mutates a copy so unrelated query state
 * (anything another feature owns) survives a chip tap.
 */
export function serializeViewState(
  state: LogViewState,
  current?: URLSearchParams,
): string {
  const params = new URLSearchParams(current?.toString());

  if (state.types.length > 0) {
    params.set(TYPE_PARAM, state.types.join(","));
  } else {
    params.delete(TYPE_PARAM);
  }

  if (state.form !== DEFAULT_FORM) {
    params.set(FORM_PARAM, state.form);
  } else {
    params.delete(FORM_PARAM);
  }

  return params.toString();
}
