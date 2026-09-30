// =============================================================================
// Log View State — how much of the timeline is on screen, and which of it.
//
// /works carries more information than any one reading of it can use: 35
// commits, ~37 pieces of rich media, four eras. Folded to title lines it
// is a list with no hierarchy in it; fully unfolded it is a thirteen-screen
// media wall with no overview left. The states people actually want —
// "what is this, in one page", "let me see the work" and "show me
// everything" — are three readings of the same page, plus the ability to
// narrow what is in each.
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
// Form — how much of each commit is printed, as a composition.
//
// A row is made of a few independent parts: the title line (always), the
// description, the attachment object, the notes under it, and whether it
// peeks on hover. Each part has its own small set of states (`RowForm`), and
// a *form* is one preset of all of them — so the readings of the log are
// compositions of the same atoms, and switching form is resetting every
// row to a preset rather than hand-made layouts. A row the reader opens
// by hand is the same thing at a smaller scale: it takes the `feed` preset
// for itself (see TimelineCommit).
//
//  - `index`  — the title line only: one row per commit. Rich media is
//    reachable but not shown (hover peek on a pointer device, or open the
//    row). /works no longer offers it as a page form — its first stop is
//    the overview ("Page forms", below) — but it is still the row a commit
//    steps down to there while another chapter's track is held
//    (LogTimeline), and the Works Lab still prints the log this way.
//  - `covers` — the default: the title, two lines, and the covers at a size
//    you can recognise a slide or a screenshot at. Still one row per commit,
//    so the chronology survives, but the work is on screen rather than
//    behind a hover a phone cannot perform.
//  - `feed`   — the grid, at half a column, with its captions written out,
//    and the prose and notes printed whole to match. All the information is
//    right there, so nothing in it peeks or opens a sheet: a video plays
//    where it is, a card goes to its page.
//
// A form sets all four atoms, but it only *owns* two of them: the picture
// is the page's (`media`, `peek`), the prose is each row's (`description`,
// `notes` — see `rowFormFor`). Pressing a row's text relieves or clamps it
// against whatever the form printed; the picture holds still.
// =============================================================================

export const LOG_FORMS = ["index", "covers", "feed"] as const;

export type LogForm = (typeof LOG_FORMS)[number];

/** The log's default and the page's alike — so typed as the one word, which
 *  is both a `LogForm` and a `WorksForm` (below). */
export const DEFAULT_FORM = "covers" satisfies LogForm & WorksForm;

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

// =============================================================================
// Page forms — the three stops of /works's form control.
//
// The index was meant to be the overview, "the whole career in two
// screens", and it was two screens of thirty-odd title lines at one weight,
// newest first: talks swamped projects, Lynx was the twelfth row, and
// nothing said what I did on any of it. An overview is a different shape
// from a log, not a thinner one, so its stop on the control is a different
// page under the same bar rather than another row preset:
//
//  - `overview` — the career in tiers, the way a projects page or a CV
//    reads (components/log/works-overview.tsx): the selected works, each
//    printed whole — mark, name, years, who I was on it, the description,
//    where to see it — then the rest at one line a work: more projects,
//    talks, press. About three screens, and the question a newcomer
//    arrives with is answered in the first. The type chips narrow it by
//    tier, and every row opens where the log's covers would open it.
//  - `covers`, `feed` — the log, in the row forms above.
//
// The overview is not a `LogForm`: it prints no timeline rows, so nothing
// built on `ROW_FORM` ever sees it, and the log's forms stay the log's.
// Nor does a held track apply to it. A hold is the log's — a chapter's ref
// marker with focus, lighting its track on the graph and stepping every
// other commit down a form — and the overview has no refs, no graph and
// no row forms to step: it is already the reading a hold reaches for, the
// work without the chronology. Switching to it lets a hold go (the marker
// leaves the page), and switching back finds the log at rest. Under a hold
// the log's two forms step down to `index` rows, as they always did; the
// quiet line below that is only reached where `index` is the page's form
// (the Works Lab).
//
// `overview` is the URL's word because it is the control's word. `index`
// parses to it — its links meant "the overview", and now land on one — as
// does `oneline`, the git flag the index was first named after. The other
// two flags (`--stat`, `-p`) still name the log's two forms.
// =============================================================================

export const WORKS_FORMS = ["overview", "covers", "feed"] as const;

export type WorksForm = (typeof WORKS_FORMS)[number];

/** The stops' old names — the index's, and the git flags before it. */
const FORM_ALIAS: Record<string, WorksForm> = {
  index: "overview",
  oneline: "overview",
  stat: "covers",
  patch: "feed",
};

export function parseWorksForm(value: string | null): WorksForm | null {
  if (!value) return null;
  if ((WORKS_FORMS as readonly string[]).includes(value)) {
    return value as WorksForm;
  }
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
  form: WorksForm;
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
    form: parseWorksForm(params.get(FORM_PARAM)) ?? DEFAULT_FORM,
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
