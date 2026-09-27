"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  adjustRailForHidden,
  computeBeams,
  computeInferredBeams,
  computeCommitHash,
  computeRail,
  type FilterableCommitType,
  formatTagDateRange,
  getLocalizedTagTitle,
  localize,
  type Identity,
  isRowVisible,
  type Tag,
} from "@/lib/log";
import {
  buildThreads,
  editionCountLabel,
  editionLine,
  evidenceCountLabel,
  evidenceLine,
  monthOf,
  threadPath,
  type CommitThreads,
} from "@/lib/log-threads";
import { layoutGraph } from "@/lib/log-graph";
import { DEFAULT_FORM, type LogForm } from "@/lib/log-view";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeBylines } from "./bylines";
import { Commit } from "./commit-embed";
import { GraphLanes, type GraphRow } from "./graph-lanes";
import { TimelineConnector } from "./timeline-connector";
import type { BeamSpec } from "./timeline-commit";
import { useTimelineEdit } from "./timeline-edit-context";
import { registerCommitRevealer } from "./use-commit-anchor";

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

interface LogTimelineProps {
  data: {
    tag: Tag;
    commits: CommitData[];
  }[];
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
   * `git log --graph`: projects as lanes beside the main line
   * (lib/log-graph.ts). Every commit gets its own row at its own date, on
   * its project's lane; nothing is nested or folded into a pointer.
   */
  graph?: boolean;
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
  graph = false,
  activeTypes = NO_TYPES,
  onSelectHash,
  pinnedChapters = false,
}: LogTimelineProps) {
  // Threads are resolved over the whole log, not per chapter: a parent and
  // its child can sit on either side of a chapter marker (React Compiler in
  // 2021 and a talk about it in 2022), and the line at the child's date
  // still has to know where to send you.
  const threads = useMemo(() => {
    const all = data.flatMap((d) => d.commits);
    const t = buildThreads(all, (c) => isRowVisible(c, activeTypes));
    const order = new Map(all.map((c, i) => [c.id, i]));
    const byId = new Map(all.map((c) => [c.id, c]));
    return { ...t, order, byId };
  }, [data, activeTypes]);

  // The graph's width is the page's, not each chapter's: the main line sits
  // in the same column all the way down, whatever each chapter branches.
  const graphCols = useMemo(
    () =>
      graph
        ? Math.max(
            1,
            ...data.map(
              ({ commits }) =>
                layoutGraph(commits, (c) => !isRowVisible(c, activeTypes)).cols,
            ),
          )
        : 1,
    [graph, data, activeTypes],
  );

  // The last row asked for, with every row it sits inside, and a counter so
  // asking for the same one twice still opens it (it may have been closed).
  const [reveal, setReveal] = useState<Reveal | null>(null);

  // Synchronous on purpose: the caller measures the row it asked for on
  // the very next line, so it has to be in the DOM when this returns.
  const revealCommit = useCallback(
    (id: string) => {
      if (graph || !threads.parentOf.has(id)) return false;
      const path = threadPath(threads, id);
      flushSync(() => setReveal((r) => ({ path, n: (r?.n ?? 0) + 1 })));
      return true;
    },
    [threads, graph],
  );

  // `/works#<hash>` of a nested commit lands inside its parent, opened.
  useEffect(
    () =>
      registerCommitRevealer((hash) => {
        const id = threads.byHash.get(hash);
        return id ? revealCommit(id) : false;
      }),
    [threads, revealCommit],
  );

  return (
    <div className="space-y-0">
      {data.map(({ tag, commits }, tagIndex) => (
        <TagBlock
          key={tag.id}
          tag={tag}
          commits={commits}
          tagIndex={tagIndex}
          locale={locale}
          identities={identities}
          form={form}
          activeTypes={activeTypes}
          onSelectHash={onSelectHash}
          pinned={pinnedChapters}
          threads={threads}
          reveal={reveal}
          onReveal={revealCommit}
          graph={graph}
          graphCols={graphCols}
        />
      ))}
    </div>
  );
}

interface TagBlockProps {
  tag: Tag;
  commits: CommitData[];
  tagIndex: number;
  locale: Locale;
  identities?: Record<string, Identity>;
  form: LogForm;
  activeTypes: FilterableCommitType[];
  onSelectHash?: (hash: string) => void;
  pinned: boolean;
  threads: CommitThreads & {
    order: Map<string, number>;
    byId: Map<string, CommitData>;
  };
  reveal: Reveal | null;
  onReveal: (id: string) => boolean;
  graph: boolean;
  graphCols: number;
}

