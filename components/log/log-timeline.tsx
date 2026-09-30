"use client";

import { type CSSProperties, useCallback, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  computeCommitHash,
  adjustRailForHidden,
  computeBeams,
  computeInferredBeams,
  computeRail,
  type FilterableCommitType,
  formatCommitDate,
  formatTagDateRange,
  getLocalizedCommitTitle,
  getLocalizedTagTitle,
  type Identity,
  isRowVisible,
  type Tag,
} from "@/lib/log";
import { DEFAULT_FORM, type LogForm } from "@/lib/log-view";
import type { EraBlock, EraLanes } from "@/lib/log-eras";
import { CornerDownRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeBylines } from "./bylines";
import { Commit } from "./commit-embed";
import { TimelineConnector } from "./timeline-connector";
import {
  type BeamSpec,
  GUTTER_PULL,
  HASH_CELL,
  REF_CHIP,
} from "./timeline-commit";
import { QuietLine } from "./quiet-line";
import { TYPE } from "@/lib/typography";
import { useTimelineEdit } from "./timeline-edit-context";

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

/** A block of the timeline: a chapter, or — where chapters overlap — a
 *  stretch of them (see `lib/log-eras.ts`). The era fields are optional so a
 *  plain `TimelineData[]` is still a timeline. */
type Block = { tag: Tag; commits: CommitData[] } & Partial<
  Omit<EraBlock, "tag" | "commits">
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
}: LogTimelineProps) {
  return (
    <div className="space-y-0">
      {data.map(({ tag, commits, ...era }, tagIndex) => (
        <TagBlock
          key={tag.id}
          tag={tag}
          commits={commits}
          era={era}
          tagIndex={tagIndex}
          locale={locale}
          identities={identities}
          form={form}
          activeTypes={activeTypes}
          onSelectHash={onSelectHash}
          pinned={pinnedChapters}
        />
      ))}
    </div>
  );
}

interface TagBlockProps {
  tag: Tag;
  commits: CommitData[];
  era: Omit<Block, "tag" | "commits">;
  tagIndex: number;
  locale: Locale;
  identities?: Record<string, Identity>;
  form: LogForm;
  activeTypes: FilterableCommitType[];
  onSelectHash?: (hash: string) => void;
  pinned: boolean;
}

