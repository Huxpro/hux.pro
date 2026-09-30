// =============================================================================
// Overlapping eras — how /works lays out chapters that share commits
// =============================================================================
//
// A chapter used to own its commits outright: one `tagId`, one block. Some
// work belongs to two at once — the Meta internships were React work and PL
// work — so a commit may name more chapters in `alsoTagIds`, and chapters
// that share a commit form an overlap group.
//
// Three readings of an overlap group are on trial here (`?eras=` on /works):
//
//   venn   — the group splits by membership: React only, React ∩ PL, PL only.
//            Every commit prints once; the middle block wears both markers,
//            and a bar per chapter in the margin spans the blocks it covers,
//            so the two bars overlap exactly where the chapters do.
//   lanes  — the group is one stretch of history in date order, drawn as
//            `git log --graph`: a lane per chapter, each commit a node on
//            its chapter's lane, a shared commit a node on both. The second
//            chapter's marker is where its lane begins.
//   picks  — chapters stay whole and sequential. A shared commit prints in
//            its home chapter wearing the other's ref (`git log --decorate`),
//            and appears in the other as a one-line cherry-pick pointing home.

import type { Locale } from "./i18n";
import {
  type Commit,
  type LogData,
  type Tag,
  type TimelineData,
  isCommitVisibleIn,
  isSuppressedRow,
  sortCommitsByDate,
  sortTagsByDate,
} from "./log";

export const ERA_LAYOUTS = ["venn", "lanes", "picks"] as const;
export type EraLayout = (typeof ERA_LAYOUTS)[number];
export const DEFAULT_ERA_LAYOUT: EraLayout = "venn";

export function parseEraLayout(value: string | null | undefined): EraLayout {
  return (ERA_LAYOUTS as readonly string[]).includes(value ?? "")
    ? (value as EraLayout)
    : DEFAULT_ERA_LAYOUT;
}

/** The overlap group a block belongs to, as its margin draws it. */
export interface EraLanes {
  /** Every chapter in the group, in lane order (newest first). */
  tags: Tag[];
  /** The lanes this block occupies. */
  of: number[];
  /** Lanes this block shares with the block before / after it — where a
   *  chapter's bar runs on across the gap between blocks. */
  above: number[];
  below: number[];
}

export interface EraBlock extends TimelineData {
  /** The chapters this block is part of — one, or the members of an
   *  intersection (venn) or of a whole group (lanes). */
  members: Tag[];
  /** Null for a chapter that overlaps nothing. */
  lanes: EraLanes | null;
  /** lanes: which lanes each commit is a node on, by commit id. */
  laneOf?: ReadonlyMap<string, number[]>;
  /** picks: commits printed here as a reference to their home chapter. */
  picks?: ReadonlySet<string>;
  /** picks: the other chapters a home row belongs to, by commit id. */
  decorations?: ReadonlyMap<string, Tag[]>;
}

/** Every chapter a commit belongs to, home first. */
export function commitTagIds(commit: Commit): string[] {
  return [commit.tagId, ...(commit.alsoTagIds ?? [])];
}

/**
 * The timeline as blocks, for the given layout. A log with no shared commits
 * comes out as exactly `buildTimelineData` would have it, in every layout.
 */
