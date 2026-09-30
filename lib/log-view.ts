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
// =============================================================================

import {
  FILTERABLE_COMMIT_TYPES,
  type CommitType,
  type FilterableCommitType,
} from "./log";

// =============================================================================
// The ledger — how the index reads a chapter.
//
// `git log --oneline` prints a line per commit and the reader is left to sort
// the work from what was said about it. A CV does that sorting for them: the
// projects, then the talks, then the press, each one line with its venue in
// a column. The index form borrows the CV's order and nothing else — the
// hash, the mark, the rail, the chapter pill and the toolbar stay — so the
// overview is the log's own one-liners, tabulated. The other forms keep the
// chronology: they are the log; the index is its table of contents.
//
// Three groups, in the order a CV lists them. Roles and events sit with the
// work: a degree is a line of the CV, a move is a dateline between two, and
// neither is something said *about* the work.
// =============================================================================

export type LedgerGroup = "work" | "talk" | "press";

export const LEDGER_GROUPS: readonly LedgerGroup[] = ["work", "talk", "press"];

export function ledgerGroup(type: CommitType): LedgerGroup {
  if (type === "talk" || type === "post") return "talk";
  if (type === "press") return "press";
  return "work";
}

/** A chapter in the ledger's order, and where each group starts in it. */
export interface LedgerChapter<T> {
  ordered: T[];
  starts: { index: number; group: LedgerGroup }[];
}

/**
 * A chapter's rows regrouped: the work, then the talks, then the press,
 * each group still in the order it arrived (newest first). Stable, and
 * generic over anything with a `type`, so the page and the editor group a
 * chapter identically.
 */
export function groupChapter<T extends { type: CommitType }>(
  commits: readonly T[],
): LedgerChapter<T> {
  const ordered: T[] = [];
  const starts: LedgerChapter<T>["starts"] = [];
  for (const group of LEDGER_GROUPS) {
    const rows = commits.filter((c) => ledgerGroup(c.type) === group);
    if (rows.length === 0) continue;
    starts.push({ index: ordered.length, group });
    ordered.push(...rows);
  }
  return { ordered, starts };
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
//  - `index`  — the default: one line per commit — title, the venue (or
//    the team) in a column, the date — with each chapter tabulated the way
//    a CV is (`groupChapter`): the work, then the talks, then the press.
//    The whole career in two screens. Rich media is reachable but not shown
//    (hover peek on a pointer device, or open the row).
//  - `covers` — the title, two lines, and the covers at a size
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

export const DEFAULT_FORM: LogForm = "index";

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
  /**
   * Where the venue goes: `under` the title on a line of its own, where
   * the handle signs beside it, or `beside` the title in a column of its
   * own before the date — the one-line row, as a CV prints it. That line
   * has no slot for the handle and needs none: the chapter names the
   * company, and an open row prints the author fields.
   */
  meta: "under" | "beside";
}

export const ROW_FORM: Record<LogForm, RowForm> = {
  index: {
    description: "none",
    media: "none",
    notes: false,
    peek: true,
    meta: "beside",
  },
  covers: {
    description: "clamp",
    media: "covers",
    notes: false,
    peek: true,
    meta: "under",
  },
  feed: {
    description: "full",
    media: "grid",
    notes: true,
    peek: false,
    meta: "under",
  },
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
 * The exception is the index, the one form that prints no picture at all:
 * opening an index row brings its covers with its prose, so an open row is
 * the whole commit whatever the form — and is never one line: the venue
 * goes back under the title, where the handle signs. The other forms
 * already print the picture, so their press still owns the prose alone.
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
