// =============================================================================
// Project context — a commit that happens *about* a project.
//
// /works already has one kind of context, and it is the model for this one.
// A role is the context of the work done under it: every commit resolves its
// role, the role's `<handle>` signs the head of a run and stays quiet on the
// rest, the tenure rail lights when any row in it is hovered, and opening a
// row writes the role out as `Author:` / `Role:` fields. The role row itself
// can even stand down (`hideRow`) and still be the context. Noise stays low
// because the context is said once, lit on demand, and spelled out only when
// asked for.
//
// A project is the same kind of thing for the talks, posts and press that
// are about it — with one difference that rules out every shortcut: the
// relation is many-to-many. Lynx Framework (2023) is the subject of nine
// talks through 2026; React for Two Threads is about Lynx AND React. So the
// talks keep their own rows, in their own months, and the project is
// referenced, never merged into.
//
// This module is the pure half: which projects a commit is about, which
// commits are about a project, and where a mark should print at rest. Free
// of React, like `lib/log-squash.ts` and `lib/log-view.ts`.
// =============================================================================

import {
  commitVenue,
  computeCommitHash,
  formatCommitDate,
  localize,
  type Commit,
  type ProjectCommit,
} from "./log";
import type { Locale } from "./i18n";

/** A project, as a commit that names it as context needs to print it. */
export interface ProjectRef {
  id: string;
  hash: string;
  /** What it is called in passing — `short`, or the title. */
  label: string;
  /** Its full title, for the peek. */
  title: string;
}

/** Every project commit in the log, by id — the only valid context targets. */
export function indexProjects(commits: readonly Commit[]): Map<string, ProjectCommit> {
  const out = new Map<string, ProjectCommit>();
  for (const c of commits) if (c.type === "project") out.set(c.id, c);
  return out;
}

/**
 * The project ids a commit names that actually resolve, in authored order.
 * A project never names itself, and an id that is not a project is dropped
 * rather than fatal — the way every other cross-reference in the log
 * degrades.
 */
export function contextIds(
  commit: Commit,
  projects: ReadonlyMap<string, ProjectCommit>,
): string[] {
  return (commit.projects ?? []).filter(
    (id) => id !== commit.id && projects.has(id),
  );
}

export function projectRef(project: ProjectCommit, locale: Locale): ProjectRef {
  const title = localize(project.title, locale);
  const short = project.short ? localize(project.short, locale) : "";
  return {
    id: project.id,
    hash: computeCommitHash(project.id),
    label: short || title,
    title,
  };
}

/** A commit that is about a project, as the project's own row lists it. */
export interface ContextEntry {
  commit: Commit;
  hash: string;
  title: string;
  date: string;
}

/**
 * The reverse relation: project id → the commits about it, newest first.
 * What the project's opened row lists, and what its peek counts.
 */
export function commitsAbout(
  commits: readonly Commit[],
  projects: ReadonlyMap<string, ProjectCommit>,
  locale: Locale,
): Map<string, ContextEntry[]> {
  const out = new Map<string, ContextEntry[]>();
  for (const c of commits) {
    for (const id of contextIds(c, projects)) {
      const list = out.get(id) ?? [];
      const title = localize(c.title, locale);
      const venue = commitVenue(c);
      list.push({
        commit: c,
        hash: computeCommitHash(c.id),
        // Venue first where there is one: talks about one project often
        // share a title — the same talk given twice is exactly why — and
        // the venue is what tells two entries apart.
        title: venue && venue.trim().toLowerCase() !== title.trim().toLowerCase()
          ? `${venue} · ${title}`
          : title,
        date: formatCommitDate(c, locale),
      });
      out.set(id, list);
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => b.commit.date.localeCompare(a.commit.date));
  }
  return out;
}

/**
 * Where each row's marks print at rest — the handle's rule, applied to a
 * project.
 *
 * `rows` are a chapter's rows in render order, each with the project ids it
 * shows at row level. A mark is a *head* — printed at rest — when the row
 * before it did not show the same project; otherwise it repeats the run it
 * is in, and waits for a hover. A run of Lynx talks reads as "these are
 * Lynx" once, not nine times.
 *
 * A row in the quiet voice (an event, a folded aside) prints no meta line
 * at rest, so it cannot carry a head for the rows under it: it neither
 * starts nor continues a run, and its own marks are always heads — they
 * only ever print when it is opened, and then they should.
 */
export function sparseMarks(
  rows: readonly { ids: readonly string[]; quiet: boolean }[],
): Set<string>[] {
  const heads: Set<string>[] = [];
  let previous = new Set<string>();
  for (const row of rows) {
    if (row.quiet) {
      heads.push(new Set(row.ids));
      continue;
    }
    heads.push(new Set(row.ids.filter((id) => !previous.has(id))));
    previous = new Set(row.ids);
  }
  return heads;
}
