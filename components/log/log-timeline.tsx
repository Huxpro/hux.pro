"use client";

import { useCallback, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  adjustRailForHidden,
  computeBeams,
  computeInferredBeams,
  computeRail,
  type FilterableCommitType,
  formatTagDateRange,
  getLocalizedTagTitle,
  localizeOptional,
  type Identity,
  isRowVisible,
  type Tag,
} from "@/lib/log";
import { DEFAULT_FORM, type LogForm } from "@/lib/log-view";
import type { EraBlock } from "@/lib/log-eras";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { computeBylines } from "./bylines";
import { Commit } from "./commit-embed";
import { type BeamSpec, GUTTER_PULL, HASH_CELL } from "./timeline-commit";
import {
  RefInCell,
  type RefLook,
  type RowGraph,
  type RowLit,
} from "./timeline-lane";
import { useTimelineEdit } from "./timeline-edit-context";
import type { WorksRef } from "@/systems/devtool";

/** Stable "no filter" default — a fresh `[]` per render would bust the
 *  per-tag memo below on every render for callers that never filter
 *  (the editor's inspect loop re-renders constantly). */
const NO_TYPES: FilterableCommitType[] = [];

/** What a chapter's ref marker says: the newest chapter is `HEAD`, the rest
 *  their title. Shared with the pinned bar, which wears the same marker. */
export function chapterLabel(tag: Tag, tagIndex: number, locale: Locale): string {
  return tagIndex === 0 ? "HEAD" : getLocalizedTagTitle(tag, locale).toUpperCase();
}

/**
 * The ref marker's pill. Frosted-glass fill: translucent + blurred so the
 * ambient gradient shows through and gets tinted per-theme rather than
 * covered by a flat opaque patch. The blur is `sm:` and up: a sticky
 * backdrop filter over an animating wallpaper and full-bleed covers is
 * re-sampled every scroll frame, which a phone cannot afford, so there the
 * fill is denser instead. The tint direction follows the theme — lighten
 * toward white in light mode (keeping the near-white chip it always was),
 * darken with black in dark mode (the "shade darker than the page" look).
 * Compositing a tint at alpha α over backdrop B gives a uniform shift, so a
 * solid background reads the same as before while a gradient keeps its hue.
 */
export const CHAPTER_PILL =
  "inline-flex items-center bg-white/85 dark:bg-black/45 sm:bg-white/70 sm:dark:bg-black/25 sm:backdrop-blur font-mono text-xs font-medium text-foreground px-2.5 py-0.5 border rounded-full";

/** A block of the timeline: a chapter, or chapters that overlap (see
 *  `lib/log-eras.ts`). A plain `TimelineData[]` is still a timeline. */
type Block = { tag: Tag; commits: CommitData[] } & Partial<
  Pick<EraBlock, "members" | "laneOf">
>;

interface LogTimelineProps {
  data: Block[];
  locale: Locale;
  /**
   * Global identities map (handle + company + accent per identity id).
   * Used to hydrate the `<handle>` byline and the expanded author
   * block on each commit; each row resolves its `identityId` and looks
   * up here.
   */
  identities?: Record<string, Identity>;
  /** How much of each commit to print. See `lib/log-view.ts`. */
  form?: LogForm;
  /**
   * Selected commit types. Empty is "no filter"; anything else hides every
   * commit that doesn't match — events included, since they are the one
   * type that isn't selectable in the first place.
   *
   * Filtering hides rows rather than removing them from the array, because
   * identity resolution walks the full list: the roles behind a `<handle>`
   * byline are almost always `hideRow` rows that were never on screen, so
   * dropping them would cost every surviving commit its author.
   */
  activeTypes?: FilterableCommitType[];
  /** Wires each row's hash as its permalink. Omit and it is plain text. */
  onSelectHash?: (hash: string) => void;
  /**
   * The page pins a bar that wears the current chapter (/works). Each
   * chapter's marker then stays in the flow as a divider and hands its pill
   * to the bar as it scrolls under it, instead of sticking on its own —
   * two sticky layers at the top of a phone would be one too many.
   */
  pinnedChapters?: boolean;
  /** How a chapter's ref sits on the graph (see `RefLabel`). The default
   *  is the plain marker the editor and every other log use. */
  refLook?: RefLayout;
}

/**
 * Git Log / Commit History style timeline.
 * Renders tags as ref markers and commits as dense log entries.
 */
