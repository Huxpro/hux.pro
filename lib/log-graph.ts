// =============================================================================
// The graph — /works as `git log --graph`.
//
// The page is a time axis. The graph adds the other one: which project each
// commit belongs to. Every project that has work about it becomes a lane;
// the work sits on that lane at its own date; a project about another
// project (a release, a sub-project) branches off its parent's lane; the
// project's own row is where its lane forks. Everything else stays on the
// main line, which is where the rail already runs.
//
//   │ ● WAD 2026 workshop          lynx
//   │ ● lynx-ui talk               lynx ─ lynx-ui
//   │ │ ◆ lynx-ui                  (fork from lynx)
//   │ ● React for Two Threads      lynx
//   │ │ ● D2                       lynx ─ open source
//   │ │ ◆ Lynx goes open source    (fork from lynx)
//   ● │ FEDAY 2023                 main
//   │ ◆ Lynx Framework             (fork from main)
//   ●   Sabbatical                 main
//
// Lanes are resolved per chapter, like the rail: a chapter is a stretch of
// page, and a line that left one chapter and came back in another would be
// drawn across a marker that says the story changed.
//
// Pure. The drawing is components/log/graph-lanes.tsx.
// =============================================================================

import type { Commit } from "./log";

export interface GraphLane {
  /** The project this lane belongs to. */
  id: string;
  /**
   * The lane's name, as a git branch: `lynx`, `lynx/ui`. A sub-project's
   * name starts with its parent's, so the name says where it branched.
   */
  name: string;
  /** Column, 1-based: column 0 is the main line. */
  col: number;
  /** The column it forks from: its parent project's, or the main line. */
  from: number;
  /** Row indices (into the chapter's commits) of its topmost and bottommost
   *  member. The bottom row is where it forks. */
  top: number;
  bottom: number;
}

export interface GraphLayout {
  /** Commit id → the column its dot sits in. */
  colOf: Map<string, number>;
  lanes: GraphLane[];
  /** How many columns the chapter needs, main line included. */
  cols: number;
}

const EMPTY: GraphLayout = { colOf: new Map(), lanes: [], cols: 1 };

/**
 * Lay out one chapter.
 *
 * `commits` is the chapter in render order; `isHidden` is the page's one
 * rule for rows that are not printed (a filter, a suppressed role). A lane
 * is only drawn through rows that are on the page.
 *
 * Where a commit sits:
 *  - an edition sits wherever its original sits;
 *  - otherwise it sits on its first `about` project, when that project is
 *    in this chapter;
 *  - otherwise on the main line.
 * A project that anything sits on gets a lane, and the project itself sits
 * on its own lane, at the bottom, where the lane forks from its parent.
 */
export function layoutGraph(
  commits: readonly Commit[],
  isHidden: (commit: Commit) => boolean,
): GraphLayout {
  const index = new Map<string, number>();
  commits.forEach((c, i) => {
    if (!isHidden(c)) index.set(c.id, i);
  });
  const byId = new Map(commits.map((c) => [c.id, c]));

  // The project a commit is about, if it is on this page.
  const aboutOf = (c: Commit): string | null => {
    const first = c.about?.[0];
    if (!first || first === c.id || !index.has(first)) return null;
    return byId.get(first)?.type === "project" ? first : null;
  };
  // The original an edition belongs to, followed to its end.
  const originalOf = (c: Commit): Commit => {
    const seen = new Set([c.id]);
    let current = c;
    while (current.editionOf) {
      const next = byId.get(current.editionOf);
      if (!next || seen.has(next.id) || !index.has(next.id)) break;
      seen.add(next.id);
      current = next;
    }
    return current;
  };
  // Where a commit hangs: a project id, or null for the main line.
  const hangsOn = (c: Commit): string | null => aboutOf(originalOf(c));

  // Members of each project's lane.
  const members = new Map<string, number[]>();
  for (const [id, i] of index) {
    const on = hangsOn(byId.get(id)!);
    if (!on) continue;
    const list = members.get(on) ?? [];
    list.push(i);
    members.set(on, list);
  }
  if (members.size === 0) return EMPTY;

  // Parents before children, so a child can take a column to the right of
  // the lane it forks from.
  const depth = (id: string): number => {
    let d = 0;
    const seen = new Set<string>();
    for (let p = hangsOn(byId.get(id)!); p && !seen.has(p); p = hangsOn(byId.get(p)!)) {
      seen.add(p);
      d += 1;
    }
    return d;
  };
  const ids = [...members.keys()].sort(
    (a, b) => depth(a) - depth(b) || index.get(b)! - index.get(a)!,
  );

  const lanes: GraphLane[] = [];
  const colOfLane = new Map<string, number>();
  const nameOfLane = new Map<string, string>();
  for (const id of ids) {
    const rows = [...members.get(id)!, index.get(id)!];
    const top = Math.min(...rows);
    const bottom = Math.max(...rows);
    const parent = hangsOn(byId.get(id)!);
    const from = parent ? (colOfLane.get(parent) ?? 0) : 0;
    // The first column right of the parent that is free over the whole span.
    let col = from + 1;
    while (
      lanes.some((l) => l.col === col && l.top <= bottom && top <= l.bottom)
    ) {
      col += 1;
    }
    colOfLane.set(id, col);
    const segment = branchSegment(byId.get(id)!);
    const parentName = parent ? nameOfLane.get(parent) : undefined;
    const name = parentName ? `${parentName}/${segment}` : segment;
    nameOfLane.set(id, name);
    lanes.push({ id, name, col, from, top, bottom });
  }

  const colOf = new Map<string, number>();
  for (const [id] of index) {
    const c = byId.get(id)!;
    const own = colOfLane.get(id);
    if (own !== undefined) {
      colOf.set(id, own);
      continue;
    }
    const on = hangsOn(c);
    colOf.set(id, on ? (colOfLane.get(on) ?? 0) : 0);
  }

  return {
    colOf,
    lanes,
    cols: Math.max(1, ...lanes.map((l) => l.col + 1)),
  };
}

/** A project's own segment of its branch name: authored, or its English
 *  title as a slug (`Hermes JavaScript Engine` → `hermes-javascript-engine`). */
function branchSegment(project: Commit): string {
  if (project.type === "project" && project.branch?.trim()) {
    return project.branch.trim();
  }
  return (
    project.title.en
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || project.id
  );
}
