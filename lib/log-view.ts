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
  type FilterableCommitType,
} from "./log";

// =============================================================================
// Density
// =============================================================================

/**
 * How much of each commit is printed. Named after the `git log` flags the
 * timeline already imitates, because they mean exactly the same thing here:
 *
 *  - `oneline` — subject line only. The overview: one row per commit, the
 *    whole career in two screens. Rich media is reachable but not shown
 *    (hover peek on a pointer device, or open the row).
 *  - `stat`    — subject line, a contact strip of every cover the row is
 *    holding, and one clamped line of what the thing is. Still one row per
 *    commit, so the overview survives, but the media is now *on screen*
 *    rather than behind a hover a phone cannot perform, and the covers have
 *    a caption. This is the middle the page was missing. It costs almost
 *    nothing: the description sits in the space a single cover leaves over,
 *    so the page grows by a couple of percent, not by a screen.
 *  - `patch`   — every row open: players, cards, commentary, tags. The full
 *    read.
 *
 * `stat` is the default. A first visit should land on the reading that does
 * both jobs at once — the whole career still scans as one column, and the
 * work itself is on screen rather than behind a hover a phone cannot
 * perform. `oneline` remains one tap away for whoever wants only the index.
 */
export const LOG_DENSITIES = ["oneline", "stat", "patch"] as const;

export type LogDensity = (typeof LOG_DENSITIES)[number];

export const DEFAULT_DENSITY: LogDensity = "stat";

export function isLogDensity(value: string): value is LogDensity {
  return (LOG_DENSITIES as readonly string[]).includes(value);
}

/** The `git log` invocation a density stands for — the control's tooltip. */
export const DENSITY_COMMAND: Record<LogDensity, string> = {
  oneline: "git log --oneline",
  stat: "git log --stat",
  patch: "git log -p",
};

// =============================================================================
// View state
// =============================================================================

export interface LogViewState {
  /**
   * Selected artifact types. Empty means "no filter" rather than "nothing
   * selected" — the rest-state of the chip row, where every commit shows.
   */
  types: FilterableCommitType[];
  density: LogDensity;
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
export const DENSITY_PARAM = "view";

/**
 * Read view state out of a query string.
 *
 * Tolerant by design — a hand-edited or stale URL degrades to the default
 * rather than rendering an empty page: unknown type names are dropped,
 * an unknown density falls back to `oneline`.
 */
export function parseViewState(params: URLSearchParams): LogViewState {
  const raw = params.get(TYPE_PARAM);
  const requested = raw ? raw.split(",").map((s) => s.trim()) : [];
  const types = FILTERABLE_COMMIT_TYPES.filter((t) => requested.includes(t));

  const density = params.get(DENSITY_PARAM);
  return {
    types,
    density: density && isLogDensity(density) ? density : DEFAULT_DENSITY,
  };
}

/**
 * Write view state back into a query string, dropping both params at their
 * defaults so the plain `/works` URL stays clean — nobody should have to
 * share `?type=&view=stat`.
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

  if (state.density !== DEFAULT_DENSITY) {
    params.set(DENSITY_PARAM, state.density);
  } else {
    params.delete(DENSITY_PARAM);
  }

  return params.toString();
}
