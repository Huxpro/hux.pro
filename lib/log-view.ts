// =============================================================================
// Log View State — how much of the timeline is on screen, and which of it.
//
// /works carries more information than any one reading of it can use: 25
// commits, ~37 pieces of rich media, three eras. Folded, the page is a
// two-screen overview and every cover is invisible; fully unfolded it is a
// thirteen-screen media wall with no overview left. The two states people
// actually want — "show me everything at once" and "let me see the work" —
// are the same page at two different densities, plus the ability to narrow
// what is in it.
//
// This module is the vocabulary for both, and the URL codec that makes a
// reading shareable. It is deliberately free of React and of `lib/log`'s
// data layer: the parse/serialize pair is the whole contract, so the query
// string stays the single source of truth for view state.
//
// Above both sits the page's *reading* — which of two pages /works is:
//
//  - `selected` — the default, and the page a newcomer meets. Curated, in
//    tiers, prose first: the handful of works that matter most with what I
//    did on each, then the rest of the projects, the talks and the press as
//    short lists. It answers "what are this person's most important works,
//    what did they do on each, when, and where can I see it?" in a screen,
//    which the log, at one row per commit and equal weight for every row,
//    could not. The curation is data (`works-selected` in content/log.json).
//  - `log` — the archive: the whole commit history, exactly as it has
//    always been, with its filter and its three forms.
//
// The reading has no param of its own worth sharing at rest; it is implied
// by the two params that already exist, so every link written before the
// selected reading existed still lands in the log:
//
//    /works                      selected
//    /works?view=log             log, default form
//    /works?view=index|feed|…    log, that form (git-flag aliases included)
//    /works?type=talk            log, filtered
//    /works#<hash>               log, travelled to that commit — decided by
//                                the page (a fragment never reaches a query
//                                codec), see app/works/view.tsx
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
// Reading — which of the two pages /works is (see the header).
// =============================================================================

export const WORKS_READINGS = ["selected", "log"] as const;

export type WorksReading = (typeof WORKS_READINGS)[number];

export const DEFAULT_READING: WorksReading = "selected";

/** The `view` value that names the log without naming a form: the log at
 *  its default form. A form is already a statement that you want the log,
 *  so `?view=index` needs no second word to say it. */
const LOG_VIEW_VALUE = "log";

// =============================================================================
// View state
// =============================================================================

export interface LogViewState {
  /** Selected works or the whole log. The two fields below are the log's,
   *  and only reach the URL while the log is what is on screen. */
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
 * Either param at all means the log. A `type` naming nothing we know still
 * does — whoever wrote it was asking for the log, and the unfiltered log is
 * closer to that than the selected page is — and so does a `view` we
 * cannot read, for the same reason.
 */
export function parseViewState(params: URLSearchParams): LogViewState {
  const raw = params.get(TYPE_PARAM);
  const requested = (raw ? raw.split(",").map((s) => s.trim()) : []).map(
    (name) => TYPE_ALIAS[name] ?? name,
  );
  const types = FILTERABLE_COMMIT_TYPES.filter((t) => requested.includes(t));
  const view = params.get(FORM_PARAM);

  return {
    reading: raw !== null || view !== null ? "log" : DEFAULT_READING,
    types,
    form: parseLogForm(view) ?? DEFAULT_FORM,
  };
}

/**
 * Write view state back into a query string, dropping both params at their
 * defaults so the plain `/works` URL stays clean — nobody should have to
 * share `?type=&view=covers`.
 *
 * The selected reading writes neither: it is the page at rest. The log
 * writes what tells it apart — its filter and its form where they are not
 * the defaults, and `view=log` where neither would be there to say so.
 *
 * Takes the current params and mutates a copy so unrelated query state
 * (anything another feature owns) survives a chip tap.
 */
export function serializeViewState(
  state: LogViewState,
  current?: URLSearchParams,
): string {
  const params = new URLSearchParams(current?.toString());
  const log = state.reading === "log";

  if (log && state.types.length > 0) {
    params.set(TYPE_PARAM, state.types.join(","));
  } else {
    params.delete(TYPE_PARAM);
  }

  if (log && state.form !== DEFAULT_FORM) {
    params.set(FORM_PARAM, state.form);
  } else if (log && state.types.length === 0) {
    params.set(FORM_PARAM, LOG_VIEW_VALUE);
  } else {
    params.delete(FORM_PARAM);
  }

  return params.toString();
}
