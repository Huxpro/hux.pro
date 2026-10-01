// =============================================================================
// Works projects — which of the log's rows are *about* a project.
//
// The log prints every commit at its date, which is the right answer to
// "what happened, when?". It leaves a project's story scattered: Lynx
// Framework is one row in 2023 and its ten talks are ten rows above it, in
// among everything else. This module names the rows that belong to a project
// so the page can fold them behind that project's row (the `fold` flag,
// components/log/works-flags.ts) without a second list of them: the rows are
// the log's own, only their place changes.
//
// ## The rule
//
// Only what is said *about* the work can belong to a project: talks, press
// and posts. Projects, roles and events never fold. In order:
//
//  1. `attachedTo` — the commit says where it belongs. Pointing at a project
//     puts it there. Pointing anywhere else (a role, an event), or explicitly
//     at nothing (`null`), keeps it out of every project: it has said what it
//     belongs to, and it was not one of these.
//  2. Its name — one of the commit's `tags` is a word of the project's
//     English title, *and* the two share a chapter (`tagId`). A talk tagged
//     `Lynx` in the Lynx era is a Lynx talk; the `PWA` talks of the PWA era
//     are Ele.me PWA's story. The chapter keeps the rule honest: a `React`
//     tag in the Lynx era is not React Compiler's.
//
// Nothing else: not shared topics (`Cross-Platform`), not the identity a row
// was given under. That is deliberately narrow; `attachedTo` is how to widen
// it for one row, and `attachedTo: null` how to keep one out. (The same rule
// as the résumé exploration's lib/works-index.ts, so the explorations agree
// on what a project's history is.)
//
// It works on one chapter at a time, because the page folds within a
// chapter: an `attachedTo` naming a project in another chapter finds no
// project here, and the row stays where its date put it.
//
// ## What it yields on today's content/log.json
//
//   Lynx Framework       ← 10 talks, by tag: the Vibe³ workshop (WAD 2026),
//                          GOSIM 2026, React for Two Threads at SEE Conf and
//                          at React Universe, lynx-ui and Panel (React
//                          Advanced), the React Universe interview, Native
//                          for More (WAD 2025), React Summit 2025, D2 2025
//   React Compiler       ← React without memo (React Conf 2021), by
//                          `attachedTo`
//   Ele.me PWA           ← 3 talks, by tag: JSConf China 2017, QCon
//                          Shanghai 2016, PWA in my POV (2016)
//
// The same in both locales. No press or post belongs to a project today.
//
// Everything else stays at its date: the two "frontend" talks of the Lynx
// era (tagged `Frontend`, given at ByteDance, about something else), COSCon
// 2022 and the Gitee cover (`attachedTo: null`), the Open Source Pioneer
// award, the Bilibili sabbatical piece (attached to its event), and the
// early talks on modules and CSS.
//
// React-free, like lib/log-view.ts.
// =============================================================================

import { localize, type Commit, type CommitType } from "./log";

/** The types that are said about a work, and so can belong to one. */
const FOLDABLE: ReadonlySet<CommitType> = new Set(["talk", "press", "post"]);

/** The words a project is called by — its English title, split — so the
 *  rule reads the same in either locale. */
function nameWords(project: Commit): Set<string> {
  return new Set(
    localize(project.title, "en")
      .toLowerCase()
      .split(/[\s()/:]+/)
      .filter(Boolean),
  );
}

/**
 * The project a commit belongs to, among `projects` (one chapter's, in its
 * order — newest first, so a row that could name two goes to the later
 * one; none does today). The rule in the header, in code.
 */
export function projectOf(
  commit: Commit,
  projects: readonly Commit[],
): Commit | undefined {
  if (!FOLDABLE.has(commit.type)) return undefined;
  if (commit.attachedTo === null) return undefined;
  if (typeof commit.attachedTo === "string") {
    return projects.find((p) => p.id === commit.attachedTo);
  }
  const tags = (commit.tags ?? []).map((t) => t.toLowerCase());
  if (tags.length === 0) return undefined;
  return projects.find((p) => {
    if (p.tagId !== commit.tagId) return false;
    const words = nameWords(p);
    return tags.some((t) => words.has(t));
  });
}

/**
 * One chapter's folds: every row that belongs to a project there, by id, to
 * that project's id. A row absent from the map is the log's as it was.
 */
export function foldUnderProjects(
  commits: readonly Commit[],
): Map<string, string> {
  const projects = commits.filter((c) => c.type === "project");
  const folds = new Map<string, string>();
  if (projects.length === 0) return folds;
  for (const c of commits) {
    const p = projectOf(c, projects);
    if (p) folds.set(c.id, p.id);
  }
  return folds;
}

/**
 * The chapter in the order the page prints it with its folds: each folded
 * row lifted out of its date's slot and set directly under its project, in
 * the order they had among themselves (newest first). Everything else keeps
 * its place. With no folds it is the same array, so the log's own order is
 * never re-derived for nothing.
 */
export function orderWithFolds<T extends Commit>(
  commits: T[],
  folds: ReadonlyMap<string, string>,
): T[] {
  if (!commits.some((c) => folds.has(c.id))) return commits;
  const under = new Map<string, T[]>();
  for (const c of commits) {
    const p = folds.get(c.id);
    if (p) under.set(p, [...(under.get(p) ?? []), c]);
  }
  return commits.flatMap((c) =>
    folds.has(c.id) ? [] : [c, ...(under.get(c.id) ?? [])],
  );
}
