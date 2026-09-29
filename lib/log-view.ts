// =============================================================================
// Log View State — how much of the timeline is on screen, and which of it.
//
// /works carries more information than any one reading of it can use: 35
// commits, ~37 pieces of rich media, four chapters. Folded, the page is a
// two-screen overview and every cover is invisible; fully unfolded it is a
// thirteen-screen media wall with no overview left. The two states people
// actually want — "show me everything at once" and "let me see the work" —
// are the same page at two different densities, plus the ability to narrow
// what is in it.
//
// And not every row is the same kind of thing. A project is the work; a talk
// or a piece of press is somebody talking about it. Printed at one weight,
// nineteen talks buried eleven projects — the headline work of the current
// chapter was its thirteenth row. So a row also has a *weight*, and a form
// is a density per weight rather than one density for every row.
//
// This module is the vocabulary for all three, and the URL codec that makes
// a reading shareable. It is deliberately free of React and of `lib/log`'s
// data layer: the parse/serialize pair is the whole contract, so the query
// string stays the single source of truth for view state.
// =============================================================================

import {
  FILTERABLE_COMMIT_TYPES,
  type CommitType,
  type FilterableCommitType,
} from "./log";

// =============================================================================
// Weight — what a row is to the chapter it sits in.
//
//  - `major` — the work itself, and the rows that place it: projects, the
//    roles that print, the events that date a move. These carry the
//    chapter, so they lead it and they print their prose.
//  - `minor` — what was said about the work: talks and press (and posts,
//    should one ever be filed here). Worth having and worth finding, not
//    worth a paragraph and a contact sheet each while the reader is still
//    asking what the work *was*. One line — title, venue, date — until
//    opened.
//
// Weight is the type's, not the row's. A per-row `featured` flag deciding it
// would be curation annotating rather than acting ("Less, but Better" in
// docs/design-philosophy.md), and a talk that matters already says so by
// being attached to the project it presents.
// =============================================================================

export type RowWeight = "major" | "minor";

export function rowWeight(type: CommitType): RowWeight {
  return type === "talk" || type === "press" || type === "post"
    ? "minor"
    : "major";
}

/**
 * A chapter's reading order: the work first, then what was said about it,
 * each half still newest-first as `sortCommitsByDate` left it.
 *
 * Strictly chronological, the current chapter opened on nine talks and a
 * piece of press before it reached Lynx, the thing all of them are about: a
 * newcomer met the conferences before the work. Hoisting the work keeps the
 * log a log inside each half — the rail, the bylines and the connectors all
 * still read top-down — and a talk attached to the project it presents now
 * points *up* at it, the direction the reader has just come from.
 *
 * Stable, and generic over anything with a `type`, so the page and the
 * editor order a chapter identically.
 */
export function leadWithWork<T extends { type: CommitType }>(
  commits: readonly T[],
): T[] {
  return [
    ...commits.filter((c) => rowWeight(c.type) === "major"),
    ...commits.filter((c) => rowWeight(c.type) === "minor"),
  ];
}

// =============================================================================
// Form — how much of each commit is printed, as a composition.
//
// A row is made of a few independent parts: the title line (always), the
// description, the attachment object, the notes under it, and whether it
// peeks on hover. Each part has its own small set of states (`RowForm`), and
// a *form* is one preset of all of them — so the three readings of the page
// are compositions of the same atoms, and switching form is resetting every
// row to a preset rather than four hand-made layouts. A row the reader opens
// by hand is the same thing at a smaller scale: it takes the `feed` preset
// for itself (see TimelineCommit).
//
//  - `index`  — the title line only. The overview: one row per commit, the
//    whole career in two screens. Rich media is reachable but not shown
//    (hover peek on a pointer device, or open the row).
//  - `covers` — the default, and the one form that reads weight: the work
//    prints its description and its covers at a size you can recognise a
//    slide or a screenshot at; a talk or a piece of press prints one line,
//    its venue riding beside the title. It used to put a contact sheet
//    under every row, talks included, which made the default page eight
//    screens of cover boxes with the projects somewhere inside; the covers
//    worth a glance are the work's, and the rest are one press away.
//  - `feed`   — the grid, at half a column, with its captions written out,
//    and the prose and notes printed whole to match — every row, at every
//    weight. All the information is right there, so nothing in it peeks or
//    opens a sheet: a video plays where it is, a card goes to its page.
//
// A form sets all five atoms, but it only *owns* two of them: the picture
// is the page's (`media`, `peek`), the prose is each row's (`description`,
// `notes`, and where the venue sits — see `rowFormFor`). Pressing a row's
// text relieves or clamps it against whatever the form printed; the picture
// holds still.
//
// The page borrowed git's vocabulary for these once (`--oneline`, `--stat`,
// `-p`); those names still parse, as aliases, so old links keep working.
// =============================================================================

