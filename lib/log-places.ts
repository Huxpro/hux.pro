// =============================================================================
// Places — the log read as a career: where the work happened, then what it was.
//
// The log is one stream in date order, which answers "what happened when?"
// and nothing else well. A newcomer is asking something else first: where
// has this person worked, as what, and what did they build there? A CV
// answers that by nesting — the place, the role, and the work under it —
// and the log already holds every part of that answer:
//
//   - the places are the `identities` (`meta`, `bytedance`, `rit`, …), and
//     their roles are the ranges `normalizeLogData` hoists into role commits;
//   - which place a piece of work belongs to is `resolveIdentity`, the same
//     rule that signs every row's `<handle>` byline and fills the identity
//     card's "commits signed". Explicit `identityId` first, then an
//     `attachedTo` role, then the smallest tenure window the work's date
//     falls in. Reusing it rather than writing a second rule is the point:
//     the byline, the card and this reading cannot disagree about who made
//     what, because they are asking the same function.
//
// What resolves to no one — work detached on purpose (`attachedTo: null`:
// the blog, a community talk given in the gap between two jobs) or dated
// between tenures — is not forced into the nearest place. It goes to one
// small section of its own at the end, the way a CV keeps "other" apart
// from the jobs rather than smuggling it into one of them.
//
// Deliberately free of React and of the locale's strings, like
// `lib/log-view.ts`: this decides *what goes where*; the renderer decides
// how it reads.
// =============================================================================

import type { Locale } from "./i18n";
import {
  commitSortKey,
  isCommitVisibleIn,
  isEventCommit,
  isPressCommit,
  isProjectCommit,
  isTalkCommit,
  resolveIdentity,
  sortCommitsByDate,
  type Commit,
  type EventCommit,
  type LogData,
  type PressCommit,
  type ProjectCommit,
  type RoleCommit,
  type TalkCommit,
} from "./log";

/** The work nested under a place, split the way it reads. */
export interface PlaceWork {
  /** Latest first. The flagship work — what a place is remembered for. */
  projects: ProjectCommit[];
  /** Latest first. Printed as a compact list under the projects. */
  talks: TalkCommit[];
  /** Latest first. Coverage and appearances that aren't talks. */
  press: PressCommit[];
}

export interface Place extends PlaceWork {
  /** The identity's key — also the section's anchor and React key. */
  id: string;
  /** The roles held here, latest first (the log's own order). */
  roles: RoleCommit[];
  /** The era the place belongs to — its latest role's tag. */
  tagId: string;
}

/** One entry down the spine: a place, or a life event between two. */
export type SpineEntry =
  | { kind: "place"; place: Place }
  | { kind: "event"; event: EventCommit };

export interface Places {
  /** Places in the log's order, with the life events that fall between. */
  spine: SpineEntry[];
  /** Work that resolves to no place. Empty lists when there is none. */
  elsewhere: PlaceWork;
}

/** The anchor a place's section carries, and the elsewhere section's. */
export const ELSEWHERE_ID = "elsewhere";

function emptyWork(): PlaceWork {
  return { projects: [], talks: [], press: [] };
}

function file(work: PlaceWork, c: Commit) {
  if (isProjectCommit(c)) work.projects.push(c);
  else if (isTalkCommit(c)) work.talks.push(c);
  else if (isPressCommit(c)) work.press.push(c);
  // Posts are the one type no place lists: none are filed today, and a post
  // written on this site is /writing's to list.
}

/**
 * Group the log by place.
 *
 * Places come in the order their roles take in the log (`sortCommitsByDate`,
 * `sortBy` included), so an education entry sits at its enrolment year the
 * way the author placed it there, and a place with several roles — Meta's
 * two summers and the full-time years — sits at its latest.
 */
export function buildPlaces(log: LogData, locale: Locale): Places {
  // Identity resolution walks the whole array — the roles behind most
  // bylines are `hideRow` rows that never print — so resolve against every
  // commit and only filter what gets *listed*.
  const all = log.commits;
  const visible = sortCommitsByDate(all.filter((c) => isCommitVisibleIn(c, locale)));

  const byId = new Map<string, Place>();
  const order: Place[] = [];
  for (const c of visible) {
    if (c.type !== "role") continue;
    const role = c as RoleCommit;
    let place = byId.get(role.identityId);
    if (!place) {
      place = { id: role.identityId, roles: [], tagId: role.tagId, ...emptyWork() };
      byId.set(role.identityId, place);
      order.push(place);
    }
    place.roles.push(role);
  }

  const elsewhere = emptyWork();
  const events: EventCommit[] = [];
  for (const c of visible) {
    if (c.type === "role") continue;
    if (isEventCommit(c)) {
      events.push(c);
      continue;
    }
    const resolved = resolveIdentity(c, all);
    const place = resolved ? byId.get(resolved.identityId) : undefined;
    file(place ?? elsewhere, c);
  }

  // Events go between the places, at the first place that began before them:
  // "moved to the US" lands between RIT and Ele.me, the sabbatical between
  // Meta and ByteDance — the same gaps they sit in on the log.
  const spine: SpineEntry[] = [];
  let e = 0;
  for (const place of order) {
    const key = commitSortKey(place.roles[0]).slice(0, 7);
    while (e < events.length && events[e].date.slice(0, 7) > key) {
      spine.push({ kind: "event", event: events[e++] });
    }
    spine.push({ kind: "place", place });
  }
  // An event older than every place has nothing to sit between; the spine
  // ends at the earliest place rather than trailing a stray line.

  return { spine, elsewhere };
}

/** True when a place, or the elsewhere section, has any work to list. */
export function hasWork(work: PlaceWork): boolean {
  return work.projects.length + work.talks.length + work.press.length > 0;
}