function TagBlock({
  tag,
  commits,
  era,
  tagIndex,
  locale,
  identities,
  form,
  activeTypes,
  onSelectHash,
  pinned,
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
  // focusing/expanding EITHER end brightens the connector line.
  // Per-endpoint gap is derived from the commit so the line meets each
  // endpoint at the right radius (role ring vs icon vs event/aside dot).
  const gapFor = (c: CommitData) =>
    c.type === "role" ? 10 : c.type === "event" || c.present === "aside" ? 3 : 7;

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
    // A cherry-pick prints here but its tenure is drawn at home: the rail
    // and the beams read it as absent, and bridge over it.
    const offRail = (c: CommitData) => hidden(c) || !!era.picks?.has(c.id);

    const rail = adjustRailForHidden(commits, computeRail(commits), offRail);
    const allBeams = [
      ...computeBeams(commits, offRail).map((b) => ({
        ...b,
        inferred: false,
      })),
      ...computeInferredBeams(commits, rail).map((b) => ({
        ...b,
        inferred: true,
      })),
    ];

    const attachmentsWithGaps = allBeams.map((b) => ({
      ...b,
      fromGap: gapFor(commits[b.fromIdx]),
      toGap: gapFor(commits[b.toIdx]),
    }));

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
      attachments: attachmentsWithGaps,
      bylines: bylinesArr,
      isHidden: hidden,
      hasVisible: commits.some((c) => !hidden(c)),
    };
  }, [commits, identities, locale, activeTypes, era.picks]);

  // A chapter with nothing left in it prints nothing — no ref marker hanging
  // over an empty stretch of page. The era headers are the timeline's spine,
  // but a spine with no vertebrae is just a line.
  if (!hasVisible) return null;

  const lanes = era.lanes ?? null;
  const isLanes = !!era.laneOf && !!lanes;
  // venn / picks: the chapter's bar(s) in the margin. lanes: per-row graph.
  const barred = !!lanes && !isLanes && !era.picks;
  // The rows this block prints, in order, with each lane's branch marker
  // inserted above the first row on that lane (lanes only).
  type Item =
    | { kind: "row"; i: number }
    | { kind: "pick"; i: number }
    | { kind: "branch"; lane: number };
  const items: Item[] = [];
  const branched = new Set<number>([0]);
  for (let i = 0; i < commits.length; i++) {
    if (isHidden(commits[i])) continue;
    if (isLanes) {
      for (const l of era.laneOf!.get(commits[i].id) ?? []) {
        if (!branched.has(l)) {
          branched.add(l);
          items.push({ kind: "branch", lane: l });
        }
      }
    }
    items.push({ kind: era.picks?.has(commits[i].id) ? "pick" : "row", i });
  }
  const graph = isLanes ? laneGraph(items, commits, era.laneOf!, lanes!) : null;

  return (
    <div className={cn(barred && "relative")}>
      {barred && <EraBars lanes={lanes!} gapAbove={tagIndex > 0} />}
      {/* Tag ref marker — like `git log --decorate` ref annotations */}
      <div
        className={cn(
          "flex items-center gap-3 py-2",
          !pinned && "sticky top-4 z-20",
          isLanes && "relative",
          tagIndex > 0 && "mt-6 pt-6 border-t border-border/30",
        )}
      >
        {isLanes && (
          <LaneCell
            cell={{
              count: lanes!.tags.length,
              lanes: lanes!.tags.map((_, l) =>
                l === 0
                  ? { above: false, below: true, node: "ring" as const }
                  : { above: false, below: false, node: null },
              ),
            }}
            nodeY={(tagIndex > 0 ? 24 : 0) + 19}
            tags={lanes!.tags}
          />
        )}
        {inspecting && edit ? (
          <button
            type="button"
            onClick={() => edit.onSelectTag(tag.id)}
            className={cn(
              CHAPTER_PILL,
              "transition-colors",
              isTagSelected
                ? "border-sky-500/70 ring-1 ring-inset ring-sky-500/35 bg-sky-500/[0.05]"
                : "border-border hover:border-sky-500/50",
            )}
            title="Inspect chapter"
          >
            {tagLabel}
          </button>
        ) : era.members && era.members.length > 1 && !isLanes ? (
          // An intersection wears every member's marker, overlapping the
          // way the chapters do — two pills, one stretch of history.
          <span
            data-chapter={pinned ? tag.id : undefined}
            className="inline-flex items-center"
          >
            {era.members.map((m, k) => (
              <span
                key={m.id}
                className={cn(
                  CHAPTER_PILL,
                  "border-border relative",
                  k > 0 && "-ml-2",
                )}
                style={{ zIndex: era.members!.length - k }}
              >
                <LaneDot tag={m} />
                {chapterLabel(m, -1, locale)}
              </span>
            ))}
          </span>
        ) : (
          // `data-chapter` is what the pinned bar watches: the moment this
          // pill reaches the bar's ref slot, the slot wears it.
          <span
            data-chapter={pinned ? tag.id : undefined}
            className={cn(CHAPTER_PILL, "border-border")}
          >
            {lanes && <LaneDot tag={tag} />}
            {tagLabel}
          </span>
        )}
        {!tag.hideDate && (
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
          //
          // A cherry-pick or a branch marker joins whatever run it falls in,
          // so a tenure it sits inside stays one cluster around it.
          type Run =
            | { kind: "loose"; items: Item[] }
            | { kind: "cluster"; segmentId: string; items: Item[] };
          const runs: Run[] = [];
          for (const item of items) {
            const last = runs[runs.length - 1];
            const sid = item.kind === "row" ? railInfo[item.i].segmentId : null;
            if (item.kind !== "row" && last) {
              last.items.push(item);
            } else if (sid && last && last.kind === "cluster" && last.segmentId === sid) {
              last.items.push(item);
            } else if (sid) {
              runs.push({ kind: "cluster", segmentId: sid, items: [item] });
            } else if (last && last.kind === "loose") {
              last.items.push(item);
            } else {
              runs.push({ kind: "loose", items: [item] });
            }
          }
          const renderItem = (item: Item, pos: number) => {
            if (item.kind === "branch") {
              const branchTag = lanes!.tags[item.lane];
              return (
                <LaneRow
                  key={`branch-${branchTag.id}`}
                  cell={graph![pos]}
                  nodeY={27}
                  tags={lanes!.tags}
                >
                  <div className="flex items-center gap-3 pt-4 pb-1.5">
                    <span
                      data-chapter={pinned ? branchTag.id : undefined}
                      className={cn(CHAPTER_PILL, "border-border")}
                    >
                      <LaneDot tag={branchTag} />
                      {chapterLabel(branchTag, -1, locale)}
                    </span>
                    {!branchTag.hideDate && (
                      <span className="font-mono text-xs text-tertiary-foreground">
                        {formatTagDateRange(branchTag, locale)}
                      </span>
                    )}
                  </div>
                </LaneRow>
              );
            }
            const c = commits[item.i];
            if (item.kind === "pick") {
              const home = lanes?.tags.find((t) => t.id === c.tagId);
              return (
                <PickRow
                  key={c.id}
                  commit={c}
                  home={home}
                  locale={locale}
                  railThrough={railThrough(item.i)}
                  onSelectHash={onSelectHash}
                />
              );
            }
            const row = (
              <Commit
                key={c.id}
                commit={c}
                locale={locale}
                variant="timeline"
                hideDate={tag.hideDate || c.hideDate}
                rail={railInfo[item.i].rail}
                segmentId={railInfo[item.i].segmentId}
                isSegmentActive={
                  railInfo[item.i].segmentId !== null &&
                  railInfo[item.i].segmentId === activeBeam?.roleId
                }
                beamSpec={beamSpecs[item.i]}
                onBeamSet={handleBeamSet}
                onBeamClear={handleBeamClear}
                byline={bylines[item.i]}
                form={form}
                onSelectHash={onSelectHash}
                refs={era.decorations
                  ?.get(c.id)
                  ?.map((t) => chapterLabel(t, -1, locale))}
              />
            );
            return graph ? (
              <LaneRow
                key={c.id}
                cell={graph[pos]}
                nodeY={isQuietRow(c) ? 12 : 20}
                tags={lanes!.tags}
              >
                {row}
              </LaneRow>
            ) : (
              row
            );
          };
          let pos = 0;
          return runs.map((run) => {
            const rows = run.items.map((item) => renderItem(item, pos++));
            const first = run.items.find((it) => it.kind !== "branch") as
              | { i: number }
              | undefined;
            const key = first ? commits[first.i].id : `r${pos}`;
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
        {/* Persistent back-point connectors — one per explicit
         *  attachedTo. They run through the icon column (same visual
         *  vocabulary as the tenure rail), dimmed by default and
         *  brightened when EITHER endpoint is the activeBeam. */}
        {attachments.map((a) => (
          <TimelineConnector
            key={`${a.fromHash}->${a.toHash}`}
            fromHash={a.fromHash}
            toHash={a.toHash}
            fromGap={a.fromGap}
            toGap={a.toGap}
            // Inferred beams piggyback on the visible tenure rail —
            // suppress their dim render so N converging connectors
            // don't darken the line via opacity stacking.
            hideWhenIdle={a.inferred}
            isActive={
              !!activeBeam &&
              activeBeam.toHash === a.toHash &&
              // Exact source match always activates. Target hover
              // (fromHash null) activates ONLY explicit attachedTo
              // connectors — for inferred beams the role-hover
              // brightens the rail directly via CSS so we don't
              // paint a long overlapping line through icons.
              (activeBeam.fromHash === a.fromHash ||
                (activeBeam.fromHash === null && !a.inferred))
            }
          />
        ))}
      </div>
    </div>
  );

  /** Whether the tenure rail runs through row `i` — it sits between two
   *  rows of one cluster — so a row that is off the rail can draw it on. */
  function railThrough(i: number): boolean {
    let above = i - 1;
    while (above >= 0 && !railInfo[above].rail) above--;
    let below = i + 1;
    while (below < commits.length && !railInfo[below].rail) below++;
    if (above < 0 || below >= commits.length) return false;
    return (
      railInfo[above].segmentId === railInfo[below].segmentId &&
      railInfo[above].rail !== "┘" &&
      railInfo[below].rail !== "┐"
    );
  }
}

// =============================================================================
// Overlapping chapters (see lib/log-eras.ts)
// =============================================================================

/** Where lane `lane` of `count` hangs in the left margin, outermost first:
 *  in the page gutter on a phone, left of the hash column from `lg` up. */
function laneStyle(lane: number, count: number): CSSProperties {
  const k = count - lane;
  return {
    "--lx": `${-(k * 6) - 2}px`,
    "--lx-lg": `calc(-6.5rem - ${k * 10}px)`,
  } as CSSProperties;
}
const LANE_X = "absolute left-(--lx) lg:left-(--lx-lg) -translate-x-1/2";

function laneColor(tag: Tag): string {
  return tag.accentColor ?? "var(--muted-foreground)";
}

/** The chapter's colour, on its marker — which lane or bar is whose. */
function LaneDot({ tag }: { tag: Tag }) {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block size-1.5 shrink-0 rounded-full"
      style={{ background: laneColor(tag) }}
    />
  );
}

/** venn: a bar per chapter this block belongs to, running on into the
 *  next block where that one shares the chapter — the bars overlap exactly
 *  where the chapters do. */
function EraBars({ lanes, gapAbove }: { lanes: EraLanes; gapAbove: boolean }) {
  const count = lanes.tags.length;
  return (
    <>
      {lanes.of.map((l) => {
        const above = lanes.above.includes(l);
        const below = lanes.below.includes(l);
        return (
          <span
            key={l}
            aria-hidden
            className={cn(LANE_X, "pointer-events-none w-[2px] rounded-full opacity-60")}
            style={{
              ...laneStyle(l, count),
              background: laneColor(lanes.tags[l]),
              // Bridge the gap above (the next header's margin) when the
              // chapter runs on; otherwise start at this block's marker.
              top: above ? "-1.5rem" : gapAbove ? "2.25rem" : "0.75rem",
              bottom: below ? 0 : "0.75rem",
            }}
          />
        );
      })}
    </>
  );
}

interface LaneState {
  above: boolean;
  below: boolean;
  node: "dot" | "ring" | null;
}
interface LaneCellData {
  count: number;
  lanes: LaneState[];
  /** A commit on several lanes: the span its node joins. */
  bridge?: [number, number];
}

/** lanes: each printed item's slice of the graph. A lane runs from its
 *  marker (the block's own for lane 0, the branch marker for the rest) to
 *  its last commit. */
function laneGraph(
  items: ({ kind: "row" | "pick"; i: number } | { kind: "branch"; lane: number })[],
  commits: CommitData[],
  laneOf: ReadonlyMap<string, number[]>,
  lanes: EraLanes,
): LaneCellData[] {
  const count = lanes.tags.length;
  const on = (pos: number) => {
    const it = items[pos];
    return it.kind === "branch" ? [] : (laneOf.get(commits[it.i].id) ?? []);
  };
  const start = Array.from({ length: count }, (_, l) =>
    l === 0 ? -1 : items.findIndex((it) => it.kind === "branch" && it.lane === l),
  );
  const end = Array.from({ length: count }, (_, l) => {
    let last = -2;
    items.forEach((_, p) => {
      if (on(p).includes(l)) last = p;
    });
    return last;
  });
  return items.map((it, p) => {
    const here = on(p);
    return {
      count,
      lanes: Array.from({ length: count }, (_, l) => {
        const live = start[l] !== -2 && end[l] >= 0;
        return {
          above: live && p > start[l] && p <= end[l],
          below: live && p >= start[l] && p < end[l],
          node:
            it.kind === "branch" && it.lane === l
              ? "ring"
              : here.includes(l)
                ? "dot"
                : null,
        };
      }),
      bridge:
        here.length > 1 ? [Math.min(...here), Math.max(...here)] : undefined,
    };
  });
}

function LaneRow({
  cell,
  nodeY,
  tags,
  children,
}: {
  cell: LaneCellData;
  nodeY: number;
  tags: Tag[];
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <LaneCell cell={cell} nodeY={nodeY} tags={tags} />
    </div>
  );
}

function LaneCell({
  cell,
  nodeY,
  tags,
}: {
  cell: LaneCellData;
  nodeY: number;
  tags: Tag[];
}) {
  const { count } = cell;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {cell.bridge && (
        <span
          className="absolute h-[1.5px] -translate-y-1/2 left-(--lx) lg:left-(--lx-lg) w-(--w) lg:w-(--w-lg) bg-muted-foreground/40"
          style={
            {
              ...laneStyle(cell.bridge[0], count),
              top: nodeY,
              "--w": `${(cell.bridge[1] - cell.bridge[0]) * 6}px`,
              "--w-lg": `${(cell.bridge[1] - cell.bridge[0]) * 10}px`,
            } as CSSProperties
          }
        />
      )}
      {cell.lanes.map((lane, l) => {
        const color = laneColor(tags[l]);
        const style = laneStyle(l, count);
        return (
          <span key={l}>
            {lane.above && (
              <span
                className={cn(LANE_X, "w-[1.5px] opacity-60")}
                style={{ ...style, top: 0, height: nodeY, background: color }}
              />
            )}
            {lane.below && (
              <span
                className={cn(LANE_X, "w-[1.5px] opacity-60")}
                style={{ ...style, top: nodeY, bottom: 0, background: color }}
              />
            )}
            {lane.node && (
              <span
                className={cn(
                  LANE_X,
                  "-translate-y-1/2 rounded-full",
                  lane.node === "dot" ? "size-[7px]" : "size-[9px] border-[1.5px] bg-background",
                )}
                style={{
                  ...style,
                  top: nodeY,
                  ...(lane.node === "dot"
                    ? { background: color }
                    : { borderColor: color }),
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Rows in the quiet voice (events, folded asides) centre their node on a
 *  shorter line. */
function isQuietRow(c: CommitData): boolean {
  return c.type === "event" || c.present === "aside";
}

/**
 * picks: a shared commit, in the chapter that isn't its home — one quiet
 * line, `git cherry-pick` style, naming where it lives and travelling there.
 */
function PickRow({
  commit,
  home,
  locale,
  railThrough,
  onSelectHash,
}: {
  commit: CommitData;
  home?: Tag;
  locale: Locale;
  railThrough: boolean;
  onSelectHash?: (hash: string) => void;
}) {
  const hash = computeCommitHash(commit.id);
  const go = () => onSelectHash?.(hash);
  return (
    <div
      className={cn(
        "group relative -mx-3 px-3 py-1 rounded-lg @container [clip-path:inset(0_-100vw)]",
        GUTTER_PULL,
        onSelectHash && "cursor-pointer hover:bg-muted/20",
      )}
      onClick={go}
    >
      <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
        <span
          className={cn("hidden @sm:inline-block leading-4", HASH_CELL, TYPE.hash)}
        >
          {hash}
        </span>
        <span className="relative inline-flex items-center justify-center w-5 h-4">
          {railThrough && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-muted-foreground/10"
              style={{ top: "-1000px", bottom: "-1000px" }}
            />
          )}
          <CornerDownRight
            aria-hidden
            className="relative w-3 h-3 text-quaternary-foreground"
          />
        </span>
        <span className="flex items-center gap-2 min-w-0">
          <QuietLine
            text={getLocalizedCommitTitle(commit, locale)}
            className="min-w-0 truncate text-xs text-tertiary-foreground"
          />
          {home && (
            <span className={cn(REF_CHIP, "shrink-0")}>
              {chapterLabel(home, -1, locale)}
            </span>
          )}
          <span className={cn("shrink-0 ml-auto", TYPE.rowMeta)}>
            {formatCommitDate(commit, locale)}
          </span>
        </span>
      </div>
    </div>
  );
}
