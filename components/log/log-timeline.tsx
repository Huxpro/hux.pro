"use client";

import { useCallback, useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  adjustRailForHidden,
  computeBeams,
  computeInferredBeams,
  computeRail,
  FILTERABLE_COMMIT_TYPES,
  type FilterableCommitType,
  formatTagDateRange,
  getCommitTypePluralLabel,
  getLocalizedTagDescription,
  getLocalizedTagTitle,
  type Identity,
  isRowVisible,
  type RailInfo,
  splitRailAt,
  type Tag,
} from "@/lib/log";
import {
  DEFAULT_FORM,
  leadWithWork,
  PAGE_FORM,
  rowWeight,
  type LogForm,
} from "@/lib/log-view";
import { TYPE } from "@/lib/typography";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeBylines } from "./bylines";
import { Commit } from "./commit-embed";
import { TimelineConnector } from "./timeline-connector";
import type { BeamSpec } from "./timeline-commit";
import { useTimelineEdit } from "./timeline-edit-context";

/** Stable "no filter" default — a fresh `[]` per render would bust the
 *  per-tag memo below on every render for callers that never filter
 *  (the editor's inspect loop re-renders constantly). */
const NO_TYPES: FilterableCommitType[] = [];

/**
 * A chapter's name — who and what, `ByteDance · Lynx` — as its opener sets
 * it in serif and the pinned bar wears it once the opener has scrolled
 * under. Set as written: the marker used to be the title in capitals, or
 * `HEAD` for the newest chapter, which named the git metaphor rather than
 * the chapter. `HEAD` is still there, as a decoration on the opener's date
 * — `git log --decorate` puts it beside a commit, not in place of one.
 */
export function chapterLabel(tag: Tag, locale: Locale): string {
  return getLocalizedTagTitle(tag, locale);
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
   * chapter's name then hands itself to the bar as it scrolls under it —
   * the openers themselves never stick: two sticky layers at the top of a
   * phone would be one too many, and a paragraph cannot stick at all.
   */
  pinnedChapters?: boolean;
  /**
   * Whether a chapter's second half — what was said about the work — is
   * open. With `onToggleMinor`, the half sits under a line that folds it
   * (`FoldLine`) and the page owns the state, so a permalink can open the
   * fold its commit is under (app/works/view.tsx). Without, it is always
   * open, under a plain label: the editor edits every row.
   */
  minorOpen?: (tagId: string) => boolean;
  onToggleMinor?: (tagId: string) => void;
}

/** No rail at all — the résumé's gutter hangs logos, not a git graph. */
const NO_RAIL: RailInfo = { rail: "", segmentId: null };

/**
 * Git Log / Commit History style timeline.
 * Renders tags as chapter openers and commits as log entries, at the depth
 * the page asks for (lib/log-view.ts).
 */
