// =============================================================================
// Hosts — a commit printed on another commit's row.
//
// Two commits on /works can be one thing to a reader. The Chinese telling of
// a talk is the talk again (`editionOf`); the talk that introduced a project
// is the project's first public moment (`about`). Printed a row each, the
// page says the same thing twice, and the two are a screen apart.
//
// So the second one is a guest on the first one's row: its covers join the
// host's strip, and inside the host's time it prints no row of its own. A
// guest dated outside that time keeps one quiet line at its own date, so
// the timeline still has it where it happened.
//
// Nothing is merged. A guest is an ordinary commit everywhere else: it can
// be featured and embedded, and whenever its host is not on the page (a type
// filter, a locale scope), it prints as the row it always was.
//
// This module is the pure half. React lives in components/log.
// =============================================================================

import type { Commit } from "./log";

export interface Guest {
  commit: Commit;
  /** Why it is on the host's row. */
  kind: "edition" | "about";
  /** Whether the host's row covers its date; if not, it keeps a quiet line. */
  inside: boolean;
}

export interface Hosts {
  /** Guest id → its host's id. */
  hostOf: Map<string, string>;
  /** Host id → its guests, oldest first. */
  guestsOf: Map<string, Guest[]>;
}

const EMPTY: Hosts = { hostOf: new Map(), guestsOf: new Map() };

/**
 * Who is a guest on whose row, among the commits on the page.
 *
 * An edition's host is the version its chain of `editionOf` ends at; a
 * commit `about` a project is the project's guest. A pointer to something
 * not on the page, or a cycle, is ignored: the commit is its own row.
 */
export function buildHosts(
  commits: readonly Commit[],
  isVisible: (commit: Commit) => boolean,
): Hosts {
  const byId = new Map(commits.filter(isVisible).map((c) => [c.id, c]));

  const hostOf = new Map<string, string>();
  const guestsOf = new Map<string, Guest[]>();
  for (const c of byId.values()) {
    let host: Commit | undefined;
    let kind: Guest["kind"] = "edition";
    if (c.editionOf) {
      // Follow the chain to the version that points at nothing.
      const seen = new Set([c.id]);
      let at = byId.get(c.editionOf);
      while (at && !seen.has(at.id)) {
        seen.add(at.id);
        host = at;
        at = at.editionOf ? byId.get(at.editionOf) : undefined;
      }
      if (at) host = undefined; // a cycle
    } else if (c.about?.[0]) {
      const project = byId.get(c.about[0]);
      if (project?.type === "project") {
        host = project;
        kind = "about";
      }
    }
    if (!host || host.id === c.id) continue;
    hostOf.set(c.id, host.id);
    const list = guestsOf.get(host.id) ?? [];
    list.push({ commit: c, kind, inside: withinRange(c, host) });
    guestsOf.set(host.id, list);
  }
  if (hostOf.size === 0) return EMPTY;
  for (const list of guestsOf.values()) {
    list.sort((a, b) => a.commit.date.localeCompare(b.commit.date));
  }
  return { hostOf, guestsOf };
}

const month = (date: string) => date.slice(0, 7);

/**
 * Whether `commit` happened within the time `row` covers: its own month, or
 * its whole span when it has one (`present` runs on forever).
 */
export function withinRange(commit: Commit, row: Commit): boolean {
  const at = month(commit.date);
  const start = month(row.date);
  const end = !row.endDate
    ? start
    : row.endDate === "present"
      ? "9999-12"
      : month(row.endDate);
  return at >= start && at <= end;
}

/**
 * The name a guest's covers wear on its host's strip: an edition in another
 * language is that language (`中文`, `EN`), anything else is where it
 * happened (`React Conf 2021`).
 */
export function guestLabel(guest: Guest, host: Commit): string | undefined {
  const c = guest.commit;
  if (
    guest.kind === "edition" &&
    c.language &&
    c.language !== "both" &&
    c.language !== host.language
  ) {
    return c.language === "zh" ? "中文" : "EN";
  }
  return c.type === "talk" ? c.conference?.name : undefined;
}
