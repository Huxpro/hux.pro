// =============================================================================
// Editions — the same work, told more than once.
//
// A talk given in English and then in Chinese, the same talk again at a
// second conference, a revised version a few months later. Each telling is
// its own commit (its own date, venue, video), and each one says which
// commit it is an edition of (`editionOf`).
//
// /works reads that pointer two ways:
//
//  - The original row holds its editions. Open it and they are listed
//    under it, one nested row each.
//  - Each edition keeps a quiet line at its own date on the main timeline,
//    so the chronology still says "Nov 2025, SEE Conf". Pressing that line
//    opens the original and takes you to the edition inside it.
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

export interface EditionThreads {
  /** Edition id → the id of the original it belongs to. */
  rootOf: Map<string, string>;
  /** Original id → its editions, oldest first. */
  editionsOf: Map<string, Commit[]>;
  /** Hash → edition id, for the permalink of an edition. */
  byHash: Map<string, string>;
}

const EMPTY: EditionThreads = {
  rootOf: new Map(),
  editionsOf: new Map(),
  byHash: new Map(),
};

/**
 * Group every visible edition under its original.
 *
 * `editionOf` can point at another edition (the English re-run of an
 * English debut that was itself an edition of a Chinese original); the
 * chain is followed to its end, so an original holds one flat list.
 *
 * An edition only joins a thread when its original is on the page too. If
 * the original is filtered out, not listed in this locale, or the id is a
 * typo, the edition is left alone and prints as the ordinary row it is.
 * A cycle is treated the same way.
 */
export function buildEditionThreads(
  commits: readonly Commit[],
  isVisible: (commit: Commit) => boolean,
): EditionThreads {
  const byId = new Map(commits.map((c) => [c.id, c]));

  const rootFor = (commit: Commit): Commit | null => {
    const seen = new Set<string>([commit.id]);
    let current = commit;
    while (current.editionOf) {
      const next = byId.get(current.editionOf);
      if (!next || seen.has(next.id)) return null;
      seen.add(next.id);
      current = next;
    }
    return current === commit ? null : current;
  };

  const rootOf = new Map<string, string>();
  const editionsOf = new Map<string, Commit[]>();
  const byHash = new Map<string, string>();

  for (const c of commits) {
    if (!c.editionOf || !isVisible(c)) continue;
    const root = rootFor(c);
    if (!root || !isVisible(root)) continue;
    rootOf.set(c.id, root.id);
    byHash.set(computeCommitHash(c.id), c.id);
    const list = editionsOf.get(root.id) ?? [];
    list.push(c);
    editionsOf.set(root.id, list);
  }

  if (rootOf.size === 0) return EMPTY;
  for (const list of editionsOf.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }
  return { rootOf, editionsOf, byHash };
}

/**
 * How an edition is named in one line: `SEE Conf 2025 · 中文版`.
 *
 * The same words on the main timeline and inside the original, so the line
 * you press and the line you land on read as one thing. Venue first,
 * because the line is a dateline; then what this edition is. Without a
 * label the venue is enough, and without a venue the title stands in.
 */
export function editionLine(commit: Commit, locale: Locale): string {
  const venue = commitVenue(commit);
  const label = localizeOptional(commit.edition, locale)?.trim();
  const head = venue ?? localize(commit.title, locale);
  return label ? `${head} · ${label}` : head;
}

/** `+1 edition` / `+2 editions` / `+1 个版本` — the original's meta line. */
export function editionCountLabel(count: number, locale: Locale): string {
  if (locale === "zh") return `+${count} 个版本`;
  return `+${count} edition${count === 1 ? "" : "s"}`;
}
