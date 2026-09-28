"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
  type Identity,
  isRowVisible,
  commitVenue,
  formatCommitDate,
  localize,
  localizeOptional,
  type Tag,
} from "@/lib/log";
import {
  badgeNames,
  buildEditions,
  editionLine,
  type Editions,
} from "@/lib/log-editions";
import {
  buildScopes,
  heldLine,
  holdersOf,
  needsPointer,
  scopeEntries,
  type Scopes,
} from "@/lib/log-scopes";
import { DEFAULT_FORM, type LogForm } from "@/lib/log-view";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeBylines } from "./bylines";
import { Commit, type StripSource } from "./commit-embed";
import { Description } from "./embeds/shared";
import { CommitIcon } from "./icons";
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
  // Works in several versions, over the whole log rather than per chapter:
  // a version can sit on the other side of a chapter marker from its lead,
  // and its line still has to know where to send you.
  const editions = useMemo(() => {
    const all = data.flatMap((d) => d.commits);
    const visible = (c: CommitData) => isRowVisible(c, activeTypes);
    const e = buildEditions(all, visible, locale);
    const scopes = buildScopes(all, visible, e);
    const order = new Map(all.map((c, i) => [c.id, i]));
    const byId = new Map(all.map((c) => [c.id, c]));
    const idByHash = new Map(all.map((c) => [computeCommitHash(c.id), c.id]));
    return { ...e, scopes, order, byId, idByHash };
  }, [data, activeTypes, locale]);

  // Which version each work's row is showing, by work id. Unset is the lead.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const choose = useCallback(
    (work: string, version: string) =>
      setChosen((c) => (c[work] === version ? c : { ...c, [work]: version })),
    [],
  );

  // `/works#<version hash>` lands on its work's row, showing that version.
  // Synchronous, because the caller measures the row on the next line.
  useEffect(
    () =>
      registerCommitRevealer((hash) => {
        // Something a project holds, in the covers form: no row of its own,
        // a column on the project's strip. Land on the project with it
        // chosen, which brings the column into view.
        const heldId = editions.idByHash.get(hash);
        const heldCommit = heldId ? editions.byId.get(heldId) : undefined;
        if (form === "covers" && heldId && heldCommit) {
          const work = editions.groupOf.get(heldId);
          const project = editions.scopes.scopeOf.get(work ? work.lead.id : heldId);
          if (project) {
            flushSync(() => {
              choose(`scope:${project}`, heldId);
              if (work) choose(work.id, heldId);
            });
            return document.getElementById(computeCommitHash(project));
          }
        }
        const id = editions.byHash.get(hash);
        const group = id ? editions.groupOf.get(id) : undefined;
        if (!id || !group) return null;
        flushSync(() => choose(group.id, id));
        return document.getElementById(computeCommitHash(group.lead.id));
      }),
    [editions, choose, form],
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
          editions={editions}
          chosen={chosen}
          onChoose={choose}
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
  editions: Editions & {
    scopes: Scopes;
    order: Map<string, number>;
    byId: Map<string, CommitData>;
  };
  chosen: Record<string, string>;
  onChoose: (work: string, version: string) => void;
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
  editions,
  chosen,
  onChoose,
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

  // A work in several versions prints as one row with its versions.
  const versionProps = (c: CommitData) => {
    const group = editions.groupOf.get(c.id);
    return group
      ? {
          versions: group.versions,
          selectedVersion: chosen[group.id] ?? c.id,
          onSelectVersion: (id: string) => onChoose(group.id, id),
        }
      : {};
  };

  /**
   * A row as it prints. A project that holds other work lays it out the way
   * the page's form lays out pictures.
   *
   * In the covers form the pictures run across, so the commits they belong
   * to run across with them: the project's strip is its branch turned on
   * its side (media/segmented-strip.tsx). Each held work is a column per
   * version, its covers captioned underneath with where and when, over the
   * work's title on a line along the bottom of the strip; the project's
   * own attachments sit on the same line where they happened (the post
   * after the talk, the repository last). Nothing prints under the project: the strip is the
   * whole scope in one row. Pressing a caption reads that commit's prose
   * under the strip; scrolling the strip to a version makes its work read
   * that version.
   *
   * The index and the feed print pictures differently (none; every row
   * whole), so there what the project holds follows it down the page as
   * rows of their own, on a branch of the gutter drawn the way `git log
   * --graph` draws one: a lane a step right of the rail that grows up out
   * of it and curves back into it under the last row.
   */
  const renderRow = (
    c: CommitData,
    props: Omit<React.ComponentProps<typeof Commit>, "commit">,
  ): React.ReactNode => {
    const held = editions.scopes.childrenOf.get(c.id);
    if (!held) {
      return <Commit key={c.id} {...props} commit={c} {...versionProps(c)} />;
    }
    const scopeKey = `scope:${c.id}`;

    if (form === "covers") {
      const strip: StripSource[] = [];
      for (const [k, entry] of scopeEntries(c, held, editions, true).entries()) {
        if (entry.kind === "media") {
          const id = `${c.id}:media:${k}`;
          strip.push({ id, commit: c, media: entry.media, group: { id } });
          continue;
        }
        const work = entry.commit;
        const group = editions.groupOf.get(work.id);
        const versions = group ? group.versions : [work];
        const names = group ? badgeNames(versions, locale) : [];
        const lane = {
          id: work.id,
          title: localize(work.title, locale),
          icon: <CommitIcon type={work.type} className="h-3 w-3" />,
        };
        versions.forEach((v, i) =>
          strip.push({
            id: v.id,
            commit: v,
            caption: [names[i], commitVenue(v)].filter(Boolean).join(" · "),
            date: formatCommitDate(v, locale),
            title: group ? editionLine(v, locale) : heldLine(v, locale),
            group: lane,
          }),
        );
      }
      const active =
        chosen[scopeKey] ?? strip.find((s) => !s.media)?.id ?? strip[0]?.id;
      const choose = (id: string) => {
        onChoose(scopeKey, id);
        const group = editions.groupOf.get(id);
        if (group) onChoose(group.id, id);
      };
      // Pressing a caption reads that commit under the strip; pressing the
      // one being read puts it away.
      const detailKey = `detail:${c.id}`;
      const reading = chosen[detailKey] === "open";
      const current = strip.find((s) => s.id === active);
      const prose =
        reading && current && !current.media
          ? localizeOptional(current.commit.description, locale)
          : undefined;
      return (
        <Commit
          key={c.id}
          {...props}
          commit={c}
          {...versionProps(c)}
          holds
          strip={strip}
          activeSegment={active}
          onActiveSegment={choose}
          onPressSegment={(id) => {
            onChoose(detailKey, id === active && reading ? "closed" : "open");
            choose(id);
          }}
          stripDetail={prose && <Description text={prose} isExpanded />}
        />
      );
    }

    // The rail runs on past the branch when it runs on past the project.
    const rail = props.rail === "│" || props.rail === "┐" ? "│" : "";
    return (
      <Fragment key={c.id}>
        <Commit {...props} commit={c} {...versionProps(c)} branch="head" holds />
        {held.map((h, k) => (
          <Commit
            key={h.id}
            locale={locale}
            variant="timeline"
            form={form}
            rail={rail}
            segmentId={props.segmentId}
            onSelectHash={onSelectHash}
            branch={k === held.length - 1 ? "last" : "entry"}
            commit={h}
            {...versionProps(h)}
            held
            hideDate={tag.hideDate || h.hideDate}
          />
        ))}
      </Fragment>
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

              // Printed inside other rows: a version inside its work's row,
              // a talk inside the project that holds it. At its own date it
              // keeps a quiet line only when none of those rows covers that
              // time; otherwise the row already is where a reader looks.
              const holders = holdersOf(c, editions, editions.scopes, editions.byId);
              if (holders.length > 0) {
                if (!needsPointer(c, holders)) return null;
                const top = holders[holders.length - 1];
                const down =
                  (editions.order.get(top.id) ?? 0) >
                  (editions.order.get(c.id) ?? 0);
                const group = editions.groupOf.get(c.id);
                const hash = computeCommitHash(c.id);
                return (
                  <Commit
                    key={c.id}
                    {...shared}
                    foldedLine={
                      group ? editionLine(c, locale) : heldLine(c, locale)
                    }
                    pointer={down ? "down" : "up"}
                    anchorId={null}
                    onPress={() =>
                      onSelectHash
                        ? onSelectHash(hash)
                        : group && onChoose(group.id, c.id)
                    }
                  />
                );
              }

              return renderRow(c, shared);
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
}
