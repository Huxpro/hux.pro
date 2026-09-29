// =============================================================================
// Log View State — one page, read at a depth.
//
// /works is one page with one model: the log. Every row on it is a commit,
// every chapter is a tag, and there is no second rendering of either — no
// curated page beside the log and no switch between them. What changes is
// how deep you are reading, and which of it you asked for:
//
//   depth    `resume` — the default — reads each chapter as a section of a
//            résumé: its opener (the name, the narrative), then its work,
//            one entry each with the project's logo, what I did on it and
//            the years, then what was said about the work folded to one
//            line (`talks 12 · press 1 — WeAreDevelopers, GOSIM, …`) that
//            unfolds in place into the log's own one-line rows. Above the
//            first chapter, a contents line per chapter with its logos.
//            `covers` and `feed` are the log as it always was — the hash
//            column, the tenure rail, the covers, then every attachment —
//            over the same rows in the same order.
//   opening  a row, or a chapter's fold, is going one step deeper on that
//            one thing: an entry opens into its prose, its covers, its
//            notes and its hash; a folded `talks & press` line opens into
//            its rows. A form change resets both, the way it always reset
//            an opened row.
//   types    narrow the one page. A chip means the same thing at every
//            depth, the contents line and the fold included: pick `Talks`
//            and the folds open, because they are what you asked for.
//
// So the old addresses all land on this page. `?view=` names a depth
// (`index`, and git's `--oneline`, are the résumé now: they were the
// overview, and this is the overview); `?type=` filters; `#hash` travels
// to a commit and opens the fold it is under (app/works/view.tsx).
//
// Not every row is the same kind of thing, either. A project is the work; a
// talk or a piece of press is somebody talking about it. Printed at one
// weight, nineteen talks buried eleven projects — the headline work of the
// current chapter was its thirteenth row. So a row has a *weight*, and a
// depth is a density per weight rather than one density for every row.
//
// This module is the vocabulary for all of it, and the URL codec that makes
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
// Form — how deep the page reads, as a composition.
//
// A row is made of a few independent parts: the title line (always), the
// description, the attachment object, the notes under it, and whether it
// peeks on hover. Each part has its own small set of states (`RowForm`), and
// a *form* is one preset of all of them — so the depths of the page are
// compositions of the same atoms, and switching depth is resetting every
// row to a preset rather than hand-made layouts. A row the reader opens
// by hand is the same thing at a smaller scale: it takes a deeper preset
// for itself (see `rowFormFor`).
//
//  - `resume` — the default, and the overview. The work prints as an entry:
//    its logo where the log hangs its hash, the name, what I did and where,
//    the years, and a few lines of what it was. What was said about it
//    prints one line a row, behind the chapter's fold. No hash, no rail:
//    the git wink waits one step down, and an opened entry prints its hash
//    in its author fields. It replaced the `index`, which was the overview
//    by being every row's title line, the talks' as loud as the work's.
//  - `covers` — the log: the hash column and the tenure rail, the work with
//    its description and its covers at a size you can recognise a slide or
//    a screenshot at, and a talk or a piece of press one line, its venue
//    beside the title. The folds start open.
//  - `feed`   — the grid, at half a column, with its captions written out,
//    and the prose and notes printed whole to match — every row, at every
//    weight. All the information is right there, so nothing in it peeks or
//    opens a sheet: a video plays where it is, a card goes to its page.
//
// A form sets the row's atoms, but it only *owns* two of them: the picture
// is the page's (`media`, `peek`), the prose is each row's (`description`,
// `notes`, and where the venue sits — see `rowFormFor`). Pressing a row's
// text relieves or clamps it against whatever the form printed; the picture
// holds still. What a form sets for the page as a whole — the gutter and
// the folds — is `PAGE_FORM`.
//
// The page borrowed git's vocabulary for these once (`--oneline`, `--stat`,
// `-p`); those names still parse, as aliases, so old links keep working.
// =============================================================================

export const LOG_FORMS = ["resume", "covers", "feed"] as const;

export type LogForm = (typeof LOG_FORMS)[number];

export const DEFAULT_FORM: LogForm = "resume";

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
   * handle signs beside it (or, in an entry, what I did and where), or
   * `beside` the title on the title line — the one-line row a minor commit
   * folds to, like a /writing entry. The handle has no slot on that line,
   * and does not need one: the chapter above already names the company.
   */
  meta: "under" | "beside";
}

const FEED: RowForm = {
  description: "full",
  media: "grid",
  notes: true,
  peek: false,
  meta: "under",
};

/** A talk or a piece of press, folded: its title line and nothing else. */
const ONE_LINE: RowForm = {
  description: "none",
  media: "none",
  notes: false,
  peek: true,
  meta: "beside",
};

export const ROW_FORM: Record<LogForm, Record<RowWeight, RowForm>> = {
  resume: {
    major: {
      description: "clamp",
      media: "none",
      notes: false,
      peek: false,
      meta: "under",
    },
    minor: ONE_LINE,
  },
  covers: {
    major: {
      description: "clamp",
      media: "covers",
      notes: false,
      peek: true,
      meta: "under",
    },
    minor: ONE_LINE,
  },
  feed: { major: FEED, minor: FEED },
};

/**
 * What a form sets for the page rather than for a row — the two things
 * every row in a chapter has to agree on.
 *
 *  - `gutter` — what hangs in the left margin. `log` is the hash column and
 *    the type mark on the tenure rail, the git graph; `entry` is the work's
 *    logo, at the size a résumé or a home screen sets one, and no rail — a
 *    rail between logos would bracket tenures nothing on screen names yet.
 *  - `fold` — whether a chapter's second half, what was said about the
 *    work, starts folded to its one summary line. Only ever the page's
 *    default: a chapter's line opens and closes on its own, and a filter
 *    naming a minor type opens them all (`minorFolded`).
 */
export interface PageForm {
  gutter: "log" | "entry";
  fold: boolean;
}

export const PAGE_FORM: Record<LogForm, PageForm> = {
  resume: { gutter: "entry", fold: true },
  covers: { gutter: "log", fold: false },
  feed: { gutter: "log", fold: false },
};

/**
 * Whether a chapter's `talks & press` starts folded: the depth says so, and
 * the reader has not asked for talks or press by name. A chip is a request
 * to see that type — folding what was just asked for behind a line would
 * make the chip a no-op until a second tap.
 */
export function minorFolded(
  form: LogForm,
  types: readonly FilterableCommitType[],
): boolean {
  return PAGE_FORM[form].fold && !types.some((t) => rowWeight(t) === "minor");
}

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
 * résumé, and a minor one in `covers`. Opening such a row brings its covers
 * with its prose, so an open row is the whole commit whatever the depth —
 * an entry opens into the log row it stands for. And an open row is never
 * one line — the venue goes back under the title. The other rows already
 * print the picture, so their press still owns the prose alone.
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

/**
 * Names the depths used to go by — old links carry them. The git flags the
 * forms were first named after, and `index`, the overview the résumé
 * replaced: a link to "the page, at a glance" still gets the page at a
 * glance.
 */
const FORM_ALIAS: Record<string, LogForm> = {
  index: "resume",
  oneline: "resume",
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
