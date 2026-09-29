// =============================================================================
// Log View State — which reading of /works is on screen, and how much of it.
//
// /works is read two ways.
//
//  - `projects` — the default: the things I made, as a resume. One row per
//    project, in order of how much it mattered rather than when it
//    happened, each wearing its logo (the About's badge icons), what I did
//    on it, when, and where to see it; the talks and the press as short
//    lists under it. It answers the question a newcomer arrives with —
//    "what has this person made, and what was their part?" — in one
//    screen. It has no state of its own beyond being chosen: nothing in it
//    filters or folds. (lib/works-index.ts builds it.)
//  - `log` — every commit, reverse-chronological, as `git log`: the talks,
//    the roles and the life events threaded between the projects, each era
//    a tag. The whole record, for the reader who wants its shape rather
//    than its highlights. Everything below the reading is about the log.
//
// The log carries more information than any one reading of it can use: 25
// commits, ~37 pieces of rich media, three eras. Folded, the page is a
// two-screen overview and every cover is invisible; fully unfolded it is a
// thirteen-screen media wall with no overview left. The two states people
// actually want — "show me everything at once" and "let me see the work" —
// are the same page at two different densities, plus the ability to narrow
// what is in it.
//
// This module is the vocabulary for all of it, and the URL codec that makes
// a reading shareable. It is deliberately free of React and of `lib/log`'s
// data layer: the parse/serialize pair is the whole contract, so the query
// string stays the single source of truth for view state.
// =============================================================================

import {
  FILTERABLE_COMMIT_TYPES,
  type FilterableCommitType,
} from "./log";

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
//  - `covers` — the default: the title, two lines, and the covers at a size
//    you can recognise a slide or a screenshot at. Still one row per commit,
//    so the overview survives, but the work is on screen rather than behind
//    a hover a phone cannot perform.
//  - `feed`   — the grid, at half a column, with its captions written out,
//    and the prose and notes printed whole to match. All the information is
//    right there, so nothing in it peeks or opens a sheet: a video plays
//    where it is, a card goes to its page.
//
// A form sets all four atoms, but it only *owns* two of them: the picture
// is the page's (`media`, `peek`), the prose is each row's (`description`,
// `notes` — see `rowFormFor`). Pressing a row's text relieves or clamps it
// against whatever the form printed; the picture holds still.
//
// The page borrowed git's vocabulary for these once (`--oneline`, `--stat`,
// `-p`); those names still parse, as aliases, so old links keep working.
// =============================================================================

export const LOG_FORMS = ["index", "covers", "feed"] as const;

export type LogForm = (typeof LOG_FORMS)[number];

export const DEFAULT_FORM: LogForm = "covers";

/** The atoms a row composes. Every form is one setting of each. */
export interface RowForm {
  /** What of the description prints: nothing, two lines, or all of it. */
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
}

export const ROW_FORM: Record<LogForm, RowForm> = {
  index: { description: "none", media: "none", notes: false, peek: true },
  covers: { description: "clamp", media: "covers", notes: false, peek: true },
  feed: { description: "full", media: "grid", notes: true, peek: false },
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
 * The exception is the index, the one form that prints no picture at all.
 * There the title line only counts the attachments (`📎 3`), and the count
 * is a promise the row has to keep: opening an index row brings its covers
 * with its prose, so an open row is the whole commit whatever the form. The
 * other forms already print the picture, so their press still owns the
 * prose alone.
 */
export function rowFormFor(form: LogForm, textRelieved: boolean): RowForm {
  const base = ROW_FORM[form];
  if (!textRelieved) return base;
  return base.description === "full"
    ? { ...base, description: "clamp", notes: false }
    : {
        ...base,
        description: "full",
        notes: true,
        media: base.media === "none" ? "covers" : base.media,
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
// Reading — the projects, or the log
// =============================================================================

export const WORKS_READINGS = ["projects", "log"] as const;

export type WorksReading = (typeof WORKS_READINGS)[number];

/** A plain `/works` is the projects; the log is one tap, or one param, away. */
export const DEFAULT_READING: WorksReading = "projects";

// =============================================================================
// View state
// =============================================================================

export interface LogViewState {
  /** Which reading is on screen. `types` and `form` are the log's alone. */
  reading: WorksReading;
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
 * `?view=log` — the log at its default form, unfiltered. The reading has no
 * param of its own: every URL the log ever had (`?type=talk`,
 * `?view=index`, `?view=oneline`) already names a reading of the log, so
 * the log is whatever carries one, and the one address that did not exist
 * before the projects became the default is the plain log — which is this.
 */
export const LOG_VIEW_VALUE = "log";

/** Type names that have been renamed — old links carry the old word, the
 *  same way `FORM_ALIAS` carries the git flags the forms were first named
 *  after. `social` became `press` when the type stopped meaning "my social
 *  accounts" and started meaning coverage. */
const TYPE_ALIAS: Record<string, FilterableCommitType> = {
  social: "press",
};

/**
 * Read view state out of a query string.
 *
 * Tolerant by design — a hand-edited or stale URL degrades to the default
 * rather than rendering an empty page: unknown type names are dropped,
 * an unknown form falls back to the default.
 *
 * Which reading: the log when the URL says anything about the log — a
 * `type` (even one whose names have all gone stale: it was a link into the
 * log, and the log unfiltered is the nearest thing to what it meant), a
 * form or one of its git aliases, or `view=log`. Otherwise the projects.
 * A `#hash` permalink is not in the query string; the page reads it on
 * arrival and opens the log for it (app/works/view.tsx).
 */
export function parseViewState(params: URLSearchParams): LogViewState {
  const raw = params.get(TYPE_PARAM);
  const requested = (raw ? raw.split(",").map((s) => s.trim()) : []).map(
    (name) => TYPE_ALIAS[name] ?? name,
  );
  const types = FILTERABLE_COMMIT_TYPES.filter((t) => requested.includes(t));
  const view = params.get(FORM_PARAM);
  const form = parseLogForm(view);

  return {
    reading:
      raw !== null || form !== null || view === LOG_VIEW_VALUE
        ? "log"
        : DEFAULT_READING,
    types,
    form: form ?? DEFAULT_FORM,
  };
}

/**
 * Write view state back into a query string, dropping both params at their
 * defaults so the plain `/works` URL stays clean — nobody should have to
 * share `?type=&view=covers`.
 *
 * The projects reading writes nothing: it is the plain URL. The log writes
 * what it always wrote, plus `view=log` where that would otherwise be
 * nothing — so `?type=talk` and `?view=index` read exactly as they always
 * did, and the unfiltered log has an address that is not the projects'.
 * The log's filter and form outlive a trip to the projects in the page's
 * state, but not in its URL: a link to the projects is a link to the
 * projects.
 *
 * Takes the current params and mutates a copy so unrelated query state
 * (anything another feature owns) survives a chip tap.
 */
export function serializeViewState(
  state: LogViewState,
  current?: URLSearchParams,
): string {
  const params = new URLSearchParams(current?.toString());

  if (state.reading !== "log") {
    params.delete(TYPE_PARAM);
    params.delete(FORM_PARAM);
    return params.toString();
  }

  if (state.types.length > 0) {
    params.set(TYPE_PARAM, state.types.join(","));
  } else {
    params.delete(TYPE_PARAM);
  }

  if (state.form !== DEFAULT_FORM) {
    params.set(FORM_PARAM, state.form);
  } else if (state.types.length === 0) {
    params.set(FORM_PARAM, LOG_VIEW_VALUE);
  } else {
    params.delete(FORM_PARAM);
  }

  return params.toString();
}
