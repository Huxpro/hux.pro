// =============================================================================
// Places are the log's branches.
//
// The log is one stream in date order, which answers "what happened when?"
// and nothing else well. A newcomer is asking something else first: where
// has this person worked, as what, and what did they build there? A CV
// answers that by nesting — the place, the role, and the work under it —
// and the log already draws that nesting, if only for a few rows at a time:
// its tenure rail (`computeRail`) brackets every run of commits made as the
// same identity. The rail is a branch. This module makes it the whole
// shape of the page: each place is a branch of the one log, and every commit
// made there is on it.
//
//   - the branches are the `identities` (`meta`, `bytedance`, `rit`, …), and
//     their roles are the ranges `normalizeLogData` hoists into role commits;
//   - which branch a commit is on is `resolveIdentity`, the same rule that
//     signs every row's `<handle>` byline and fills the identity card's
//     "commits signed". Explicit `identityId` first, then an `attachedTo`
//     role, then the smallest tenure window the work's date falls in. Reusing
//     it rather than writing a second rule is the point: the byline, the card
//     and the branch cannot disagree about who made what.
//
// What resolves to no one — work detached on purpose (`attachedTo: null`:
// the blog, a community talk given in the gap between two jobs), work dated
// between tenures, and the life events, which never resolve — is on `main`.
// Not a leftover bin at the end: `main` is where a branch forks from and
// merges back to, so its commits sit *between* the branches, at their date —
// the sabbatical and the talks around it between ByteDance and Meta, the
// move to the US between RIT and Ele.me.
//
// The branches are printed `git log --topo-order`, not by date: each
// branch's commits together, rather than interleaved with whatever else
// was happening. That is what lets Meta's two internships sit with the
// full-time years instead of being split around RIT, and it is also what
// git does for a history with branches in it.
//
// Deliberately free of React and of the locale's strings, like
// `lib/log-view.ts`: this decides *what goes where*; the renderer decides
// how it reads at each depth.
// =============================================================================

import type { Locale } from "./i18n";
import {
  commitSortKey,
  isCommitVisibleIn,
  isEventCommit,
  isProjectCommit,
  resolveIdentity,
  sortCommitsByDate,
  type Commit,
  type EventCommit,
  type ProjectCommit,
  type LogData,
  type RoleCommit,
} from "./log";

/** A place: one identity's branch of the log. */
export interface Branch {
  kind: "branch";
  /** The identity's key — the branch's name, anchor and React key. */
  id: string;
  /** The roles held here, latest first (the log's own order). */
  roles: RoleCommit[];
  /**
   * Everything on the branch in the log's order, roles included: identity
   * resolution and the rail read the roles even where no row prints them
   * (the header speaks for them — see components/log/places.tsx).
   */
  commits: Commit[];
}

/** A run of `main` between two branches (or after the last). */
export interface MainRun {
  kind: "main";
  /** `main-<first commit id>`: stable, and unique down the page. */
  id: string;
  commits: Commit[];
}

export type Lane = Branch | MainRun;

/** The name every `main` run goes by — in the pinned bar's ref slot too. */
export const MAIN = "main";

/**
 * The log, as its branches and the `main` between them.
 *
 * Branches come in the order their roles take in the log
 * (`sortCommitsByDate`, `sortBy` included), so an education entry sits at
 * its enrolment year the way the author placed it there, and a place with
 * several roles — Meta's two summers and the full-time years — sits at its
 * latest. A commit on `main` goes above the first branch that began before
 * it: in the gap it happened in, or at the top of the branch it happened
 * *during*, which reading down the page is the same place.
 */
export function buildLanes(log: LogData, locale: Locale): Lane[] {
  // Identity resolution walks the whole array — the roles behind most
  // bylines are `hideRow` rows that never print — so resolve against every
  // commit and only lay out what is visible in this locale.
  const all = log.commits;
  const visible = sortCommitsByDate(all.filter((c) => isCommitVisibleIn(c, locale)));

  const byId = new Map<string, Branch>();
  const branches: Branch[] = [];
  for (const c of visible) {
    if (c.type !== "role") continue;
    const role = c as RoleCommit;
    let branch = byId.get(role.identityId);
    if (!branch) {
      branch = { kind: "branch", id: role.identityId, roles: [], commits: [] };
      byId.set(role.identityId, branch);
      branches.push(branch);
    }
    branch.roles.push(role);
  }

  const main: Commit[] = [];
  for (const c of visible) {
    const resolved = resolveIdentity(c, all);
    const branch = resolved ? byId.get(resolved.identityId) : undefined;
    if (branch) branch.commits.push(c);
    else if (c.type !== "role") main.push(c);
  }

  const lanes: Lane[] = [];
  let m = 0;
  const run = (until: (c: Commit) => boolean) => {
    const commits: Commit[] = [];
    while (m < main.length && until(main[m])) commits.push(main[m++]);
    if (commits.length > 0) {
      lanes.push({ kind: "main", id: `${MAIN}-${commits[0].id}`, commits });
    }
  };
  for (const branch of branches) {
    const forked = commitSortKey(branch.roles[0]).slice(0, 7);
    run((c) => c.date.slice(0, 7) > forked);
    lanes.push(branch);
  }
  // What is older than every branch is still `main` — the start of it.
  run(() => true);

  return lanes;
}

/**
 * A lane as the summary prints it: the projects in full, the life events
 * as the quiet lines they are on the log, and everything else — the talks,
 * the press — folded into one line that unfolds the lane into its commits.
 */
export interface LaneSummary {
  projects: ProjectCommit[];
  events: EventCommit[];
  folded: Commit[];
}

export function summarize(lane: Lane): LaneSummary {
  const out: LaneSummary = { projects: [], events: [], folded: [] };
  for (const c of lane.commits) {
    if (c.type === "role") continue;
    if (isProjectCommit(c)) out.projects.push(c);
    else if (isEventCommit(c)) out.events.push(c);
    else out.folded.push(c);
  }
  return out;
}
