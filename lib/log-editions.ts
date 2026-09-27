// =============================================================================
// Editions — one work, in several versions.
//
// A talk given in English and then in Chinese, the same talk again at
// another conference, a revised version a few months later. Each version
// is its own commit (its own date, venue, video) and says which other
// version it belongs with (`editionOf`). The versions a chain of those
// pointers connects are one work.
//
// Versions are alternatives, not a hierarchy. /works prints a work once,
// as one row at its lead version's date, with a badge per version on its
// title line. Choosing a version shows it in the row. A version dated away from the
// row keeps a quiet line at its own date that takes you there.
//
// This module is the pure half. React lives in components/log.
// =============================================================================

import type { Locale } from "./i18n";
import {
  commitVenue,
  computeCommitHash,
  localize,
  localizeOptional,
  type Commit,
} from "./log";

export interface EditionGroup {
  /** The version the pointers end at: a stable key for the work. */
  id: string;
  /** The version the row sits at and shows first, in this locale. */
  lead: Commit;
  /** Every version on the page: the lead first, then the others oldest
   *  first, then the quiet ones (`present: "aside"`). */
  versions: Commit[];
}

export interface Editions {
  /** Version id → its work. Only works with two or more versions. */
  groupOf: Map<string, EditionGroup>;
  /** Hash → version id, for every version. */
  byHash: Map<string, string>;
}

const EMPTY: Editions = { groupOf: new Map(), byHash: new Map() };

/**
 * Group the visible versions into works.
 *
 * Only visible versions join: a version the type filter or the locale left
 * out is not in its work's row, and a work reduced to one version is just
 * that commit again. A pointer to a missing id, or a cycle, is ignored.
 */
export function buildEditions(
  commits: readonly Commit[],
  isVisible: (commit: Commit) => boolean,
  locale: Locale,
): Editions {
  const visible = commits.filter(isVisible);
  const byId = new Map(visible.map((c) => [c.id, c]));

  // Union-find over the `editionOf` edges between visible commits.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== undefined && parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    parent.set(id, root);
    return root;
  };
  for (const c of visible) {
    if (!parent.has(c.id)) parent.set(c.id, c.id);
    if (c.editionOf && byId.has(c.editionOf) && c.editionOf !== c.id) {
      if (!parent.has(c.editionOf)) parent.set(c.editionOf, c.editionOf);
      const a = find(c.id);
      const b = find(c.editionOf);
      if (a !== b) parent.set(a, b);
    }
  }

  const members = new Map<string, Commit[]>();
  for (const c of visible) {
    const key = find(c.id);
    const list = members.get(key) ?? [];
    list.push(c);
    members.set(key, list);
  }

  const groupOf = new Map<string, EditionGroup>();
  const byHash = new Map<string, string>();
  const oldestFirst = (a: Commit, b: Commit) => a.date.localeCompare(b.date);

  for (const list of members.values()) {
    if (list.length < 2) continue;
    // The version the pointers end at: the one that points at nothing.
    const origin =
      list.find((c) => !c.editionOf || !byId.has(c.editionOf)) ??
      [...list].sort(oldestFirst)[0];
    const lead =
      list.find((c) => c.lead === locale) ??
      list.find((c) => c.lead === true) ??
      origin;
    const rest = list.filter((c) => c !== lead).sort(oldestFirst);
    const versions = [
      lead,
      ...rest.filter((c) => c.present !== "aside"),
      ...rest.filter((c) => c.present === "aside"),
    ];
    const group: EditionGroup = { id: origin.id, lead, versions };
    for (const c of list) {
      groupOf.set(c.id, group);
      byHash.set(computeCommitHash(c.id), c.id);
    }
  }

  return groupOf.size === 0 ? EMPTY : { groupOf, byHash };
}

/**
 * How a version is named in one line: `SEE Conf 2025 · 中文版`.
 *
 * The same words wherever a version is named in full: the badge's
 * tooltip and the quiet line at its own date. Venue first,
 * because a version is where it was given; then what it is. Without a
 * label the venue is enough, and without a venue the title stands in.
 */
export function editionLine(commit: Commit, locale: Locale): string {
  const venue = commitVenue(commit);
  const label = localizeOptional(commit.edition, locale)?.trim();
  const head = venue ?? localize(commit.title, locale);
  return label ? `${head} · ${label}` : head;
}

/** A version's short name, for its badge: its label, or its venue. */
export function editionShort(commit: Commit, locale: Locale): string {
  return (
    localizeOptional(commit.edition, locale)?.trim() ||
    commitVenue(commit) ||
    localize(commit.title, locale)
  );
}

const month = (date: string) => date.slice(0, 7);

/**
 * Whether `commit` happened within the time `row` covers: its own month, or
 * its whole span when it has one (`present` runs on forever). A commit that
 * the row already covers needs no line of its own at its date: the row is
 * where a reader looks for that stretch of time anyway.
 */
export function withinRange(commit: Commit, row: Commit): boolean {
  const at = month(commit.date);
  const start = month(row.date);
  const end =
    !row.endDate ? start : row.endDate === "present" ? "9999-12" : month(row.endDate);
  return at >= start && at <= end;
}
