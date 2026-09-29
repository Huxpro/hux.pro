// =============================================================================
// Threads — commits that /works prints inside another commit.
//
// Two relations put a commit inside another one:
//
//  - **edition**: another telling of the same work (`editionOf`). The Chinese
//    edition of a talk, the same talk at a second conference.
//  - **evidence**: work that is about a project (`about[0]`, its first
//    project). The talk that introduced a release, the post that explained
//    it. A project that holds evidence is how a release looks on the page:
//    no new commit type, just a project other commits point at.
//
// Either way the child keeps a quiet line at its own date that takes you to
// where it is printed in full, and the parent lists it. Nothing is merged:
// every commit stays flat in log.json, can be featured and embedded on its
// own, and prints as an ordinary row again whenever its parent is not on the
// page (a type filter, a locale scope, a typo).
//
// Depth is at most three: a project, the talks about it, their editions.
// Projects about other projects are not threaded here; that is a branch,
// and branches are drawn by the tree view.
//
// This module is the pure half. React lives in components/log.
// =============================================================================

import type { Locale } from "./i18n";
import {
  commitVenue,
  computeCommitHash,
  getCommitTypeLabel,
  getCommitTypePluralLabel,
  localize,
  localizeOptional,
  type Commit,
  type CommitType,
} from "./log";

export type ThreadRelation = "edition" | "evidence";

export interface CommitThreads {
  /** Child id → its parent on the page, and how it relates to it. */
  parentOf: Map<string, { id: string; relation: ThreadRelation }>;
  /** Parent id → its editions, oldest first. */
  editionsOf: Map<string, Commit[]>;
  /** Project id → the work about it, oldest first. */
  evidenceOf: Map<string, Commit[]>;
  /** Hash → id, for every commit that lives inside another. */
  byHash: Map<string, string>;
}

const EMPTY: CommitThreads = {
  parentOf: new Map(),
  editionsOf: new Map(),
  evidenceOf: new Map(),
  byHash: new Map(),
};

/**
 * Where each visible commit sits.
 *
 * `editionOf` can point at another edition; the chain is followed to its
 * end, so an original holds one flat list. A cycle, a typo, or an original
 * that is not visible leaves the edition where it is.
 *
 * Evidence is a commit's first `about` project. Only work is threaded this
 * way (not projects, roles or events), and an edition is threaded under its
 * original rather than under a project: it goes wherever the original goes.
 */
export function buildThreads(
  commits: readonly Commit[],
  isVisible: (commit: Commit) => boolean,
): CommitThreads {
  const byId = new Map(commits.map((c) => [c.id, c]));

  const originalOf = (commit: Commit): Commit | null => {
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

  const parentOf: CommitThreads["parentOf"] = new Map();
  const editionsOf = new Map<string, Commit[]>();
  const evidenceOf = new Map<string, Commit[]>();
  const byHash = new Map<string, string>();
  const add = (
    map: Map<string, Commit[]>,
    parent: string,
    child: Commit,
    relation: ThreadRelation,
  ) => {
    parentOf.set(child.id, { id: parent, relation });
    byHash.set(computeCommitHash(child.id), child.id);
    const list = map.get(parent) ?? [];
    list.push(child);
    map.set(parent, list);
  };

  // A project other projects are about is a family (Lynx, with its
  // releases under it). Work about the family itself is not folded into it:
  // the family's row sits where it began, years below that work, and would
  // turn the whole chapter into a column of pointers. That work stays on
  // the main line here, and the graph view draws it on the family's lane.
  const families = new Set<string>();
  for (const c of commits) {
    if (c.type === "project" && c.about?.[0] && isVisible(c)) {
      families.add(c.about[0]);
    }
  }

  for (const c of commits) {
    if (!isVisible(c)) continue;

    const original = originalOf(c);
    if (original && isVisible(original)) {
      add(editionsOf, original.id, c, "edition");
      continue;
    }

    if (c.type === "project" || c.type === "role" || c.type === "event") {
      continue;
    }
    const project = c.about?.[0] ? byId.get(c.about[0]) : undefined;
    if (
      project &&
      project.type === "project" &&
      !families.has(project.id) &&
      isVisible(project)
    ) {
      add(evidenceOf, project.id, c, "evidence");
    }
  }

  if (parentOf.size === 0) return EMPTY;
  const oldestFirst = (a: Commit, b: Commit) => a.date.localeCompare(b.date);
  for (const list of editionsOf.values()) list.sort(oldestFirst);
  for (const list of evidenceOf.values()) list.sort(oldestFirst);
  return { parentOf, editionsOf, evidenceOf, byHash };
}

/** The chain from the row printed on the main timeline down to `id`. */
export function threadPath(threads: CommitThreads, id: string): string[] {
  const path = [id];
  const seen = new Set(path);
  for (
    let p = threads.parentOf.get(id);
    p && !seen.has(p.id);
    p = threads.parentOf.get(p.id)
  ) {
    path.unshift(p.id);
    seen.add(p.id);
  }
  return path;
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

/**
 * How a piece of evidence is named on the main timeline:
 * `React Conf 2021 · React without memo`. Where it happened, then what.
 */
export function evidenceLine(commit: Commit, locale: Locale): string {
  const venue = commitVenue(commit);
  const title = localize(commit.title, locale);
  if (!venue || venue.trim().toLowerCase() === title.trim().toLowerCase()) {
    return title;
  }
  return `${venue} · ${title}`;
}

/** `+1 edition` / `+2 editions` / `+1 个版本` — the original's meta line. */
export function editionCountLabel(count: number, locale: Locale): string {
  if (locale === "zh") return `+${count} 个版本`;
  return `+${count} edition${count === 1 ? "" : "s"}`;
}

/**
 * What a project holds, by type: `3 talks`, `2 talks · 1 post`,
 * `3 个演讲`. The same words as the type filter's chips.
 */
export function evidenceCountLabel(
  evidence: readonly Commit[],
  locale: Locale,
): string {
  const counts = new Map<CommitType, number>();
  for (const c of evidence) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  return [...counts]
    .map(([type, n]) => {
      if (locale === "zh") return `${n} 个${getCommitTypeLabel(type, locale)}`;
      const word =
        n === 1
          ? getCommitTypeLabel(type, locale)
          : getCommitTypePluralLabel(type, locale);
      return `${n} ${word.toLowerCase()}`;
    })
    .join(" · ");
}

/** The month a commit happened in, for "is the pointer next to its row?" */
export function monthOf(commit: Commit): string {
  return commit.date.slice(0, 7);
}

/**
 * Everything about a project, as a flat list, newest first: the work that
 * names it first in `about`, and the editions of that work. It is how a
 * place that references a release (a featured group, an album) shows the
 * talks inside it, while the group itself names the release once.
 */
export function workAbout(
  projectId: string,
  commits: readonly Commit[],
): Commit[] {
  const direct = commits.filter(
    (c) =>
      c.about?.[0] === projectId &&
      c.type !== "project" &&
      c.type !== "role" &&
      c.type !== "event",
  );
  const ids = new Set(direct.map((c) => c.id));
  const byId = new Map(commits.map((c) => [c.id, c]));
  const reachesWork = (c: Commit) => {
    const seen = new Set<string>();
    for (let id = c.editionOf; id && !seen.has(id); id = byId.get(id)?.editionOf) {
      if (ids.has(id)) return true;
      seen.add(id);
    }
    return false;
  };
  const editions = commits.filter((c) => !ids.has(c.id) && reachesWork(c));
  return [...direct, ...editions].sort((a, b) => b.date.localeCompare(a.date));
}
