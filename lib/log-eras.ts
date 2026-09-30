// =============================================================================
// Overlapping eras — chapters that share commits
// =============================================================================
//
// A chapter used to own its commits outright: one `tagId`, one block. Some
// work belongs to two at once — the Meta internships were React work and PL
// work — so a commit may name more chapters in `alsoTagIds`, and chapters
// that share a commit overlap.
//
// Overlapping chapters print as one block, in date order, the way
// `git log --graph` prints two branches: the rail is the trunk, each chapter
// marker the ref where its branch starts, and a chapter that runs on past the
// next one's marker keeps a lane of its own beside the trunk until its last
// commit (see `components/log/timeline-lane.tsx`).

import type { Locale } from "./i18n";
import {
  type Commit,
  type LogData,
  type Tag,
  type TimelineData,
  isCommitVisibleIn,
  sortCommitsByDate,
  sortTagsByDate,
} from "./log";

export interface EraBlock extends TimelineData {
  /** The chapters this block prints, newest first — one, or every chapter
   *  of an overlap. The first is `tag`; each later one starts at its own
   *  marker inside the block. */
  members: Tag[];
  /** An overlap: which chapters each commit belongs to, by commit id, as
   *  indices into `members`. Absent for a chapter that overlaps nothing. */
  laneOf?: ReadonlyMap<string, number[]>;
}

/** Every chapter a commit belongs to, home first. */
export function commitTagIds(commit: Commit): string[] {
  return [commit.tagId, ...(commit.alsoTagIds ?? [])];
}

/**
 * The timeline as blocks. A log with no shared commits comes out as exactly
 * `buildTimelineData` would have it.
 */
export function buildEraTimeline(
  logData: LogData,
  locale: Locale,
): EraBlock[] {
  const visible = logData.commits.filter((c) => isCommitVisibleIn(c, locale));
  const tags = sortTagsByDate(logData.tags);
  const rank = new Map(tags.map((t, i) => [t.id, i]));

  // Membership, restricted to chapters that exist, in page order.
  const membership = new Map<string, string[]>();
  for (const c of visible) {
    const ids = [...new Set(commitTagIds(c))]
      .filter((id) => rank.has(id))
      .sort((a, b) => rank.get(a)! - rank.get(b)!);
    membership.set(c.id, ids);
  }

  // Overlaps: chapters joined by a shared commit (union–find).
  const parent = new Map(tags.map((t) => [t.id, t.id]));
  const find = (id: string): string =>
    parent.get(id) === id ? id : find(parent.get(id)!);
  for (const ids of membership.values()) {
    for (const id of ids.slice(1)) parent.set(find(id), find(ids[0]));
  }

  const blocks: EraBlock[] = [];
  const emitted = new Set<string>();
  for (const tag of tags) {
    const root = find(tag.id);
    if (emitted.has(root)) continue;
    emitted.add(root);
    const members = tags.filter((t) => find(t.id) === root);
    const ids = new Set(members.map((t) => t.id));
    const commits = sortCommitsByDate(
      visible.filter((c) => ids.has(membership.get(c.id)![0])),
    );
    const lane = new Map(members.map((t, i) => [t.id, i]));
    blocks.push({
      tag,
      members,
      commits,
      laneOf:
        members.length > 1
          ? new Map(
              commits.map((c) => [
                c.id,
                membership.get(c.id)!.map((id) => lane.get(id)!),
              ]),
            )
          : undefined,
    });
  }
  return blocks;
}
