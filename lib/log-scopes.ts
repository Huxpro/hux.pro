// =============================================================================
// Scopes — a project that holds the work that took it public.
//
// A project on /works used to be a row about the code; the talks that
// showed it to the world were rows of their own somewhere above it. But
// the moment a project goes public is usually a small cluster of things:
// the talk that announced it, the blog post, the repository, the interview
// that came with it, the same talk given again in another language. That
// cluster is what a reader should meet, so a project can hold it.
//
// A talk, post or press says which project it belongs to (`about[0]`).
// The project's row then holds it: its strip carries every cover in the
// scope in the order things happened (the talk, then the post that
// followed it, then the repository; undated attachments come last), and
// what it holds prints under it as one-line rows on a branch of the
// gutter. The project sits on the page at the moment it went public
// (`publicDate`), not where the work began.
//
// A work in several versions (lib/log-editions.ts) belongs as one: it
// joins the project any of its versions names, and prints as its one row.
//
// Nothing is merged: every commit stays flat in log.json, can be featured
// and embedded on its own, and prints as an ordinary row again whenever
// its project is not on the page (?type=talk, a locale scope, a typo).
//
// This module is the pure half. React lives in components/log.
// =============================================================================

import type { Locale } from "./i18n";
import { buildEditions, withinRange, type Editions } from "./log-editions";
import {
  commitVenue,
  isPinnedMedia,
  localize,
  type Commit,
  type Media,
} from "./log";

export interface Scopes {
  /** Child id → the project that holds it. A child is an ordinary commit,
   *  or the lead of a work in several versions (standing for the work). */
  scopeOf: Map<string, string>;
  /** Project id → what it holds, oldest first. */
  childrenOf: Map<string, Commit[]>;
}

const EMPTY: Scopes = { scopeOf: new Map(), childrenOf: new Map() };

const isWork = (c: Commit) =>
  c.type !== "project" && c.type !== "role" && c.type !== "event";

/**
 * Which visible project holds each visible piece of work.
 *
 * Projects are not held by projects here: a release inside a family is a
 * branch, and branches are the graph's to draw.
 */
export function buildScopes(
  commits: readonly Commit[],
  isVisible: (commit: Commit) => boolean,
  editions: Editions,
): Scopes {
  const byId = new Map(commits.map((c) => [c.id, c]));
  const projectOf = (c: Commit): string | undefined => {
    const id = c.about?.[0];
    const p = id ? byId.get(id) : undefined;
    return p && p.type === "project" && isVisible(p) ? p.id : undefined;
  };

  const scopeOf = new Map<string, string>();
  const childrenOf = new Map<string, Commit[]>();
  for (const c of commits) {
    if (!isWork(c) || !isVisible(c)) continue;
    const group = editions.groupOf.get(c.id);
    // A work in several versions belongs through its lead, as one.
    if (group && group.lead !== c) continue;
    const project = group
      ? group.versions.map(projectOf).find(Boolean)
      : projectOf(c);
    if (!project) continue;
    scopeOf.set(c.id, project);
    const list = childrenOf.get(project) ?? [];
    list.push(c);
    childrenOf.set(project, list);
  }
  if (scopeOf.size === 0) return EMPTY;
  for (const list of childrenOf.values()) {
    list.sort((a, b) =>
      heldDate(a, editions).localeCompare(heldDate(b, editions)),
    );
  }
  return { scopeOf, childrenOf };
}

/**
 * When a held row happened, for its place in the project's chronology. A
 * work in several versions happened when it was first given, whichever
 * version leads its row.
 */
export function heldDate(commit: Commit, editions: Editions): string {
  const group = editions.groupOf.get(commit.id);
  if (!group) return commit.date;
  return group.versions.map((v) => v.date).sort()[0];
}

/** One entry in a project's chronology on /works: a row it holds, or a run
 *  of its own attachments. */
export type ScopeEntry =
  | { kind: "row"; commit: Commit }
  | { kind: "media"; media: Media[] };

/**
 * A project's chronology, the order its strip is in: the rows it holds and
 * its own attachments as one sequence. Dated entries first, by date (a
 * talk before an attachment dated the same day: the talk comes first, the
 * write-up after), then the undated attachments as authored, like the
 * repository. Consecutive attachments are one run, printed as one strip.
 *
 * `withMedia: false` leaves the project's own attachments out.
 */
export function scopeEntries(
  project: Commit,
  held: readonly Commit[],
  editions: Editions,
  withMedia: boolean,
): ScopeEntry[] {
  type Item =
    | { kind: "row"; date: string; commit: Commit }
    | { kind: "media"; date?: string; media: Media };
  const media = withMedia
    ? (project.media ?? []).filter((m) => !isPinnedMedia(m))
    : [];
  const dated: Item[] = [
    ...held.map((c) => ({
      kind: "row" as const,
      date: heldDate(c, editions),
      commit: c,
    })),
    ...media
      .filter((m) => m.date)
      .map((m) => ({ kind: "media" as const, date: m.date, media: m })),
  ].sort(
    (a, b) =>
      a.date!.localeCompare(b.date!) ||
      (a.kind === b.kind ? 0 : a.kind === "row" ? -1 : 1),
  );
  const items: Item[] = [
    ...dated,
    ...media
      .filter((m) => !m.date)
      .map((m) => ({ kind: "media" as const, media: m })),
  ];

  const out: ScopeEntry[] = [];
  for (const item of items) {
    if (item.kind === "row") {
      out.push({ kind: "row", commit: item.commit });
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.kind === "media") last.media.push(item.media);
    else out.push({ kind: "media", media: [item.media] });
  }
  return out;
}

/**
 * The rows a commit is printed inside, innermost first: its work's row (for
 * a version that is not the lead), and the project that holds that. Empty
 * for a commit that is its own row on the main timeline.
 */
export function holdersOf(
  commit: Commit,
  editions: Editions,
  scopes: Scopes,
  byId: ReadonlyMap<string, Commit>,
): Commit[] {
  const holders: Commit[] = [];
  const group = editions.groupOf.get(commit.id);
  const self = group ? group.lead : commit;
  if (group && group.lead !== commit) holders.push(group.lead);
  const scope = scopes.scopeOf.get(self.id);
  const project = scope ? byId.get(scope) : undefined;
  if (project) holders.push(project);
  return holders;
}

/**
 * Whether a commit printed inside other rows needs a quiet line at its own
 * date as well: only when none of them covers that time. React without memo
 * is inside the years the React Compiler row spans, so a reader looking at
 * 2021 already finds it there.
 */
export function needsPointer(commit: Commit, holders: readonly Commit[]) {
  return holders.length > 0 && !holders.some((h) => withinRange(commit, h));
}

/**
 * What a project holds, flat and newest first, one commit per work (the
 * version that leads in this locale). How a place that references a
 * project, a featured group or an album, shows what is inside it while the
 * group names the project once.
 */
export function workAbout(
  projectId: string,
  commits: readonly Commit[],
  locale: Locale,
  isVisible: (commit: Commit) => boolean = () => true,
): Commit[] {
  const editions = buildEditions(commits, isVisible, locale);
  const scopes = buildScopes(commits, isVisible, editions);
  return [...(scopes.childrenOf.get(projectId) ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

/** How held work is named on its quiet line: `React Conf 2021 · React
 *  without memo`. Where it happened, then what. */
export function heldLine(commit: Commit, locale: Locale): string {
  const venue = commitVenue(commit);
  const title = localize(commit.title, locale);
  if (!venue || venue.trim().toLowerCase() === title.trim().toLowerCase()) {
    return title;
  }
  return `${venue} · ${title}`;
}
