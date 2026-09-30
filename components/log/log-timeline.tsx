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
import { TimelineConnector } from "./timeline-connector";
import { type BeamSpec, GUTTER_PULL, HASH_CELL } from "./timeline-commit";
import { RefInCell, type RowGraph } from "./timeline-lane";
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
  }, [commits, identities, locale, activeTypes]);

  // A chapter with nothing left in it prints nothing — no ref marker hanging
  // over an empty stretch of page. The era headers are the timeline's spine,
  // but a spine with no vertebrae is just a line.
  if (!hasVisible) return null;

  const { items, graphs } = chapterGraph(commits, isHidden, laneOf);

  return (
    <div>
      {/* Tag ref marker — like `git log --decorate` ref annotations */}
      <div
        className={cn(
          "flex items-center gap-3 py-2",
          pinned ? "relative" : "sticky top-4 z-20",
          tagIndex > 0 && "mt-6 pt-6 border-t border-border/30",
        )}
      >
        {/* The chapter's trunk starts at its ref. */}
        <RefGraphLayer y={(tagIndex > 0 ? 24 : 0) + 19} first />
        {inspecting && edit ? (
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
            // The trunk already runs through the icon column, so at rest
            // every connector is it — a second translucent line laid over
            // it would read as a darker stretch. They only light.
            hideWhenIdle
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
): { items: Item[]; graphs: (RowGraph | undefined)[] } {
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
  let trunk = 0;
  let side: number | null = null;
  items.forEach((it, p) => {
    if (it.kind === "ref") {
      if (lastOf(trunk) > p && side === null) {
        if (own(trunk, it.lane, p) > own(it.lane, trunk, p)) {
          it.mode = "fork";
          side = it.lane;
          return;
        }
        it.mode = "take";
        side = trunk;
      }
      trunk = it.lane;
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
  return { items, graphs };
}

/** Where a ref's line sits: the same grid as a row, laid over the marker, so
 *  its icon cell is exactly on the trunk. */
function RefGraphLayer({
  y,
  mode,
  first,
}: {
  y: number;
  mode?: RefMode;
  first?: boolean;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className={cn(
          "h-full -mx-3 px-3 @container [clip-path:inset(0_-100vw)]",
          GUTTER_PULL,
        )}
      >
        <div className="grid h-full grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2">
          <span
            className={cn(
              "hidden @sm:inline-block select-none",
              HASH_CELL,
              TYPE.hash,
              "text-transparent",
            )}
          >
            0000000
          </span>
          <span className="relative w-5">
            <RefInCell y={y} mode={mode} first={first} />
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
}: {
  tag: Tag;
  locale: Locale;
  mode: RefMode;
  pinned: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3 pt-8 pb-2">
      <RefGraphLayer y={32 + 11} mode={mode} />
      <span
        data-chapter={pinned ? tag.id : undefined}
        className={cn(CHAPTER_PILL, "relative border-border")}
      >
        {chapterLabel(tag, -1, locale)}
      </span>
      {!tag.hideDate && (
        <span className="font-mono text-xs text-tertiary-foreground">
          {formatTagDateRange(tag, locale)}
        </span>
      )}
    </div>
  );
}