export function LogTimeline({
  data,
  locale,
  identities,
  form = DEFAULT_FORM,
  activeTypes = NO_TYPES,
  onSelectHash,
  pinnedChapters = false,
  minorOpen,
  onToggleMinor,
}: LogTimelineProps) {
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
          minorOpen={minorOpen ? minorOpen(tag.id) : true}
          onToggleMinor={onToggleMinor}
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
  minorOpen: boolean;
  onToggleMinor?: (tagId: string) => void;
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
  minorOpen,
  onToggleMinor,
}: TagBlockProps) {
  const edit = useTimelineEdit();
  const inspecting = edit?.mode === "inspect";
  const isTagSelected = edit?.editingTagId === tag.id;
  const tagLabel = chapterLabel(tag, locale);
  const narrative = getLocalizedTagDescription(tag, locale);

  // The chapter's reading order: the work, then what was said about it
  // (`leadWithWork`). Everything below — the rail, the bylines, the beams,
  // the render loop — runs over this order, so they all agree on it.
  // `aboutStart` is where the second half begins, or -1 if there is none.
  const ordered = useMemo(() => leadWithWork(commits), [commits]);
  const aboutStart = ordered.findIndex((c) => rowWeight(c.type) === "minor");
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

  // The résumé hangs logos in the gutter, and no git graph: no tenure rail,
  // no connectors (`PAGE_FORM`).
  const entry = PAGE_FORM[form].gutter === "entry";

  const {
    railInfo,
    beamSpecs,
    attachments,
    bylines,
    isHidden,
    hasVisible,
    fold,
  } = useMemo(() => {
    const commits = ordered;
    const bylinesArr = computeBylines(commits, identities, locale);

    // What the chips leave on the page. It is `isRowVisible` negated — the
    // same question /works asks for its chip counts and its empty state.
    const filtered = (c: CommitData) => !isRowVisible(c, activeTypes);

    // The fold over the second half, and the row it sits over. Only when
    // there is work printed above it: a filter down to talks has no halves
    // to tell apart, and the line would be a heading over the whole page
    // repeating the chip that was just pressed. It counts what is actually
    // under it — `talks 12 · press 1` — in the chips' own words.
    const visibleAt = (i: number) => !filtered(commits[i]);
    const firstMinor =
      aboutStart < 0
        ? -1
        : commits.findIndex((c, i) => i >= aboutStart && visibleAt(i));
    const workAbove =
      firstMinor > 0 && commits.slice(0, firstMinor).some((c) => !filtered(c));
    const minors = workAbove
      ? commits.filter((c, i) => i >= aboutStart && visibleAt(i))
      : [];
    const folded = minors.length > 0 && !minorOpen;

    // One predicate, four consumers: the rail re-brackets around the rows
    // that survive, beams with a hidden endpoint are dropped, the render
    // loop below skips the rest, and the block prints nothing if none are
    // left. A folded half is hidden the same way a filtered row is — the
    // rail and the connectors cannot tell the two apart, and should not.
    // So is an event in the résumé: `moved to the US` is a dateline between
    // commits, and the résumé has no line of commits for it to sit on —
    // the chapter's narrative already says it.
    const hidden = (c: CommitData) =>
      filtered(c) ||
      (folded && rowWeight(c.type) === "minor") ||
      (entry && c.type === "event");

    // Each half brackets on its own (see `splitRailAt`).
    const rail = entry
      ? commits.map(() => NO_RAIL)
      : adjustRailForHidden(
          commits,
          splitRailAt(computeRail(commits), aboutStart),
          hidden,
        );

    const allBeams = entry
      ? []
      : [
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
      hasVisible: commits.some((c) => !filtered(c)),
      fold: minors.length > 0 ? { at: firstMinor, rows: minors, folded } : null,
    };
  }, [ordered, aboutStart, identities, locale, activeTypes, minorOpen, entry]);

  // A chapter with nothing left in it prints nothing — no ref marker hanging
  // over an empty stretch of page. The era headers are the timeline's spine,
  // but a spine with no vertebrae is just a line.
  if (!hasVisible) return null;

  return (
    <section aria-labelledby={`chapter-${tag.id}`}>
      {/* The chapter opener. It used to be a ref marker and nothing else —
          a pill reading `HEAD` or `CHINA` and a date range — while the tag
          carried a company, a date range and a paragraph saying what the
          chapter was, none of it printed. A newcomer met nineteen talks
          before anything told them whose career this was.

          So it opens the way a /prompt section does: the name in serif,
          then the chapter's narrative in full, in the page's prose voice.
          Read top to bottom the four openers are the career in four
          paragraphs, and the log under each is the evidence.

          The git wink stays where it is cheap: `HEAD` decorates the newest
          chapter's date the way `git log --decorate` decorates a commit,
          and the name is still what the pinned bar wears as its ref once
          the opener has scrolled up under it. */}
      <header className={cn("pb-3", tagIndex > 0 && "mt-16")}>
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id={`chapter-${tag.id}`}
            // `data-chapter` is what the pinned bar watches: the moment the
            // name reaches the bar's ref slot, the slot wears it — the way a
            // large title hands itself to a navigation bar.
            data-chapter={pinned ? tag.id : undefined}
            className="min-w-0 font-serif text-xl sm:text-2xl text-foreground"
          >
            {inspecting && edit ? (
              <button
                type="button"
                onClick={() => edit.onSelectTag(tag.id)}
                className={cn(
                  "-mx-1.5 rounded px-1.5 text-left transition-colors",
                  isTagSelected
                    ? "ring-1 ring-inset ring-sky-500/70 bg-sky-500/[0.05]"
                    : "hover:ring-1 hover:ring-inset hover:ring-sky-500/50",
                )}
                title="Inspect chapter"
              >
                {tagLabel}
              </button>
            ) : (
              tagLabel
            )}
          </h2>
          <span className="flex shrink-0 items-center gap-2">
            {tagIndex === 0 && !tag.endDate && (
              <span className={cn(CHAPTER_PILL, "border-border")}>
                {t(locale, "logHead")}
              </span>
            )}
            {!tag.hideDate && (
              <span className={TYPE.rowMeta}>
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
          </span>
        </div>
        {narrative && <p className={cn("mt-2", TYPE.body)}>{narrative}</p>}
      </header>

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
            | { kind: "loose"; indices: number[] }
            | { kind: "cluster"; segmentId: string; indices: number[] };
          const commits = ordered;
          const runs: Run[] = [];
          for (let i = 0; i < commits.length; i++) {
            const c = commits[i];
            if (isHidden(c)) continue;
            const sid = railInfo[i].segmentId;
            const last = runs[runs.length - 1];
            // The second half's fold sits between two runs, never inside
            // one, so a loose run is cut there too (a cluster already is:
            // `splitRailAt` gave the half its own segment ids).
            const cut = i === fold?.at;
            if (!cut && sid && last && last.kind === "cluster" && last.segmentId === sid) {
              last.indices.push(i);
            } else if (sid) {
              runs.push({ kind: "cluster", segmentId: sid, indices: [i] });
            } else if (!cut && last && last.kind === "loose") {
              last.indices.push(i);
            } else {
              runs.push({ kind: "loose", indices: [i] });
            }
          }
          // What was said about the work, after the work: a line in the
          // chips' own words, so the date jumping back up to this year reads
          // as a second list rather than as the log going wrong. Folded, it
          // is the whole of the second half; either way it is where the
          // half opens and closes.
          const foldLine = fold && (
            <FoldLine
              key="fold"
              rows={fold.rows}
              open={!fold.folded}
              locale={locale}
              onToggle={onToggleMinor && (() => onToggleMinor(tag.id))}
            />
          );
          const rendered = runs.map((run, runIdx) => {
            const rows = run.indices.map((i) => (
              <Commit
                key={commits[i].id}
                commit={commits[i]}
                locale={locale}
                variant="timeline"
                hideDate={tag.hideDate || commits[i].hideDate}
                rail={railInfo[i].rail}
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
            ));
            return run.kind === "cluster" ? (
              // An identity can cluster twice (Meta, then RIT, then Meta
              // again), so the run is named by its first row, not its id.
              <div
                key={`cluster-${commits[run.indices[0]].id}`}
                className="group/tenure"
              >
                {rows}
              </div>
            ) : (
              <div key={`loose-${runIdx}`}>{rows}</div>
            );
          });
          if (!fold) return rendered;
          const split = runs.findIndex((run) => run.indices[0] >= fold.at);
          return split < 0
            ? [...rendered, foldLine]
            : [...rendered.slice(0, split), foldLine, ...rendered.slice(split)];
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
    </section>
  );
}

/** Where a minor row happened — the conference, the platform — without the
 *  year the date column already prints (`GOSIM Paris 2026` → `GOSIM Paris`). */
function venueOf(c: CommitData): string | null {
  const venue =
    c.type === "talk"
      ? c.conference.name
      : c.type === "press"
        ? c.platform
        : c.type === "post"
          ? c.publication.name
          : null;
  return venue ? venue.replace(/\s*(19|20)\d{2}$/, "") : null;
}

/**
 * The line a chapter's second half hangs from —
 *
 *   talks 12 · press 1   WeAreDevelopers World Congress, GOSIM Paris, …   ⌄
 *
 * Folded, it is the half: how much was said about the work, in the chips'
 * own words and counts, and where, newest first, for as long as the column
 * has room. Open, the rows are under it, so it drops the venues they print
 * and is only the label and the way back.
 *
 * The résumé starts it folded, and the log open (`PAGE_FORM.fold`): the
 * same line at every depth, so going deeper never changes what it is, only
 * where it starts. Without `onToggle` (the editor) it is a plain label.
 */
function FoldLine({
  rows,
  open,
  locale,
  onToggle,
}: {
  rows: CommitData[];
  open: boolean;
  locale: Locale;
  onToggle?: () => void;
}) {
  const counts = FILTERABLE_COMMIT_TYPES.flatMap((type) => {
    const n = rows.filter((c) => c.type === type).length;
    return n > 0
      ? [`${getCommitTypePluralLabel(type, locale).toLocaleLowerCase()} ${n}`]
      : [];
  }).join(" · ");
  const venues = [
    ...new Set(rows.map(venueOf).filter((v): v is string => !!v)),
  ].join(t(locale, "logListSeparator"));

  const body = (
    <>
      <span className={cn("shrink-0 tabular-nums", TYPE.label)}>{counts}</span>
      <span className={cn("min-w-0 flex-1 truncate", TYPE.rowMeta)}>
        {!open && venues}
      </span>
      {onToggle && (
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0 self-center text-tertiary-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      )}
    </>
  );

  return onToggle ? (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="pressable -mx-3 mt-4 flex w-[calc(100%+1.5rem)] items-baseline gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/20 active:bg-muted/30"
    >
      {body}
    </button>
  ) : (
    <p className="mt-6 mb-1 flex items-baseline gap-3">{body}</p>
  );
}