export function buildEraTimeline(
  logData: LogData,
  locale: Locale,
  layout: EraLayout,
): EraBlock[] {
  const visible = logData.commits.filter((c) => isCommitVisibleIn(c, locale));
  const tags = sortTagsByDate(logData.tags);
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const rank = new Map(tags.map((t, i) => [t.id, i]));

  // Membership, restricted to chapters that exist, in page order.
  const membership = new Map<string, string[]>();
  for (const c of visible) {
    const ids = [...new Set(commitTagIds(c))]
      .filter((id) => tagById.has(id))
      .sort((a, b) => rank.get(a)! - rank.get(b)!);
    membership.set(c.id, ids);
  }

  // Overlap groups: chapters joined by a shared commit (union–find).
  const parent = new Map(tags.map((t) => [t.id, t.id]));
  const find = (id: string): string =>
    parent.get(id) === id ? id : find(parent.get(id)!);
  for (const ids of membership.values()) {
    for (const id of ids.slice(1)) parent.set(find(id), find(ids[0]));
  }
  const groups = new Map<string, Tag[]>();
  for (const t of tags) {
    const root = find(t.id);
    groups.set(root, [...(groups.get(root) ?? []), t]);
  }

  const inGroup = (group: Tag[]) => {
    const ids = new Set(group.map((t) => t.id));
    return visible.filter((c) => ids.has(membership.get(c.id)![0]));
  };

  const blocks: EraBlock[] = [];
  const emitted = new Set<string>();
  for (const tag of tags) {
    const root = find(tag.id);
    if (emitted.has(root)) continue;
    emitted.add(root);
    const group = groups.get(root)!;
    const commits = inGroup(group);

    if (group.length === 1) {
      blocks.push({
        tag,
        members: [tag],
        commits: sortCommitsByDate(commits),
        lanes: null,
      });
      continue;
    }

    const laneIndex = new Map(group.map((t, i) => [t.id, i]));
    const lanesOf = (c: Commit) =>
      membership.get(c.id)!.map((id) => laneIndex.get(id)!);

    if (layout === "lanes") {
      blocks.push({
        tag: group[0],
        members: group,
        commits: sortCommitsByDate(commits),
        lanes: {
          tags: group,
          of: group.map((_, i) => i),
          above: [],
          below: [],
        },
        laneOf: new Map(commits.map((c) => [c.id, lanesOf(c)])),
      });
      continue;
    }

    if (layout === "picks") {
      group.forEach((t, i) => {
        const home = commits.filter((c) => c.tagId === t.id);
        // A suppressed role never takes a row, so it has nothing to point
        // home from — it stays where its tenure is drawn.
        const visiting = commits.filter(
          (c) =>
            c.tagId !== t.id &&
            membership.get(c.id)!.includes(t.id) &&
            !isSuppressedRow(c),
        );
        const decorations = new Map<string, Tag[]>();
        for (const c of home) {
          const others = membership
            .get(c.id)!
            .filter((id) => id !== t.id)
            .map((id) => tagById.get(id)!);
          if (others.length && !isSuppressedRow(c)) {
            decorations.set(c.id, others);
          }
        }
        blocks.push({
          tag: t,
          members: [t],
          commits: sortCommitsByDate([...home, ...visiting]),
          lanes: {
            tags: group,
            of: [i],
            above: [],
            below: [],
          },
          picks: new Set(visiting.map((c) => c.id)),
          decorations,
        });
      });
      continue;
    }

    // venn: one block per distinct membership, ordered along the lanes —
    // React only, React ∩ PL, PL only.
    const buckets = new Map<string, Commit[]>();
    for (const c of commits) {
      const key = lanesOf(c).join(",");
      buckets.set(key, [...(buckets.get(key) ?? []), c]);
    }
    const mean = (key: string) => {
      const l = key.split(",").map(Number);
      return l.reduce((a, b) => a + b, 0) / l.length;
    };
    // A chapter with nothing of its own still gets a block if a shared
    // commit names it — the bucket list is what decides.
    const keys = [...buckets.keys()].sort(
      (a, b) =>
        mean(a) - mean(b) || b.split(",").length - a.split(",").length,
    );
    const lanesAt = keys.map((key) => key.split(",").map(Number));
    const shared = (a: number[] | undefined, b: number[]) =>
      a ? b.filter((l) => a.includes(l)) : [];
    keys.forEach((key, k) => {
      const of = lanesAt[k];
      const members = of.map((i) => group[i]);
      blocks.push({
        tag: members.length === 1 ? members[0] : intersectionTag(members),
        members,
        commits: sortCommitsByDate(buckets.get(key)!),
        lanes: {
          tags: group,
          of,
          above: shared(lanesAt[k - 1], of),
          below: shared(lanesAt[k + 1], of),
        },
      });
    });
  }
  return blocks;
}

/** A stand-in chapter for the stretch several chapters share: their titles
 *  joined, and the span they have in common. */
function intersectionTag(members: Tag[]): Tag {
  const join = (lang: "en" | "zh") =>
    members.map((t) => t.title[lang]).join(" ∩ ");
  const starts = members.map((t) => t.startDate).sort();
  const ends = members
    .map((t) => t.endDate ?? "9999-12")
    .sort();
  return {
    id: members.map((t) => t.id).join("+"),
    title: { en: join("en"), zh: join("zh") },
    tagline: { en: "", zh: "" },
    startDate: starts[starts.length - 1],
    endDate: ends[0] === "9999-12" ? undefined : ends[0],
  };
}