export const LOG_FORMS = ["index", "covers", "feed"] as const;

export type LogForm = (typeof LOG_FORMS)[number];

export const DEFAULT_FORM: LogForm = "covers";

/** The atoms a row composes. Every form is one setting of each. */
export interface RowForm {
  /** What of the description prints: nothing, a few lines (how many is the
   *  row's weight — see `Description`), or all of it. */
  description: "none" | "clamp" | "full";
  /**
   * The attachment object: nothing, the strip of covers, or the grid — the
   * feed's half-column tiles with their captions written out.
   */
  media: "none" | "covers" | "grid";
  /** The notes under the message: commentary and the author fields. */
  notes: boolean;
  /** Whether the row, or its covers, peek on hover. The feed does not: it
   *  has already printed everything a peek would show. */
  peek: boolean;
  /**
   * Where the venue goes: `under` the title on a line of its own, where the
   * handle signs beside it, or `beside` the title on the title line — the
   * one-line row a minor commit folds to, like a /writing entry. The handle
   * has no slot on that line, and does not need one: the chapter above
   * already names the company.
   */
  meta: "under" | "beside";
}

const INDEX: RowForm = {
  description: "none",
  media: "none",
  notes: false,
  peek: true,
  meta: "under",
};
const FEED: RowForm = {
  description: "full",
  media: "grid",
  notes: true,
  peek: false,
  meta: "under",
};

export const ROW_FORM: Record<LogForm, Record<RowWeight, RowForm>> = {
  index: { major: INDEX, minor: INDEX },
  covers: {
    major: {
      description: "clamp",
      media: "covers",
      notes: false,
      peek: true,
      meta: "under",
    },
    minor: {
      description: "none",
      media: "none",
      notes: false,
      peek: true,
      meta: "beside",
    },
  },
  feed: { major: FEED, minor: FEED },
};

/**
 * Which atoms the form owns, and which the row's own press owns.
 *
 * The form owns the **picture**: `media` and the `peek` that stands in for
 * it — with one exception, at the end. That is the expensive atom — it decides the page's scroll length and
 * what every frame costs (see "What the page costs to scroll" in
 * docs/system-attachments.md) — and it is the one a reader wants to set
 * once for the whole page rather than row by row.
 *
 * A row's press owns the **prose**: `description`, and the `notes` that are
 * notes on it. That is the cheap atom, and the one whose right answer
 * differs per row: "this description is clamped and I want the rest" is a
 * different want from "show me the work bigger", and until now they were
 * the same gesture.
 *
 * So a press relieves the text, or clamps it back where the form had
 * already printed it whole. The picture does not move. That is also what
 * lets a row keep its press inside the feed: folding a commit and opening
 * a caption used to be the same click with nothing painting the
 * difference, and now they are not the same click at all — one changes the
 * prose, the other opens the attachment.
 *
 * The exception is a row that prints no picture at all: every row in the
 * index, and a minor one in `covers`. In the index the title line counts
 * the attachments (`📎 3`), and the count is a promise the row has to keep;
 * either way, opening such a row brings its covers with its prose, so an
 * open row is the whole commit whatever the form. And an open row is never
 * one line — the venue goes back under the title, where the handle signs.
 * The other rows already print the picture, so their press still owns the
 * prose alone.
 */
export function rowFormFor(
  form: LogForm,
  weight: RowWeight,
  textRelieved: boolean,
): RowForm {
  const base = ROW_FORM[form][weight];
  if (!textRelieved) return base;
  return base.description === "full"
    ? { ...base, description: "clamp", notes: false }
    : {
        ...base,
        description: "full",
        notes: true,
        media: base.media === "none" ? "covers" : base.media,
        meta: "under",
      };
}

/** The git flags the forms were first named after — old links carry them. */
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
   * selected" — the rest-state of the chip row, where every commit shows.
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
 * Tolerant by design — a hand-edited or stale URL degrades to the default
 * rather than rendering an empty page: unknown type names are dropped,
 * an unknown form falls back to the default.
 */
/** Type names that have been renamed — old links carry the old word, the
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
 * defaults so the plain `/works` URL stays clean — nobody should have to
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