export function LogTimeline({
  data,
  locale,
  identities,
  form = DEFAULT_FORM,
  activeTypes = NO_TYPES,
  onSelectHash,
  pinnedChapters = false,
  refLook = "stub",
}: LogTimelineProps) {
  return (
    <div className="space-y-0">
      {data.map(({ tag, commits, members, laneOf }, tagIndex) => (
        <TagBlock
          key={tag.id}
          tag={tag}
          commits={commits}
          members={members}
          laneOf={laneOf}
          tagIndex={tagIndex}
          locale={locale}
          identities={identities}
          form={form}
          activeTypes={activeTypes}
          onSelectHash={onSelectHash}
          pinned={pinnedChapters}
          refLook={refLook}
        />
      ))}
    </div>
  );
}

interface TagBlockProps {
  tag: Tag;
  commits: CommitData[];
  members?: Tag[];
  laneOf?: ReadonlyMap<string, number[]>;
  tagIndex: number;
  locale: Locale;
  identities?: Record<string, Identity>;
  form: LogForm;
  activeTypes: FilterableCommitType[];
  onSelectHash?: (hash: string) => void;
  pinned: boolean;
  refLook: RefLayout;
}

function TagBlock({
  tag,
  commits,
  members,
  laneOf,
  tagIndex,
  locale,
  identities,
  form,
  activeTypes,
  onSelectHash,
  pinned,
  refLook,
}: TagBlockProps) {
  const edit = useTimelineEdit();
  const inspecting = edit?.mode === "inspect";
  const isTagSelected = edit?.editingTagId === tag.id;
  const tagLabel = chapterLabel(tag, tagIndex, locale);
  const [activeBeam, setActiveBeam] = useState<BeamSpec | null>(null);
  const handleBeamSet = useCallback(
    (spec: BeamSpec) => setActiveBeam(spec),
    [],
  );
  // Stale-write guard: React runs sibling useEffects in document order,
  // so a row higher up the list can fire its "set" before a row lower
  // down fires its "clear" for the same hover transition. Ignore the
  // clear if the active beam no longer matches the leaving row's spec.
  const handleBeamClear = useCallback(
    (spec: BeamSpec) =>
      setActiveBeam((current) =>
        current &&
        current.fromHash === spec.fromHash &&
        current.toHash === spec.toHash
          ? null
          : current,
      ),
    [],
  );

  // Compute beam specs for explicit `attachedTo` attachments. Both
  // endpoints (source + target) carry the same spec so hovering/
  // focusing/expanding EITHER end lights the connector's path.

  const {
    railInfo,
    beamSpecs,
    attachments,
    bylines,
    isHidden,
    hasVisible,
  } = useMemo(() => {
    const bylinesArr = computeBylines(commits, identities, locale);

    // One predicate, four consumers: the rail re-brackets around the rows
    // that survive, beams with a hidden endpoint are dropped, the render
    // loop below skips the rest, and the block prints nothing if none are
    // left. It is `isRowVisible` negated — the same question /works asks
    // for its chip counts and its empty state.
    const hidden = (c: CommitData) => !isRowVisible(c, activeTypes);

    const rail = adjustRailForHidden(commits, computeRail(commits), hidden);
    const allBeams = [
      ...computeBeams(commits, hidden).map((b) => ({
        ...b,
        inferred: false,
      })),
      ...computeInferredBeams(commits, rail).map((b) => ({
        ...b,
        inferred: true,
      })),
    ];

    // Each beam endpoint stashes a BeamSpec so hover/focus/expand
    // fires `activeBeam`. Source specs carry their own fromHash for
    // exact-match activation. Target specs use `fromHash: null` so
    // hovering the target activates every incoming connector.
    const specs: (BeamSpec | null)[] = commits.map(() => null);
    for (const b of allBeams) {
      specs[b.fromIdx] = {
        fromHash: b.fromHash,
        toHash: b.toHash,
        roleId: b.roleId,
      };
      if (specs[b.toIdx] === null) {
        specs[b.toIdx] = {
          fromHash: null,
          toHash: b.toHash,
          roleId: b.roleId,
        };
      }
    }

    return {
      railInfo: rail,
      beamSpecs: specs,
      attachments: allBeams,
      bylines: bylinesArr,
      isHidden: hidden,
      hasVisible: commits.some((c) => !hidden(c)),
    };
  }, [commits, identities, locale, activeTypes]);

  // A chapter with nothing left in it prints nothing — no ref marker hanging
  // over an empty stretch of page. The era headers are the timeline's spine,
  // but a spine with no vertebrae is just a line.
  if (!hasVisible) return null;

  const graph = chapterGraph(commits, isHidden, laneOf);
  const { items, graphs } = graph;
  // The connectors lit right now — a commit and the role it hangs from —
  // drawn along the graph's own lines rather than straight down the icon
  // column (see `litPath`).
  const lit = (() => {
    const rows = new Map<number, RowLit>();
    const refs = new Map<number, "aside" | "through">();
    if (!activeBeam) return { rows, refs };
    const posOf = new Map<number, number>();
    items.forEach((it, p) => {
      if (it.kind === "row") posOf.set(it.i, p);
    });
    for (const a of attachments) {
      const active =
        activeBeam.toHash === a.toHash &&
        (activeBeam.fromHash === a.fromHash ||
          (activeBeam.fromHash === null && !a.inferred));
      const from = posOf.get(a.fromIdx);
      const to = posOf.get(a.toIdx);
      if (!active || from === undefined || to === undefined) continue;
      const path = litPath(graph, from, to);
      for (const [p, l] of path.rows) {
        const i = (items[p] as { i: number }).i;
        rows.set(i, { ...rows.get(i), ...l });
      }
      for (const [p, l] of path.refs) refs.set(p, l);
    }
    return { rows, refs };
  })();
  // The tag's message: an annotated tag carries one, and `git show` prints
  // it before the commits it marks — the chapter, as its author tells it.
  const message = localizeOptional(tag.narrative, locale);

  return (
    <div>
      {/* Tag ref marker — like `git log --decorate` ref annotations */}
      <div
        className={cn(
          "pb-2",
          pinned ? "relative" : "sticky top-4 z-20",
          tagIndex > 0 ? "mt-6 pt-6 border-t border-border/30" : "pt-2",
        )}
      >
        {/* The chapter's trunk starts at its ref. */}
        <RefGraphLayer
          // The marker's centre: below the rule once there is a chapter
          // above, and the marker's own half-height.
          y={(tagIndex > 0 ? 25 : 8) + 11}
          first
          look={inspecting ? "stub" : lookOf(refLook)}
        />
        <div className="flex items-center gap-3">
        {!inspecting && refLook !== "stub" ? (
          <RefLabel
            look={refLook}
            tag={tag}
            label={tagLabel}
            locale={locale}
            pinned={pinned}
            message={pinned ? message : undefined}
          />
        ) : inspecting && edit ? (
          <button
            type="button"
            onClick={() => edit.onSelectTag(tag.id)}
            className={cn(
              CHAPTER_PILL,
              "relative transition-colors",
              isTagSelected
                ? "border-sky-500/70 ring-1 ring-inset ring-sky-500/35 bg-sky-500/[0.05]"
                : "border-border hover:border-sky-500/50",
            )}
            title="Inspect chapter"
          >
            {tagLabel}
          </button>
        ) : (
          // `data-chapter` is what the pinned bar watches: the moment this
          // pill reaches the bar's ref slot, the slot wears it.
          <span
            data-chapter={pinned ? tag.id : undefined}
            className={cn(CHAPTER_PILL, "relative border-border")}
          >
            {tagLabel}
          </span>
        )}
        {(inspecting || refLook === "stub") && !tag.hideDate && (
          <span className="font-mono text-xs text-tertiary-foreground">
            {formatTagDateRange(tag, locale)}
          </span>
        )}
        {inspecting && edit && (
          <button
            type="button"
            onClick={() => edit.onAddCommit(tag.id)}
            className="inline-flex items-center justify-center text-tertiary-foreground hover:text-foreground transition-colors"
            title="Add entry"
            aria-label="Add entry"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        </div>
        {pinned && (inspecting || refLook === "stub") && message && (
          <StubMessage text={message} />
        )}
      </div>

      {/* Commits — relative so the beam measures against this box.
       *  Consecutive commits sharing a tenure segmentId are wrapped in
       *  a `group/tenure` div so hovering/focusing/expanding ANY row in
       *  the cluster brightens the rail and the role's ring. */}
      <div className="relative space-y-0">
        {(() => {
          // Hidden-role rows (roles with `hideRow: true`) are kept in the
          // commits array so `computeRail` and `resolveAuthor` can use
          // their tenure windows / handles, but they don't render here —
          // the cluster they anchor speaks for the tenure via the rail +
          // author bylines.
          type Run =
            | { kind: "loose"; items: Item[] }
            | { kind: "cluster"; segmentId: string; items: Item[] };
          const runs: Run[] = [];
          for (const item of items) {
            const last = runs[runs.length - 1];
            // A ref joins whatever run it falls in, so a tenure it sits
            // inside stays one cluster around it.
            if (item.kind === "ref") {
              if (last) last.items.push(item);
              else runs.push({ kind: "loose", items: [item] });
              continue;
            }
            const sid = railInfo[item.i].segmentId;
            if (sid && last && last.kind === "cluster" && last.segmentId === sid) {
              last.items.push(item);
            } else if (sid) {
              runs.push({ kind: "cluster", segmentId: sid, items: [item] });
            } else if (last && last.kind === "loose") {
              last.items.push(item);
            } else {
              runs.push({ kind: "loose", items: [item] });
            }
          }
          return runs.map((run) => {
            const rows = run.items.map((item) => {
              if (item.kind === "ref") {
                const ref = members![item.lane];
                return (
                  <RefRow
                    key={`ref-${ref.id}`}
                    tag={ref}
                    locale={locale}
                    mode={item.mode}
                    pinned={pinned}
                    look={refLook}
                    lit={lit.refs.get(items.indexOf(item))}
                  />
                );
              }
              const i = item.i;
              return (
                <Commit
                  key={commits[i].id}
                  commit={commits[i]}
                  locale={locale}
                  variant="timeline"
                  hideDate={tag.hideDate || commits[i].hideDate}
                  rail={railInfo[i].rail}
                  graph={graphs[i]}
                  graphLit={lit.rows.get(i)}
                  segmentId={railInfo[i].segmentId}
                  isSegmentActive={
                    railInfo[i].segmentId !== null &&
                    railInfo[i].segmentId === activeBeam?.roleId
                  }
                  beamSpec={beamSpecs[i]}
                  onBeamSet={handleBeamSet}
                  onBeamClear={handleBeamClear}
                  byline={bylines[i]}
                  form={form}
                  onSelectHash={onSelectHash}
                />
              );
            });
            const head = run.items.find((it) => it.kind === "row");
            const key = head && head.kind === "row" ? commits[head.i].id : tag.id;
            return run.kind === "cluster" ? (
              // An identity can cluster twice (Meta, then RIT, then Meta
              // again), so the run is named by its first row, not its id.
              <div key={`cluster-${key}`} className="group/tenure">
                {rows}
              </div>
            ) : (
              <div key={`loose-${key}`}>{rows}</div>
            );
          });
        })()}
        {/* No connector overlay: a lit connector is the graph's own lines,
            lit along its path (`lit` above), so it bends where the chapter
            does instead of cutting straight down the icon column. */}
      </div>
    </div>
  );
}

// =============================================================================
// The chapter graph (see timeline-lane.tsx)
// =============================================================================

type RefMode = "plain" | "take" | "fork";

type Item =
  | { kind: "row"; i: number }
  | { kind: "ref"; lane: number; mode: RefMode };

/**
 * The block's printed items in order — each later chapter's ref goes in
 * above its first commit — and what each row draws of the graph.
 *
 * The block's chapter holds the trunk from its header. At a later chapter's
 * ref, if the one on the trunk has nothing further down, the newcomer just
 * takes the trunk over (`plain`). If both go on, whichever has more of the
 * rest to itself keeps the trunk: the newcomer takes it and the running one
 * steps aside (`take`), or the newcomer forks off into the side lane
 * (`fork`). When the trunk's chapter ends while the side lane is still
 * running, the side lane turns back into the trunk.
 *
 * A commit sits on the trunk if it belongs to the trunk's chapter, else on
 * the side lane. One side lane at a time: a ref landing while one is
 * running takes the trunk, and whoever held it simply stops there.
 */
function chapterGraph(
  commits: CommitData[],
  isHidden: (c: CommitData) => boolean,
  laneOf: ReadonlyMap<string, number[]> | undefined,
): ChapterGraph {
  const lanesOf = (c: CommitData) => laneOf?.get(c.id) ?? [0];
  const items: Item[] = [];
  const started = new Set<number>([0]);
  for (let i = 0; i < commits.length; i++) {
    if (isHidden(commits[i])) continue;
    for (const l of lanesOf(commits[i])) {
      if (started.has(l)) continue;
      started.add(l);
      items.push({ kind: "ref", lane: l, mode: "plain" });
    }
    items.push({ kind: "row", i });
  }

  const on = (p: number) => {
    const it = items[p];
    return it.kind === "row" ? lanesOf(commits[it.i]) : [];
  };
  const last = new Map<number, number>();
  items.forEach((_, p) => {
    for (const l of on(p)) last.set(l, p);
  });
  const lastOf = (l: number) => last.get(l) ?? -1;
  /** Rows after `p` that are `a`'s and not `b`'s. */
  const own = (a: number, b: number, p: number) => {
    let n = 0;
    for (let q = p + 1; q < items.length; q++) {
      const l = on(q);
      if (l.includes(a) && !l.includes(b)) n++;
    }
    return n;
  };

  const graphs: (RowGraph | undefined)[] = commits.map(() => undefined);
  const holders: Holders[] = [];
  let trunk = 0;
  let side: number | null = null;
  items.forEach((it, p) => {
    if (it.kind === "ref") {
      const before = { trunk, side };
      if (lastOf(trunk) > p && side === null) {
        if (own(trunk, it.lane, p) > own(it.lane, trunk, p)) {
          it.mode = "fork";
          side = it.lane;
          holders[p] = { ...before, after: { trunk, side } };
          return;
        }
        it.mode = "take";
        side = trunk;
      }
      trunk = it.lane;
      holders[p] = { ...before, after: { trunk, side } };
      return;
    }
    // The trunk's chapter is over and the side lane runs on: it turns back
    // into the trunk at this row.
    let enter = false;
    if (side !== null && lastOf(trunk) < p) {
      trunk = side;
      side = null;
      enter = true;
    }
    const here = on(p);
    const onSide = side !== null && here.includes(side);
    const onTrunk = here.includes(trunk) || !onSide;
    holders[p] = { trunk, side };
    const g: RowGraph = { trunkAbove: !enter, trunkBelow: false, enter };
    if (side !== null) {
      const end = lastOf(side);
      g.side = onTrunk
        ? onSide
          ? p === end
            ? "join"
            : "touch"
          : "pass"
        : "node";
      if (g.side === "node") {
        g.sideAbove = true;
        g.sideBelow = p < end;
      }
      if (p >= end) side = null;
    }
    graphs[it.i] = g;
  });

  // The trunk runs on to whatever comes next — a row, or a ref that picks
  // it up — unless the next row is the side lane turning back into it.
  items.forEach((it, p) => {
    if (it.kind !== "row") return;
    const next = items[p + 1];
    graphs[it.i]!.trunkBelow =
      !!next && !(next.kind === "row" && graphs[next.i]?.enter);
  });
  return { items, graphs, holders, on };
}

/** Who held the trunk and the side lane at an item — for a ref, before it
 *  and after it. */
interface Holders {
  trunk: number;
  side: number | null;
  after?: { trunk: number; side: number | null };
}

interface ChapterGraph {
  items: Item[];
  graphs: (RowGraph | undefined)[];
  holders: Holders[];
  /** The chapters (lane indices) an item's commit is on. */
  on: (p: number) => number[];
}

/**
 * The lines a connector lights, row by row: from one end's node to the
 * other's, along the chapter both ends are on — wherever that chapter runs
 * in between. It holds the trunk, or has stepped aside at a ref, or comes
 * back in at an `enter`; the lit lines are the ones it is drawn on.
 */
function litPath(
  graph: ChapterGraph,
  fromPos: number,
  toPos: number,
): { rows: Map<number, RowLit>; refs: Map<number, "aside" | "through"> } {
  const rows = new Map<number, RowLit>();
  const refs = new Map<number, "aside" | "through">();
  const [a, b] = fromPos < toPos ? [fromPos, toPos] : [toPos, fromPos];
  const shared = graph.on(a).filter((l) => graph.on(b).includes(l));
  const c = shared[0] ?? graph.on(b)[0] ?? 0;
  const add = (p: number, lit: RowLit) =>
    rows.set(p, { ...rows.get(p), ...lit });

  for (let p = a; p <= b; p++) {
    const it = graph.items[p];
    const h = graph.holders[p];
    if (!h) continue;
    if (it.kind === "ref") {
      if (it.mode === "take" && h.trunk === c) refs.set(p, "aside");
      else if (h.after?.trunk === c || h.trunk === c) refs.set(p, "through");
      continue;
    }
    const g = graph.graphs[it.i]!;
    const top = p === a;
    const bottom = p === b;
    // Where the chapter runs at this row: on the trunk, or the side lane.
    const onTrunk = h.trunk === c;
    const onSide = h.side === c;
    if (!onTrunk && !onSide) {
      // Not drawn here at all (a hole in the data): fall back on the trunk.
      add(p, { trunkAbove: !top, trunkBelow: !bottom });
      continue;
    }
    if (onTrunk) {
      add(p, {
        // Came in from the side lane at this very node.
        ...(g.enter ? { sideAbove: !top } : { trunkAbove: !top }),
        trunkBelow: !bottom,
      });
      continue;
    }
    // On the side lane: the node is on the trunk (the commit is on both,
    // and the lane reaches in to it) or on the side lane itself.
    const node = g.side === "node";
    add(p, {
      sideAbove: !top,
      sideBelow: !bottom,
      reach: !node && (top || bottom),
    });
  }
  return { rows, refs };
}

/** Where a ref's line sits: the same grid as a row, laid over the marker, so
 *  its icon cell is exactly on the trunk. */
function RefGraphLayer({
  y,
  mode,
  first,
  look,
  lit,
}: {
  y: number;
  mode?: RefMode;
  first?: boolean;
  look?: RefLook | "auto";
  lit?: "aside" | "through";
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className={cn(
          "h-full -mx-3 px-3 @container [clip-path:inset(0_-100vw)]",
          GUTTER_PULL,
        )}
      >
        <div className="grid h-full grid-cols-[auto_1fr] lg:grid-cols-[auto_auto_1fr] gap-x-2">
          <span
            className={cn(
              "hidden lg:inline-block select-none",
              HASH_CELL,
              TYPE.hash,
              "text-transparent",
            )}
          >
            0000000
          </span>
          <span className="relative w-5">
            {look === "auto" ? (
              <>
                {/* The marker over the trunk on a phone, a ring on it where
                    the marker has moved to the hash slot. */}
                <span className="contents lg:hidden">
                  <RefInCell y={y} mode={mode} first={first} look="under" lit={lit} />
                </span>
                <span className="hidden lg:contents">
                  <RefInCell y={y} mode={mode} first={first} look="ring" lit={lit} />
                </span>
              </>
            ) : (
              <RefInCell y={y} mode={mode} first={first} look={look} lit={lit} />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * A chapter that starts inside an overlap: its ref, drawn as every chapter
 * marker is — the same pill in the same place — without the rule above it,
 * since the chapter before it has not ended.
 */
function RefRow({
  tag,
  locale,
  mode,
  pinned,
  look,
  lit,
}: {
  tag: Tag;
  locale: Locale;
  mode: RefMode;
  pinned: boolean;
  look: RefLayout;
  lit?: "aside" | "through";
}) {
  const message = localizeOptional(tag.narrative, locale);
  return (
    <div className="relative pt-8 pb-2">
      <RefGraphLayer y={32 + 11} mode={mode} look={lookOf(look)} lit={lit} />
      <div className="flex items-center gap-3">
        <RefLabel
          look={look}
          tag={tag}
          label={chapterLabel(tag, -1, locale)}
          locale={locale}
          pinned={pinned}
          message={message}
        />
      </div>
      {look === "stub" && message && <StubMessage text={message} />}
    </div>
  );
}

/** `stub`'s message: a paragraph under the marker, from the page column's
 *  edge, on a measure (the reading #326 tried). */
function StubMessage({ text }: { text: string }) {
  return <p className={cn("relative mt-2 max-w-prose", TYPE.body)}>{text}</p>;
}

/** Where a ref's marker goes — on trial, switched from the DevTool's Works
 *  module (see `WorksRef` in systems/devtool). */
type RefLayout = WorksRef;

/** The line a layout draws: a marker in the hash slot leaves a ring on
 *  the trunk, as a marker in the title slot does. */
function lookOf(layout: RefLayout): RefLook | "auto" {
  return layout === "hash" || layout === "row" ? "ring" : layout;
}

/**
 * A ref's marker and its span, placed for its look. `stub` keeps the
 * marker at the page column's edge; the others lay the ref out on the same
 * grid as a commit row, so it lines up with the rows under it:
 *
 *   ring    ·  ○  (DESIGN) 2004 – 2016     the marker where a title goes
 *   row     ·  ○  (DESIGN) ······ 2004 – 2016   …and the span where a date goes
 *   under   ·  (DESIGN) 2004 – 2016        the marker on the trunk
 *   hash    (DESIGN) ○  2004 – 2016        the marker where a hash goes
 */
function RefLabel({
  look,
  tag,
  label,
  locale,
  pinned,
  message,
}: {
  look: RefLayout;
  tag: Tag;
  label: string;
  locale: Locale;
  pinned: boolean;
  /** The tag's message. The grid looks print it where a commit's
   *  description goes, in its type; `stub` leaves it to the caller. */
  message?: string;
}) {
  // `data-chapter` is what the pinned bar watches: the moment this pill
  // reaches the bar's ref slot, the slot wears it. One per ref.
  const pill = (
    <span
      data-chapter={pinned ? tag.id : undefined}
      className={cn(CHAPTER_PILL, "relative shrink-0 border-border")}
    >
      {label}
    </span>
  );
  const date = tag.hideDate ? null : (
    <span className="font-mono text-xs text-tertiary-foreground">
      {formatTagDateRange(tag, locale)}
    </span>
  );
  if (look === "stub") {
    return (
      <>
        {pill}
        {date}
      </>
    );
  }
  const blankHash = (
    <span
      aria-hidden
      className={cn(
        "hidden lg:inline-block select-none",
        HASH_CELL,
        TYPE.hash,
        "text-transparent",
      )}
    >
      0000000
    </span>
  );
  return (
    <div className={cn("flex-1 min-w-0 -mx-3 px-3 @container", GUTTER_PULL)}>
      <div
        className={cn(
          "grid gap-x-2 items-center",
          // The icon column held open at its width, so the message under
          // a marker that spans it still starts where titles do.
          look === "hash"
            ? "grid-cols-[auto_1fr] lg:grid-cols-[auto_auto_1fr]"
            : look === "auto"
              ? // The hash slot at the gutter's width (HASH_CELL).
                "grid-cols-[1.25rem_1fr] lg:grid-cols-[3.5rem_1.25rem_1fr]"
              : "grid-cols-[1.25rem_1fr] lg:grid-cols-[auto_1.25rem_1fr]",
        )}
      >
        {look === "auto" ? (
          // `under` where there is no hash slot, `hash` where there is: one
          // marker, placed twice. On a phone the marker and its span sit
          // together over the icon column; from `lg` the wrapper dissolves
          // and each takes its own cell — the marker the hash's, overflowing
          // it leftward, the span the title's.
          <span className="col-span-2 flex items-center gap-3 min-w-0 lg:contents">
            <span className="flex lg:col-start-1 lg:row-start-1 lg:justify-self-end">
              {pill}
            </span>
            <span className="flex items-center min-w-0 lg:col-start-3 lg:row-start-1">
              {date}
            </span>
          </span>
        ) : look === "hash" ? (
          <>
            {/* The hash slot is a hash wide; the marker overflows it to
                the left, so the trunk stays where it is. Below `lg` there
                is no hash slot, and the marker sits on the trunk. */}
            <span className="flex justify-end lg:w-14 font-mono text-xs">
              {pill}
            </span>
            <span aria-hidden className="hidden lg:inline-block w-5" />
            <span className="flex items-center min-w-0">{date}</span>
          </>
        ) : look === "ring" || look === "row" ? (
          <>
            {blankHash}
            <span aria-hidden className="w-5" />
            {/* `row`: the span where a commit's date goes, on the right. */}
            <span className="flex items-center gap-3 min-w-0">
              {pill}
              {look === "row" ? (
                <span className={cn("ml-auto shrink-0", TYPE.rowMeta)}>
                  {date}
                </span>
              ) : (
                date
              )}
            </span>
          </>
        ) : (
          <>
            {blankHash}
            <span className="col-span-2 flex items-center gap-3 min-w-0">
              {pill}
              {date}
            </span>
          </>
        )}
        {message && (
          <p
            className={cn(
              "col-start-2 lg:col-start-3 mt-1.5 min-w-0",
              TYPE.caption,
            )}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
