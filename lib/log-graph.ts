// =============================================================================
// The graph — /works as `git log --graph`.
//
// The page is a time axis. The graph adds the other one: which project each
// commit belongs to. Every project that has work about it becomes a lane;
// the work sits on that lane at its own date; a project about another
// project (a release, a sub-project) branches off its parent's lane.
//
// A project is its lane's head: the first row of it you meet scrolling
// down, printed just above the newest work on it (`headFirst`), so a reader
// meets what the branch is before what is on it. The lane runs down through
// that work and, under the oldest of it, curves back into the lane it grew
// from, the way `git log --graph` draws a branch growing up out of its base.
// Everything else stays on the main line, which is where the rail runs.
//
//   │ ◆     Lynx Framework         (lynx) head
//   │ │   ◆ ReactLynx              (lynx/react) head
//   │ │ ◆ │ lynx-ui                (lynx/ui) head
//   │ │ ● │ lynx-ui talk
//   │ │╱  │
//   │ │   ● React for Two Threads
//   │ │ ╱
//   │ ● D2
//   │╱
//   ● FEDAY 2023                   main
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
  /** The lane it grows out of; absent for the main line. */
  parent?: string;
  /** Row indices (into the chapter's commits) of its topmost and bottommost
   *  row, a sub-lane's rows included: the lane runs on until the lanes that
   *  grew out of it have come back into it, and forks under that. */
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
 * on its own lane: at the top, as its head, when `commits` has been put in
 * `headFirst` order.
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

  // A lane's span: its own rows, and the spans of the lanes that grow out
  // of it, which have to come back into it.
  const spanOf = new Map<string, { top: number; bottom: number }>();
  const span = (id: string): { top: number; bottom: number } => {
    const known = spanOf.get(id);
    if (known) return known;
    const rows = [...members.get(id)!, index.get(id)!];
    let top = Math.min(...rows);
    let bottom = Math.max(...rows);
    spanOf.set(id, { top, bottom }); // a cycle stops here
    for (const m of members.get(id)!) {
      const child = byId.get(commits[m].id)!;
      if (!members.has(child.id)) continue;
      const s = span(child.id);
      top = Math.min(top, s.top);
      bottom = Math.max(bottom, s.bottom);
    }
    spanOf.set(id, { top, bottom });
    return { top, bottom };
  };

  const lanes: GraphLane[] = [];
  const colOfLane = new Map<string, number>();
  const nameOfLane = new Map<string, string>();
  for (const id of ids) {
    const { top, bottom } = span(id);
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
    lanes.push({ id, name, col, from, parent: parent ?? undefined, top, bottom });
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

/**
 * The chapter in the graph's order: each project that has work on its lane
 * moves up to just above the newest of that work, so it heads its lane.
 * Everything else keeps its place. A sub-project heads its own lane first,
 * and then counts as work on its parent's, so the parent ends up above it.
 * A project already above all its work stays where it is.
 */
export function headFirst(
  commits: readonly Commit[],
  isHidden: (commit: Commit) => boolean,
): Commit[] {
  const visible = new Set(commits.filter((c) => !isHidden(c)).map((c) => c.id));
  const byId = new Map(commits.map((c) => [c.id, c]));
  const aboutOf = (c: Commit): string | null => {
    const first = c.about?.[0];
    if (!first || first === c.id || !visible.has(first)) return null;
    return byId.get(first)?.type === "project" ? first : null;
  };
  const originalOf = (c: Commit): Commit => {
    const seen = new Set([c.id]);
    let current = c;
    while (current.editionOf) {
      const next = byId.get(current.editionOf);
      if (!next || seen.has(next.id) || !visible.has(next.id)) break;
      seen.add(next.id);
      current = next;
    }
    return current;
  };
  const hangsOn = (c: Commit) => aboutOf(originalOf(c));

  const members = new Map<string, string[]>();
  for (const id of visible) {
    const on = hangsOn(byId.get(id)!);
    if (!on) continue;
    members.set(on, [...(members.get(on) ?? []), id]);
  }
  if (members.size === 0) return [...commits];

  const depth = (id: string) => {
    let d = 0;
    const seen = new Set<string>();
    for (let p = hangsOn(byId.get(id)!); p && !seen.has(p); p = hangsOn(byId.get(p)!)) {
      seen.add(p);
      d += 1;
    }
    return d;
  };

  const order = [...commits];
  // Deepest first: a sub-project takes its place before its parent looks
  // for the newest thing on its lane.
  for (const project of [...members.keys()].sort((a, b) => depth(b) - depth(a))) {
    const at = order.findIndex((c) => c.id === project);
    const top = Math.min(
      ...members.get(project)!.map((id) => order.findIndex((c) => c.id === id)),
    );
    if (at < top) continue;
    const [row] = order.splice(at, 1);
    order.splice(top, 0, row);
  }
  return order;
}
