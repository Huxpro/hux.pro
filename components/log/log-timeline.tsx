"use client";

import {
  Fragment,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pageScrollTop, scrollPageTo } from "vitre";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  adjustRailForHidden,
  computeBeams,
  computeCommitHash,
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
import {
  type BeamSpec,
  GUTTER_PULL,
  HASH_CELL,
  type HandleLook,
} from "./timeline-commit";
import {
  GraphInCell,
  RefInCell,
  type RefLook,
  type RefLit,
  type RowGraph,
  type RowLit,
} from "./timeline-lane";
import { useTimelineEdit } from "./timeline-edit-context";
import type { WorksAuthor, WorksRef } from "@/systems/devtool";
import type { Byline } from "./bylines";

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
  /** Where a folded commit's author is printed (see `WorksAuthor`). The
   *  default is the handle on the meta line every other log uses. */
  authorLook?: WorksAuthor;
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
  authorLook = "line",
}: LogTimelineProps) {
  // The chapter whose track is held (its marker has focus) — page-wide, so
  // every commit outside it steps back, in its own block or another.
  const [held, setHeld] = useState<Held | null>(null);
  // Holding a chapter folds every commit outside it, and letting go
  // unfolds them: the page above the marker grows or shrinks at once. The
  // marker that was pressed stays where it was under the pointer.
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
  const hold = useCallback(
    (next: SetStateAction<Held | null>, marker: HTMLElement) => {
      anchor.current = { el: marker, top: marker.getBoundingClientRect().top };
      setHeld(next);
    },
    [],
  );
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a || !a.el.isConnected) return;
    const drift = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(drift) > 1) scrollPageTo(pageScrollTop() + drift);
  }, [held]);
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
          authorLook={authorLook}
          held={held}
          onHold={hold}
        />
      ))}
    </div>
  );
}

/** What is held: a chapter's track — the block it is drawn in, and its
 *  lane there — or an author, `git log --author`, by identity. */
type Held = { block: string; lane: number } | { author: string };

interface TagBlockProps {
  held: Held | null;
  onHold: (next: SetStateAction<Held | null>, marker: HTMLElement) => void;
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
  authorLook: WorksAuthor;
}

