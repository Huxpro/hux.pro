// =============================================================================
// Log View State — how deep into /works the page is, and which of it.
//
// /works is one page and one model: a git log whose branches are the places
// the work was done (`lib/log-places.ts`). ByteDance, Meta, RIT … are each a
// branch of the one log; what was done nowhere in particular — the blog, a
// community talk given between two jobs, the sabbatical — is a commit on
// `main`, between the branches, at its date. There is no second reading and
// no switch to reach one: there is how *deep* into the log the page is.
//
//   summary   each branch folded to what a CV would print: a quiet header
//             (the place, the role, the dates) with its tenure rail, the
//             projects under it as rows with their logos and whole prose,
//             and the talks and press folded into one line. The default,
//             and the bare URL.
//   index     every branch unfolded into its commits, one line each — the
//   covers    hash column and the rail appear, and the rows are the log's
//   feed      own rows at the log's three densities (`ROW_FORM` below).
//
// A branch can go one step deeper on its own: its fold line (`Talks 12 · …`)
// unfolds it, in place, into its commits at `index`, and folds it back. The
// depth control sets every branch at once; it is the same control at every
// depth, and so are the type chips — a filter narrows the summary exactly as
// it narrows the rows, so `Talks` on the summary is every branch with its
// talks listed and nothing else.
//
// This module is the vocabulary for both — the depth and the filter — and
// the URL codec that makes a reading shareable. It is deliberately free of
// React and of `lib/log`'s data layer: the parse/serialize pair is the whole
// contract, so the query string stays the single source of truth.
//
//   /works                   the summary, everything in it
//   /works?type=talk         the summary, talks only (the home widgets'
//                            `?type=project` and `?type=talk` land here)
//   /works?view=index        every branch unfolded, in a form (covers and
//                            feed too, and the git-flag aliases in
//                            FORM_ALIAS; `view=log` is covers, the form the
//                            log used to open in)
//   /works#<hash>            the commit: a row the summary prints (a
//                            project, a role's header, an event) is
//                            travelled to where it is; one it folds (a
//                            talk, a press piece) unfolds its branch first
//                            (app/works/view.tsx)
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
// a *form* is one preset of all of them — so the three unfolded depths of the
// page are compositions of the same atoms, and switching form is resetting every
// row to a preset rather than four hand-made layouts. A row the reader opens
// by hand is the same thing at a smaller scale: it takes the `feed` preset
// for itself (see TimelineCommit).
//
//  - `index`  — the title line only: one row per commit, the whole career
//    in two screens, and what a branch unfolds into on its own. Rich media is reachable but not shown
//    (hover peek on a pointer device, or open the row).
//  - `covers` — the log's own default (a row outside /works' depths — the
//    editor — prints at it): the title, two lines, and the covers at a size
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
// So does `log`, which named the log itself while it was a separate reading
// of the page, and lands in the form that reading opened in.
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
  log: "covers",
};

export function parseLogForm(value: string | null): LogForm | null {
  if (!value) return null;
  if ((LOG_FORMS as readonly string[]).includes(value)) return value as LogForm;
  return FORM_ALIAS[value] ?? null;
}

// =============================================================================
// Depth — how far into the log the page is unfolded.
// =============================================================================

/**
 * The page's depths, shallowest first: the summary, then the log's three
 * forms. One scale rather than a reading plus a form, because they are one
 * question — how much of each branch is printed — and the control that
 * answers it is one segmented row. See the header for what each prints.
 */
export const LOG_DEPTHS = ["summary", ...LOG_FORMS] as const;

export type LogDepth = (typeof LOG_DEPTHS)[number];

export const DEFAULT_DEPTH: LogDepth = "summary";

/**
 * The form a branch unfolds into on its own, from the summary: one step
 * deeper, one line per commit. The branch has just printed its projects
 * whole, so what the reader is asking for is the rest of its history, not
 * the same prose again beside twelve talks' covers.
 */
export const UNFOLD_FORM: LogForm = "index";

/** The form an unfolded branch's rows take at a depth. */
export function formAtDepth(depth: LogDepth): LogForm {
  return depth === "summary" ? UNFOLD_FORM : depth;
}

export function parseLogDepth(value: string | null): LogDepth | null {
  if (value === "summary") return "summary";
  return parseLogForm(value);
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
  depth: LogDepth;
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
 * an unknown depth falls back to the summary.
 */
export function parseViewState(params: URLSearchParams): LogViewState {
  const raw = params.get(TYPE_PARAM);
  const requested = (raw ? raw.split(",").map((s) => s.trim()) : []).map(
    (name) => TYPE_ALIAS[name] ?? name,
  );
  return {
    types: FILTERABLE_COMMIT_TYPES.filter((t) => requested.includes(t)),
    depth: parseLogDepth(params.get(FORM_PARAM)) ?? DEFAULT_DEPTH,
  };
}

/**
 * Write view state back into a query string, dropping both params at their
 * defaults so the plain `/works` URL stays clean — nobody should have to
 * share `?type=&view=summary`.
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

  if (state.depth !== DEFAULT_DEPTH) {
    params.set(FORM_PARAM, state.depth);
  } else {
    params.delete(FORM_PARAM);
  }

  return params.toString();
}