interface Reveal {
  /** The row on the main timeline, down to the one asked for. All open. */
  path: string[];
  n: number;
}

function TagBlock({
  tag,
  commits,
  tagIndex,
  locale,
  identities,
  form,
  activeTypes,
  onSelectHash,
  pinned,
  threads,
  reveal,
  onReveal,
  graph,
  graphCols,
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

  // The graph: which lane each row's mark sits in, and the lanes to draw.
  const commitsRef = useRef<HTMLDivElement>(null);
  const [activeLane, setActiveLane] = useState<string | null>(null);
  const graphLayout = useMemo(() => {
    if (!graph) return null;
    const layout = layoutGraph(commits, isHidden);
    const rows: GraphRow[] = [];
    commits.forEach((c, index) => {
      if (isHidden(c)) return;
      rows.push({
        index,
        hash: computeCommitHash(c.id),
        col: layout.colOf.get(c.id) ?? 0,
      });
    });
    const laneAt = (index: number, col: number) =>
      layout.lanes.find(
        (l) => l.col === col && l.top <= index && index <= l.bottom,
      )?.id ?? null;
    const names = new Map(
      layout.lanes.map((l) => {
        const project = commits.find((c) => c.id === l.id);
        return [l.id, project ? localize(project.title, locale) : l.id];
      }),
    );
    return { ...layout, rows, laneAt, names };
  }, [graph, commits, isHidden, locale]);

  const openFor = (id: string) =>
    reveal && reveal.path.includes(id) ? reveal.n : 0;

  /**
   * A row with whatever it holds nested under it: a project's work, a
   * talk's editions, the editions of that work. Each level keeps its own
   * gutter; a thin line hangs from the top of each list to its last row.
   *
   * The work under a project prints as the index does, because a release
   * is a list of what was shown; the feed prints everything, so there it
   * follows the feed. Editions are the same work again, so they fold to
   * one line each, like an aside.
   */
  const nest = (
    c: CommitData,
    props: Partial<React.ComponentProps<typeof Commit>>,
  ): React.ReactNode => {
    const editions = threads.editionsOf.get(c.id);
    const evidence = threads.evidenceOf.get(c.id);
    const labels = [
      // Counted with their editions: a talk given three times is three
      // talks, even though it takes one row here.
      evidence &&
        evidenceCountLabel(
          evidence.flatMap((e) => [e, ...(threads.editionsOf.get(e.id) ?? [])]),
          locale,
        ),
      editions && editionCountLabel(editions.length, locale),
    ].filter(Boolean);
    const child = (
      e: CommitData,
      k: number,
      list: CommitData[],
      extra: Partial<React.ComponentProps<typeof Commit>>,
    ) =>
      nest(
        e,
        {
          locale,
          variant: "timeline",
          nested: true,
          hideDate: tag.hideDate || e.hideDate,
          rail: k === list.length - 1 ? "┘" : "│",
          onSelectHash,
          ...extra,
        },
      );

    return (
      <Commit
        key={c.id}
        commit={c}
        form={form}
        {...props}
        childrenLabel={labels.length ? labels.join(" · ") : undefined}
        reveal={openFor(c.id)}
        evidence={evidence?.map((e, k, list) =>
          child(e, k, list, { form: form === "feed" ? "feed" : "index" }),
        )}
      >
        {editions?.map((e, k, list) =>
          child(e, k, list, { form, foldedLine: editionLine(e, locale) }),
        )}
      </Commit>
    );
  };

  // A chapter with nothing left in it prints nothing — no ref marker hanging
  // over an empty stretch of page. The era headers are the timeline's spine,
  // but a spine with no vertebrae is just a line.
  if (!hasVisible) return null;

  return (
    <div>
      {/* Tag ref marker — like `git log --decorate` ref annotations */}
      <div
        className={cn(
          "flex items-center gap-3 py-2",
          !pinned && "sticky top-4 z-20",
          tagIndex > 0 && "mt-6 pt-6 border-t border-border/30",
        )}
      >
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
        ) : (
          // `data-chapter` is what the pinned bar watches: the moment this
          // pill reaches the bar's ref slot, the slot wears it.
          <span
            data-chapter={pinned ? tag.id : undefined}
            className={cn(CHAPTER_PILL, "border-border")}
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
      <div ref={commitsRef} className="relative space-y-0">
        {(() => {
          // Hidden-role rows (roles with `hideRow: true`) are kept in the
          // commits array so `computeRail` and `resolveAuthor` can use
          // their tenure windows / handles, but they don't render here —
          // the cluster they anchor speaks for the tenure via the rail +
          // author bylines.
          type Run =
            | { kind: "loose"; indices: number[] }
            | { kind: "cluster"; segmentId: string; indices: number[] };
          const runs: Run[] = [];
          for (let i = 0; i < commits.length; i++) {
            const c = commits[i];
            if (isHidden(c)) continue;
            const sid = railInfo[i].segmentId;
            const last = runs[runs.length - 1];
            if (sid && last && last.kind === "cluster" && last.segmentId === sid) {
              last.indices.push(i);
            } else if (sid) {
              runs.push({ kind: "cluster", segmentId: sid, indices: [i] });
            } else if (last && last.kind === "loose") {
              last.indices.push(i);
            } else {
              runs.push({ kind: "loose", indices: [i] });
            }
          }
          return runs.map((run, runIdx) => {
            const rows = run.indices.map((i) => {
              const c = commits[i];
              const shared = {
                commit: c,
                locale,
                variant: "timeline" as const,
                hideDate: tag.hideDate || c.hideDate,
                rail: railInfo[i].rail,
                segmentId: railInfo[i].segmentId,
                isSegmentActive:
                  railInfo[i].segmentId !== null &&
                  railInfo[i].segmentId === activeBeam?.roleId,
                beamSpec: beamSpecs[i],
                onBeamSet: handleBeamSet,
                onBeamClear: handleBeamClear,
                byline: bylines[i],
                form,
                onSelectHash,
              };

              // The graph: every commit is its own row, on its lane. An
              // edition keeps its quiet line, sitting on its original's lane.
              if (graphLayout) {
                const col = graphLayout.colOf.get(c.id) ?? 0;
                const lane = graphLayout.laneAt(i, col);
                return (
                  <div
                    key={c.id}
                    onPointerEnter={() => setActiveLane(lane)}
                    onPointerLeave={() =>
                      setActiveLane((a) => (a === lane ? null : a))
                    }
                  >
                    <Commit
                      {...shared}
                      rail=""
                      beamSpec={null}
                      foldedLine={
                        c.editionOf ? editionLine(c, locale) : undefined
                      }
                      graph={{ col, cols: graphCols }}
                    />
                  </div>
                );
              }

              // A commit printed inside another one, at its own date: one
              // quiet line that takes you there. Not when its row is right
              // here anyway: a talk in the same month as the release it
              // belongs to sits next to it already.
              const parent = threads.parentOf.get(c.id);
              if (parent) {
                const path = threadPath(threads, c.id);
                const top = threads.byId.get(path[0]);
                if (top && monthOf(top) === monthOf(c)) return null;
                const down =
                  (threads.order.get(path[0]) ?? 0) >
                  (threads.order.get(c.id) ?? 0);
                return (
                  <Commit
                    key={c.id}
                    {...shared}
                    foldedLine={
                      parent.relation === "edition"
                        ? editionLine(c, locale)
                        : evidenceLine(c, locale)
                    }
                    pointer={down ? "down" : "up"}
                    anchorId={null}
                    onPress={() => {
                      if (!onReveal(c.id)) return;
                      onSelectHash?.(computeCommitHash(c.id));
                    }}
                  />
                );
              }

              return nest(c, shared);
            });
            return run.kind === "cluster" ? (
              // An identity can cluster twice (Meta, then RIT, then Meta
              // again), so the run is named by its first row, not its id.
              <div key={`cluster-${commits[run.indices[0]].id}`} className="group/tenure">
                {rows}
              </div>
            ) : (
              <div key={`loose-${runIdx}`}>{rows}</div>
            );
          });
        })()}
        {/* Persistent back-point connectors — one per explicit
         *  attachedTo. They run through the icon column (same visual
         *  vocabulary as the tenure rail), dimmed by default and
         *  brightened when EITHER endpoint is the activeBeam. */}
        {graphLayout && (
          <GraphLanes
            containerRef={commitsRef}
            rows={graphLayout.rows}
            lanes={graphLayout.lanes}
            names={graphLayout.names}
            activeLane={activeLane}
          />
        )}
        {!graphLayout && attachments.map((a) => (
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
}