function TagBlock({
  held,
  onHold,
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
  authorLook,
}: TagBlockProps) {
  const edit = useTimelineEdit();
  const inspecting = edit?.mode === "inspect";
  const tagLabel = chapterLabel(tag, tagIndex, locale);
  const [activeBeam, setActiveBeam] = useState<BeamSpec | null>(null);
  // A chapter's whole track, lit from its marker: while the marker is under
  // a pointer (`trackHover`), and held while it has focus (`trackPin`) — a
  // click or a tap focuses it, and clicking anywhere else, or Escape, lets go.
  const [trackHover, setTrackHover] = useState<number | null>(null);
  const trackPin =
    held && "block" in held && held.block === tag.id ? held.lane : null;
  // The row engaging its tenure right now, by hash (see `onTenureEngage`).
  const [engaged, setEngaged] = useState<string | null>(null);
  const handleTenureEngage = useCallback(
    (hash: string, on: boolean) =>
      setEngaged((current) => (on ? hash : current === hash ? null : current)),
    [],
  );
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
    graph,
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
      graph: chapterGraph(commits, hidden, laneOf),
      hasVisible: commits.some((c) => !hidden(c)),
    };
  }, [commits, identities, locale, activeTypes, laneOf]);

  // The tenure an engaged row belongs to: its identity's rows on the rail
  // (`segmentId`), first to last as item positions — a bracket other rows
  // can sit inside, the way RIT's runs from WasmCert to the M.S. around the
  // Meta internships. Any of its rows lights it, not only its role: most
  // roles print no row (`hideRow`), and a tenure without one would
  // otherwise never light at all.
  const tenure = useMemo(() => {
    const i = engaged
      ? commits.findIndex((c) => computeCommitHash(c.id) === engaged)
      : -1;
    const sid = railInfo[i]?.segmentId;
    if (!sid) return null;
    const at = graph.items.flatMap((it, p) =>
      it.kind === "row" && railInfo[it.i].segmentId === sid ? [p] : [],
    );
    return { sid, from: at[0], to: at[at.length - 1] };
  }, [engaged, commits, graph, railInfo]);

  // The lines lit right now: a held or pointed-at chapter's whole track; an
  // engaged row's tenure; and the connectors between a commit and the
  // role it hangs from — all drawn along the graph's own lines rather than
  // straight down the icon column (see `litPath`).
  const lit = useMemo(() => {
    const lit: Lit = { rows: new Map(), refs: new Map() };
    for (const lane of new Set([trackHover, trackPin])) {
      if (lane !== null) litTrack(graph, lane, lit);
    }
    if (tenure && tenure.from < tenure.to) {
      litPath(graph, tenure.from, tenure.to, lit);
    }
    if (!activeBeam) return lit;
    for (const a of attachments) {
      const active =
        activeBeam.toHash === a.toHash &&
        (activeBeam.fromHash === a.fromHash ||
          (activeBeam.fromHash === null && !a.inferred));
      const from = graph.posOf.get(a.fromIdx);
      const to = graph.posOf.get(a.toIdx);
      if (active && from !== undefined && to !== undefined) {
        litPath(graph, from, to, lit);
      }
    }
    return lit;
  }, [graph, attachments, trackHover, trackPin, tenure, activeBeam]);

  // A chapter with nothing left in it prints nothing — no ref marker hanging
  // over an empty stretch of page. The era headers are the timeline's spine,
  // but a spine with no vertebrae is just a line.
  if (!hasVisible) return null;

  const { items, graphs } = graph;
  /** Whether a lane's things step back: another chapter's track is held,
   *  here or in another block — or an author, which no chapter is. */
  const stepsBack = (lanes: number[]) =>
    held !== null &&
    !("block" in held && held.block === tag.id && lanes.includes(held.lane));
  /** Whether a commit steps back: it is off the held track, or by another
   *  author than the one held. */
  const rowBack = (i: number) =>
    held !== null && "author" in held
      ? bylines[i]?.identityId !== held.author
      : stepsBack(laneOf?.get(commits[i].id) ?? [0]);
  /** A commit outside the held track steps down one form: covers and the
   *  feed to the index's one line (the index view's own row), the index to
   *  an aside's quiet line. */
  const stepDown = (back: boolean): { form: LogForm; quiet?: boolean } =>
    !back ? { form } : form === "index" ? { form, quiet: true } : { form: "index" };
  /** A marker's hold on its chapter's track (see `trackHover`). */
  const trackFor = (lane: number): TrackControl => ({
    lit: trackHover === lane || trackPin === lane,
    pinned: trackPin === lane,
    bind: {
      onPointerEnter: (e) => {
        if (e.pointerType !== "touch") setTrackHover(lane);
      },
      onPointerLeave: () => setTrackHover((h) => (h === lane ? null : h)),
      onFocus: (e) => onHold({ block: tag.id, lane }, e.currentTarget),
      onBlur: (e) =>
        onHold(
          (h) =>
            h && "block" in h && h.block === tag.id && h.lane === lane ? null : h,
          e.currentTarget,
        ),
      onKeyDown: (e) => {
        if (e.key === "Escape") e.currentTarget.blur();
      },
      // Safari does not focus a button it is clicking.
      onClick: (e) => e.currentTarget.focus(),
    },
  });
  /** An author marker's hold on its author — the same gesture as a
   *  chapter's marker: a click or a tap holds it, focus moving on lets go. */
  const authorFor = (id: string): TrackControl => {
    const pinned = !!held && "author" in held && held.author === id;
    return {
      lit: pinned,
      pinned,
      bind: {
        onPointerEnter: () => {},
        onPointerLeave: () => {},
        onFocus: (e) => onHold({ author: id }, e.currentTarget),
        onBlur: (e) =>
          onHold(
            (h) => (h && "author" in h && h.author === id ? null : h),
            e.currentTarget,
          ),
        onKeyDown: (e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        },
        onClick: (e) => e.currentTarget.focus(),
      },
    };
  };
  /** In the editor's inspect mode a chapter's marker selects the chapter,
   *  and adds an entry to it. */
  const inspectControls = (t: Tag, label: string) =>
    inspecting &&
    edit && (
      <>
        <button
          type="button"
          onClick={() => edit.onSelectTag(t.id)}
          className={cn(
            CHAPTER_PILL,
            "relative transition-colors",
            edit.editingTagId === t.id
              ? "border-sky-500/70 ring-1 ring-inset ring-sky-500/35 bg-sky-500/[0.05]"
              : "border-border hover:border-sky-500/50",
          )}
          title="Inspect chapter"
        >
          {label}
        </button>
        {!t.hideDate && <TagDate tag={t} locale={locale} />}
        <button
          type="button"
          onClick={() => edit.onAddCommit(t.id)}
          className="inline-flex items-center justify-center text-tertiary-foreground hover:text-foreground transition-colors"
          title="Add entry"
          aria-label="Add entry"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </>
    );

  return (
    <div>
      {/* Tag ref marker — like `git log --decorate` ref annotations */}
      <RefRow
        className={cn(
          "pb-2",
          !pinned && "sticky top-4 z-20",
          tagIndex > 0 ? "mt-6 pt-6 border-t border-border/30" : "pt-2",
        )}
        // The marker's centre: below the rule once there is a chapter
        // above, and the marker's own half-height.
        y={(tagIndex > 0 ? 25 : 8) + 11}
        first
        tag={tag}
        label={tagLabel}
        locale={locale}
        pinned={pinned}
        look={inspecting ? "stub" : refLook}
        lit={lit.refs.get(0)}
        track={trackFor(0)}
        dimmed={stepsBack([0])}
      >
        {inspectControls(tag, tagLabel)}
      </RefRow>

      {/* Hidden-role rows (roles with `hideRow: true`) are kept in the
          commits array so `computeRail` and `resolveAuthor` can use their
          tenure windows / handles, but they don't render here — the
          tenure they anchor speaks through the rail and the bylines. */}
      <div className="relative">
        {items.map((item) => {
          if (item.kind === "ref") {
            const ref = members![item.lane];
            const label = chapterLabel(ref, -1, locale);
            return (
              <RefRow
                key={`ref-${ref.id}`}
                className="pt-8 pb-2"
                y={32 + 11}
                tag={ref}
                label={label}
                locale={locale}
                mode={item.mode}
                pinned={pinned}
                look={inspecting ? "stub" : refLook}
                lit={lit.refs.get(item.lane)}
                track={trackFor(item.lane)}
                dimmed={stepsBack([item.lane])}
              >
                {inspectControls(ref, label)}
              </RefRow>
            );
          }
          const i = item.i;
          const byline = bylines[i];
          const row = (
            <Commit
              key={commits[i].id}
              commit={commits[i]}
              locale={locale}
              variant="timeline"
              hideDate={tag.hideDate || commits[i].hideDate}
              rail={railInfo[i].rail}
              graph={graphs[i]}
              graphLit={lit.rows.get(i)}
              {...stepDown(rowBack(i))}
              tenureLit={railInfo[i].segmentId === tenure?.sid}
              onTenureEngage={handleTenureEngage}
              beamSpec={beamSpecs[i]}
              onBeamSet={handleBeamSet}
              onBeamClear={handleBeamClear}
              byline={byline}
              handleLook={HANDLE_LOOK[authorLook]}
              onSelectHash={onSelectHash}
            />
          );
          // `marker`: the head of a same-author run gets a marker above it.
          if (authorLook !== "marker" || !byline?.isClusterHead) return row;
          return (
            <Fragment key={commits[i].id}>
              <AuthorRow
                byline={byline}
                below={graphs[i]}
                lit={lit.rows.get(i)}
                dimmed={rowBack(i)}
                control={authorFor(byline.identityId)}
              />
              {row}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** Which rows print their handle at rest, under each author look. */
const HANDLE_LOOK: Record<WorksAuthor, HandleLook> = {
  line: "line",
  marker: "hover",
  bar: "line",
  every: "every",
};

/**
 * `marker`: the head of a same-author run — the tenure it was made under —
 * as a ref heads a chapter. The handle hangs in the hash slot on a desk,
 * where a chapter's marker hangs; on a phone, with no hash slot, it leads a
 * quiet line of its own. The role and its company follow, where a commit's
 * meta goes. The graph runs straight through: whatever reaches the row
 * below from above it.
 */
function AuthorRow({
  byline,
  below,
  lit,
  dimmed,
  control,
}: {
  byline: Byline;
  below?: RowGraph;
  lit?: RowLit;
  dimmed: boolean;
  control: TrackControl;
}) {
  const role = [byline.expanded.title, byline.expanded.company]
    .filter(Boolean)
    .join(" @ ");
  const side = !!below && (!!below.side || !!below.enter);
  const through: RowGraph = {
    trunkAbove: !!below?.trunkAbove,
    trunkBelow: !!below?.trunkAbove,
    side: side ? "pass" : undefined,
  };
  return (
    <div
      className={cn(
        "-mx-3 px-3 pt-3 pb-0.5 [clip-path:inset(0_-100vw)] transition-opacity duration-300",
        GUTTER_PULL,
        dimmed && "opacity-40",
      )}
    >
      {/* The whole line is the control — on a phone, a tap target the
          width of the page, which no handle tucked under a date is. */}
      <button
        type="button"
        aria-pressed={control.pinned}
        title={byline.handle}
        className="grid w-full cursor-pointer grid-cols-[auto_1fr] lg:grid-cols-[auto_auto_1fr] gap-x-2 items-center text-left outline-none"
        {...control.bind}
      >
        <span
          className={cn(
            "hidden lg:flex justify-end whitespace-nowrap transition-colors duration-200",
            HASH_CELL,
            TYPE.rowMeta,
            control.pinned && "text-foreground",
          )}
        >
          {byline.handle}
        </span>
        <span data-rail-icon className="relative inline-flex w-5 h-4">
          <GraphInCell
            graph={through}
            gap={0}
            lit={{
              trunkAbove: lit?.trunkAbove,
              trunkBelow: lit?.trunkAbove,
              sideAbove: lit?.sideAbove,
              sideBelow: lit?.sideAbove,
            }}
          />
        </span>
        <span className={cn("min-w-0 truncate", TYPE.rowMeta)}>
          <span
            className={cn(
              "lg:hidden transition-colors duration-200",
              control.pinned && "text-foreground",
            )}
          >
            {byline.handle}
          </span>
          {role && (
            <span
              className={cn(
                "transition-colors duration-200",
                control.pinned ? "text-tertiary-foreground" : "text-quaternary-foreground",
              )}
            >
              <span className="lg:hidden"> · </span>
              {role}
            </span>
          )}
        </span>
        {/* Held, the role says what it was — as a chapter's marker, held,
            prints its tag message. */}
        {byline.expanded.description && (
          <Unfold open={control.pinned} className="col-start-2 lg:col-start-3 min-w-0">
            <p className={cn("pt-1.5 pb-1", TYPE.caption)}>
              {byline.expanded.description}
            </p>
          </Unfold>
        )}
      </button>
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
  const posOf = new Map<number, number>();
  items.forEach((it, p) => {
    if (it.kind === "row") posOf.set(it.i, p);
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
        it.mode =
          own(trunk, it.lane, p) > own(it.lane, trunk, p) ? "fork" : "take";
        side = it.mode === "fork" ? it.lane : trunk;
      }
      if (it.mode !== "fork") trunk = it.lane;
      holders[p] = { ...before, afterTrunk: trunk };
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
      if (!onTrunk) {
        g.side = "node";
        g.sideBelow = p < end;
      } else if (onSide) g.side = p === end ? "join" : "touch";
      else g.side = "pass";
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
  return { items, graphs, holders, on, lastOf, posOf };
}

/** Who held the trunk and the side lane at an item — for a ref, before it,
 *  and who holds the trunk after it. */
interface Holders {
  trunk: number;
  side: number | null;
  afterTrunk?: number;
}

interface ChapterGraph {
  items: Item[];
  graphs: (RowGraph | undefined)[];
  holders: Holders[];
  /** The chapters (lane indices) an item's commit is on. */
  on: (p: number) => number[];
  /** A chapter's last item's position (-1 if it has none). */
  lastOf: (lane: number) => number;
  /** A commit's position among the items, by its index. */
  posOf: ReadonlyMap<number, number>;
}

/** What is lit: rows by commit index, refs by their chapter's lane (the
 *  block's header is lane 0's). */
interface Lit {
  rows: Map<number, RowLit>;
  refs: Map<number, RefLit>;
}

const lightRow = (lit: Lit, i: number, row: RowLit) =>
  lit.rows.set(i, { ...lit.rows.get(i), ...row });

/**
 * The lines a connector lights, row by row: from one end's node to the
 * other's, along the chapter both ends are on — wherever that chapter runs
 * in between. It holds the trunk, or has stepped aside at a ref, or comes
 * back in at an `enter`; the lit lines are the ones it is drawn on.
 */
function litPath(graph: ChapterGraph, fromPos: number, toPos: number, lit: Lit) {
  const [a, b] = fromPos < toPos ? [fromPos, toPos] : [toPos, fromPos];
  const shared = graph.on(a).filter((l) => graph.on(b).includes(l));
  const c = shared[0] ?? graph.on(b)[0] ?? 0;

  for (let p = a; p <= b; p++) {
    const it = graph.items[p];
    const h = graph.holders[p];
    if (!h) continue;
    if (it.kind === "ref") {
      if (it.mode === "take" && h.trunk === c) lit.refs.set(it.lane, "aside");
      else if (h.afterTrunk === c || h.trunk === c) {
        lit.refs.set(it.lane, "through");
      }
      continue;
    }
    const add = (row: RowLit) => lightRow(lit, it.i, row);
    const g = graph.graphs[it.i]!;
    const top = p === a;
    const bottom = p === b;
    // Where the chapter runs at this row: on the trunk, or the side lane.
    const onTrunk = h.trunk === c;
    const onSide = h.side === c;
    if (!onTrunk && !onSide) {
      // Not drawn here at all (a hole in the data): fall back on the trunk.
      add({ trunkAbove: !top, trunkBelow: !bottom });
      continue;
    }
    if (onTrunk) {
      add({
        // Came in from the side lane at this very node.
        ...(g.enter ? { sideAbove: !top } : { trunkAbove: !top }),
        trunkBelow: !bottom,
      });
      continue;
    }
    // On the side lane: the node is on the trunk (the commit is on both,
    // and the lane reaches in to it) or on the side lane itself.
    const node = g.side === "node";
    add({
      sideAbove: !top,
      sideBelow: !bottom,
      reach: !node && (top || bottom),
    });
  }
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
  lit?: RefLit;
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
          <BlankHash />
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
 * A chapter's ref: the block's header (`first`), or a chapter that starts
 * inside an overlap, drawn as every chapter marker is — the same pill in the
 * same place — without the rule above it, since the chapter before it has
 * not ended. `children` stands in for the marker (the editor's inspect
 * controls).
 *
 * The tag's message: an annotated tag carries one, and `git show` prints it
 * before the commits it marks — the chapter, as its author tells it. Only
 * the page that pins its chapters (/works) prints it.
 */
function RefRow({
  className,
  y,
  first,
  tag,
  label,
  locale,
  mode,
  pinned,
  look,
  lit,
  track,
  dimmed,
  children,
}: {
  className: string;
  /** The marker's centre from the row's top, px. */
  y: number;
  first?: boolean;
  tag: Tag;
  label: string;
  locale: Locale;
  mode?: RefMode;
  pinned: boolean;
  look: RefLayout;
  lit?: RefLit;
  track: TrackControl;
  dimmed: boolean;
  children?: React.ReactNode;
}) {
  const message = pinned ? localizeOptional(tag.narrative, locale) : undefined;
  return (
    <div className={cn("relative", className)}>
      <RefGraphLayer y={y} mode={mode} first={first} look={lookOf(look)} lit={lit} />
      <div
        className={cn(
          "flex items-center gap-3 transition-opacity duration-300",
          dimmed && "opacity-40",
        )}
      >
        {children || (
          <RefLabel
            look={look}
            tag={tag}
            label={label}
            locale={locale}
            pinned={pinned}
            message={message}
            track={track}
          />
        )}
      </div>
      {look === "stub" && message && (
        <StubMessage text={message} dimmed={dimmed} open={track.pinned} />
      )}
    </div>
  );
}

/** A chapter's span of years. */
function TagDate({ tag, locale }: { tag: Tag; locale: Locale }) {
  return (
    <span className="font-mono text-xs text-tertiary-foreground">
      {formatTagDateRange(tag, locale)}
    </span>
  );
}

/** The hash slot held open, empty, so a ref's cells line up with a row's. */
function BlankHash() {
  return (
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
}

/** `stub`'s message: a paragraph under the marker, from the page column's
 *  edge, on a measure (the reading #326 tried). */
function StubMessage({
  text,
  dimmed,
  open,
}: {
  text: string;
  dimmed?: boolean;
  open: boolean;
}) {
  return (
    <Unfold open={open} className="relative">
      <p
        className={cn(
          "pt-2 max-w-prose transition-opacity duration-300",
          TYPE.body,
          dimmed && "opacity-40",
        )}
      >
        {text}
      </p>
    </Unfold>
  );
}

/**
 * A chapter's tag message opens only while its marker is held: the log at
 * rest is its rows, and a chapter says what it was when it is asked. The
 * height eases open and shut (a grid row from 0fr to 1fr), under the
 * marker, so nothing above it moves.
 */
function Unfold({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
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
  track,
}: {
  look: RefLayout;
  tag: Tag;
  label: string;
  locale: Locale;
  pinned: boolean;
  /** The tag's message. The grid looks print it where a commit's
   *  description goes, in its type, open while the marker is held; `stub`
   *  leaves it to the caller. */
  message?: string;
  track: TrackControl;
}) {
  const pill = (
    <TrackPill
      tag={tag}
      label={label}
      pinned={pinned}
      track={track}
      className="shrink-0"
    />
  );
  const date = tag.hideDate ? null : <TagDate tag={tag} locale={locale} />;
  if (look === "stub") {
    return (
      <>
        {pill}
        {date}
      </>
    );
  }
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
            <BlankHash />
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
            <BlankHash />
            <span className="col-span-2 flex items-center gap-3 min-w-0">
              {pill}
              {date}
            </span>
          </>
        )}
        {message && (
          <Unfold open={track.pinned} className="col-start-2 lg:col-start-3 min-w-0">
            <p className={cn("pt-1.5", TYPE.caption)}>{message}</p>
          </Unfold>
        )}
      </div>
    </div>
  );
}

/** A marker's hold on its chapter's track: whether it is lit, whether it is
 *  held, and the handlers that light and hold it. */
interface TrackControl {
  lit: boolean;
  pinned: boolean;
  bind: {
    onPointerEnter: React.PointerEventHandler<HTMLElement>;
    onPointerLeave: React.PointerEventHandler<HTMLElement>;
    onFocus: React.FocusEventHandler<HTMLElement>;
    onBlur: React.FocusEventHandler<HTMLElement>;
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
    onClick: React.MouseEventHandler<HTMLElement>;
  };
}

/**
 * A chapter's marker. Pointing at it lights the chapter's whole track —
 * where it holds the trunk, where it steps aside, every commit it reaches;
 * clicking it (or tapping, or tabbing to it) holds the light until focus
 * moves on.
 *
 * `data-chapter` is what the pinned bar watches: the moment this pill
 * reaches the bar's ref slot, the slot wears it. One per ref.
 */
function TrackPill({
  tag,
  label,
  pinned,
  track,
  className,
}: {
  tag: Tag;
  label: string;
  pinned: boolean;
  track: TrackControl;
  className?: string;
}) {
  // On the ladder: the chapter's name is the information where it stands
  // (secondary) until its track is lit, when it is the thing being read —
  // ink, and a border on the graph's lit rung, the track's own.
  return (
    <button
      type="button"
      data-chapter={pinned ? tag.id : undefined}
      aria-pressed={track.pinned}
      title={label}
      className={cn(
        CHAPTER_PILL,
        "relative cursor-pointer outline-none transition-colors duration-200",
        track.lit
          ? "text-foreground border-graph-lit"
          : "text-muted-foreground border-border",
        className,
      )}
      {...track.bind}
    >
      {label}
    </button>
  );
}

/**
 * Everything a chapter draws on the graph, lit: its trunk from its ref to its
 * last commit, the step aside where a newer chapter takes the trunk, its side
 * lane and every reach into a commit it shares, and the turn back in.
 */
function litTrack(graph: ChapterGraph, c: number, lit: Lit) {
  const last = graph.lastOf(c);
  // The block's own chapter starts at the block's header.
  if (c === 0) lit.refs.set(0, "start");
  graph.items.forEach((it, p) => {
    const h = graph.holders[p];
    if (!h || p > last) return;
    if (it.kind === "ref") {
      if (it.lane === c) lit.refs.set(c, it.mode === "fork" ? "fork" : "start");
      else if (it.mode === "take" && h.trunk === c) lit.refs.set(it.lane, "aside");
      else if (h.trunk === c && h.afterTrunk === c) {
        lit.refs.set(it.lane, "through");
      }
      return;
    }
    const g = graph.graphs[it.i]!;
    if (h.trunk === c) {
      lightRow(lit, it.i, {
        ...(g.enter ? { sideAbove: true } : { trunkAbove: true }),
        trunkBelow: p < last,
      });
    } else if (h.side === c) {
      lightRow(lit, it.i, {
        sideAbove: true,
        sideBelow: p < last,
        reach: graph.on(p).includes(c) && g.side !== "node",
      });
    }
  });
}
