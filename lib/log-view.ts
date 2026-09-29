// =============================================================================
// Log View State — how deep /works is read, and what is in it.
//
// /works is one page with one model: the log, organised by what it made.
//
// Its first screen is the projects, as a resume — one row per project, in
// order of how much it mattered rather than when it happened, each wearing
// its logo (the About's badge icons), what I did on it, when, and where to
// see it. Under them, the rows no project claims: the other talks, the
// press, the career around the work, one line each. (lib/works-index.ts
// builds all of it, and says which rows belong to which project.)
//
// Those rows are not a summary of the log. They ARE the log, at a shallower
// depth: a project row is a container, and opening it — in place, the way
// an app opens from its icon — prints its history, the same commits the
// log prints, with their hash, their rail and their covers: Lynx opens into
// its ten talks, React Compiler into "React without memo". There is no
// second page to switch to; there is only how far down you have gone.
//
// Two things set that, and both apply to the whole page:
//
//  - the *form* (`?view=`) — how much of each row prints, and so how deep
//    the page stands at rest. See `LogForm`, below.
//  - the *types* (`?type=`) — which rows are in it at all. A filter that
//    names a kind of row opens every container holding one, so `?type=talk`
//    is the talks, under the projects they were about, then the rest.
//
// And one thing opens a single container: a `#hash` permalink, which opens
// whatever encloses its row and travels to it (app/works/view.tsx). A
// container the reader opens or closes by hand is a deviation from the
// depth the page is at, spent the moment the form or the filter changes —
// the same rule a row's own press follows (see TimelineCommit).
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
// a *form* is one preset of all of them — so the three depths of the page
// are compositions of the same atoms, and switching form is resetting every
// row to a preset rather than four hand-made layouts. A row the reader opens
// by hand is the same thing at a smaller scale: it takes the `feed` preset
// for itself (see TimelineCommit).
//
// On /works a form is also a depth — how far the page is opened at rest:
//
//  - `index`  — every row a line. The projects print as the second tier
//    does (the icon, the name, the part I played, the years), the lists
//    under them as the log's index. The whole of it in two screens. An
//    opened project's rows are title lines too; rich media is reachable
//    but not shown (hover peek on a pointer device, or open the row).
//  - `covers` — the default: the resume. Each project is its full entry —
//    two lines of description, its links — and opening one prints its rows
//    with the title, two lines, and the covers at a size you can recognise
//    a slide or a screenshot at. The lists under the projects stay lines.
//  - `feed`   — everything open: every project's history, every list, each
//    row with the grid at half a column, its captions written out, and the
//    prose and notes printed whole to match. This is the log as it always
//    read, organised by project. All the information is right there, so
//    nothing in it peeks or opens a sheet: a video plays where it is, a
//    card goes to its page.
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

/**
 * The git flags the forms were first named after — old links carry them —
 * and `log`, the plain log's address while it was a page of its own: the
 * whole log is the page opened all the way.
 */
const FORM_ALIAS: Record<string, LogForm> = {
  oneline: "index",
  stat: "covers",
  patch: "feed",
  log: "feed",
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
 * Every address /works has had still means what it meant: `?type=talk` is
 * the talks, `?view=index` the whole of it as lines, `?view=feed` (and
 * `patch`, and `log`) all of it open. A `#hash` permalink is not in the
 * query string; the page reads it on arrival and opens what encloses its
 * row (app/works/view.tsx).
 */
export function parseViewState(params: URLSearchParams): LogViewState {
  const raw = params.get(TYPE_PARAM);
  const requested = (raw ? raw.split(",").map((s) => s.trim()) : []).map(
    (name) => TYPE_ALIAS[name] ?? name,
  );
  const types = FILTERABLE_COMMIT_TYPES.filter((t) => requested.includes(t));
  const form = parseLogForm(params.get(FORM_PARAM)) ?? DEFAULT_FORM;

  return { types, form };
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
