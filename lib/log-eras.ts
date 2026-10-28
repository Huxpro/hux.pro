// =============================================================================
// Overlapping eras: chapters that share commits
// =============================================================================
//
// A chapter used to own its commits outright: one `tagId`, one block. Some
// work belongs to two at once (the Meta internships were React work and PL
// work), so a commit may name more chapters in `alsoTagIds`, and chapters
// that share a commit overlap.
//
// Overlapping chapters print as one block, in date order, the way
// `git log --graph` prints two branches: the rail is the trunk, each chapter
// marker the ref where its branch starts, and a chapter that runs on past the
// next one's marker keeps a lane of its own beside the trunk until its last
// commit (see `components/log/timeline-lane.tsx`).

import {
  type Commit,
  type Tag,
  type TimelineData,
  buildTimelineData,
  sortCommitsByDate,
} from "./log";

export interface EraBlock extends TimelineData {
  /** The chapters this block prints, newest first: one, or every chapter
   *  of an overlap. The first is `tag`; each later one starts at its own
   *  marker inside the block. */
  members: Tag[];
  /** An overlap: which chapters each commit belongs to, by commit id, as
   *  indices into `members`. Absent for a chapter that overlaps nothing. */
  laneOf?: ReadonlyMap<string, number[]>;
}

/**
 * The timeline as blocks: `buildTimelineData`'s chapters (the same commits,
 * by the same visibility rule), with the chapters that share a commit
 * joined into one block. A log with no shared commits comes out as exactly
 * `buildTimelineData` has it.
 */
export function buildEraTimeline(
  ...args: Parameters<typeof buildTimelineData>
): EraBlock[] {
  const chapters = buildTimelineData(...args);
  const rank = new Map(chapters.map(({ tag }, i) => [tag.id, i]));
  /** The chapters a commit belongs to, home first, in page order. */
  const ranksOf = (c: Commit) =>
    [...new Set([c.tagId, ...(c.alsoTagIds ?? [])])]
      .flatMap((id) => rank.get(id) ?? [])
      .sort((a, b) => a - b);

  // Overlaps: chapters joined by a shared commit (union–find).
  const parent = chapters.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (const { commits } of chapters) {
    for (const c of commits) {
      const [first, ...rest] = ranksOf(c);
      for (const r of rest) parent[find(r)] = find(first);
    }
  }

  // One block per overlap, where its newest chapter stood.
  const groups = new Map<number, TimelineData[]>();
  chapters.forEach((chapter, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(chapter);
    else groups.set(root, [chapter]);
  });
  return [...groups.values()].map((group) => {
    const members = group.map(({ tag }) => tag);
    if (group.length === 1) return { ...group[0], members };
    const lane = new Map(group.map((_, i) => [rank.get(members[i].id)!, i]));
    const commits = sortCommitsByDate(group.flatMap(({ commits }) => commits));
    return {
      tag: members[0],
      members,
      commits,
      laneOf: new Map(
        commits.map((c) => [c.id, ranksOf(c).map((r) => lane.get(r)!)]),
      ),
    };
  });
}
