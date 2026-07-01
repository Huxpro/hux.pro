"use client";

import { useCallback, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  adjustRailForHidden,
  computeBeams,
  computeInferredBeams,
  computeRail,
  formatTagDateRange,
  getLocalizedTagTitle,
  type Identity,
  localize,
  resolveIdentity,
  type Tag,
} from "@/lib/log";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Commit } from "./commit-embed";
import { TimelineConnector } from "./timeline-connector";
import type { BeamSpec } from "./timeline-commit";
import { useTimelineEdit } from "./timeline-edit-context";

interface LogTimelineProps {
  data: {
    tag: Tag;
    commits: CommitData[];
  }[];
  locale: Locale;
  /** When toggled, every commit row syncs its expanded state to this value. */
  expandAll?: boolean;
  /**
   * Global identities map (handle + company + accent per identity id).
   * Used to hydrate the `<handle>` byline and the expanded author
   * block on each commit; each row resolves its `identityId` and looks
   * up here.
   */
  identities?: Record<string, Identity>;
}

/**
 * Git Log / Commit History style timeline.
 * Renders tags as ref markers and commits as dense log entries.
 */
export function LogTimeline({ data, locale, expandAll, identities }: LogTimelineProps) {
  return (
    <div className="space-y-0">
      {data.map(({ tag, commits }, tagIndex) => (
        <TagBlock
          key={tag.id}
          tag={tag}
          commits={commits}
          tagIndex={tagIndex}
          locale={locale}
          expandAll={expandAll}
          identities={identities}
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
  expandAll?: boolean;
  identities?: Record<string, Identity>;
}

function TagBlock({ tag, commits, tagIndex, locale, expandAll, identities }: TagBlockProps) {
  const edit = useTimelineEdit();
  const inspecting = edit?.mode === "inspect";
  const isTagSelected = edit?.editingTagId === tag.id;
  const tagLabel =
    tagIndex === 0 ? "HEAD" : getLocalizedTagTitle(tag, locale).toUpperCase();
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
  // Per-endpoint gap is derived from the commit's type so the line
  // meets each endpoint at the right radius (role ring vs icon vs
  // event dot).
  const gapFor = (type: CommitData["type"]) =>
    type === "role" ? 10 : type === "event" ? 3 : 7;

  const { railInfo, beamSpecs, attachments, bylines } = useMemo(() => {
    const rail = adjustRailForHidden(commits, computeRail(commits));
    const allBeams = [
      ...computeBeams(commits).map((b) => ({ ...b, inferred: false })),
      ...computeInferredBeams(commits, rail).map((b) => ({
        ...b,
        inferred: true,
      })),
    ];

    // Per-commit author byline data. Handle + company come from the
    // shared identity metadata; title / tenure / description come from
    // the specific role instance that owns this commit's date. Two
    // Meta interns and the Meta SWE tenure all resolve identity="meta"
    // (same `<jsx@fb.com>`, same "Meta"), but each expands to its own
    // role instance context.
    //
    // isClusterHead is per-identity — the first row of a contiguous
    // same-identity run shows the handle at rest; the rest fade in on
    // per-row hover so the page reads as "one identity per chapter".
    type Byline = {
      handle: string;
      isClusterHead: boolean;
      /**
       * Effective team subtitle for a project row, computed as
       * `project.team ?? role.team`. Only set when the row is a project
       * AND this is the first row in a contiguous same-team run —
       * repeats render blank (sparse). Non-projects get undefined here
       * (their subtitle comes from `data.meta` — talk conference,
       * publication, platform).
       */
      subtitle?: string;
      expanded: {
        title: string;
        company: string;
        location?: string;
        description?: string;
      };
    };
    const bylinesArr: (Byline | null)[] = commits.map(() => null);
    let prevIdentityId: string | null = null;
    let prevProjectTeam: string | null = null;
    for (let i = 0; i < commits.length; i++) {
      const c = commits[i];
      const resolved = resolveIdentity(c, commits);
      if (!resolved) {
        prevIdentityId = null;
        continue;
      }
      const identity = identities?.[resolved.identityId];
      if (!identity) {
        prevIdentityId = null;
        continue;
      }
      const isClusterHead = resolved.identityId !== prevIdentityId;
      prevIdentityId = resolved.identityId;

      // Prefer role-instance details when we have a specific role
      // (title / dates / description differ per intern vs FTE etc.).
      // Fall back to identity-level defaults when there's no role fit
      // — e.g. an award received a month after tenure ended, linked
      // only via `identityId`.
      const role = resolved.role;
      const company = role?.companyOverride
        ? localize(role.companyOverride, locale)
        : localize(identity.company, locale);
      const title = role ? localize(role.title, locale) : "";
      const desc = role ? localize(role.description, locale) : "";

      // Effective team subtitle: project override wins, otherwise
      // inherits the role's team default. Sparse — blank the chip when
      // it repeats the previous project's team so a Lynx-era run of
      // 10 projects all inheriting `Lynx @ ByteDance` prints the chip
      // once at the top and stays quiet after.
      let subtitle: string | undefined;
      if (c.type === "project") {
        const teamRaw = c.team ?? role?.team;
        const teamStr = teamRaw ? localize(teamRaw, locale) : undefined;
        if (teamStr && teamStr !== prevProjectTeam) {
          subtitle = teamStr;
          prevProjectTeam = teamStr;
        } else if (teamStr) {
          // Same team as previous project — blank, but keep tracker.
          prevProjectTeam = teamStr;
        }
        // (If teamStr is undefined we leave prevProjectTeam untouched
        //  so a project with no team doesn't reset the streak.)
      }

      bylinesArr[i] = {
        handle: identity.handle,
        isClusterHead,
        subtitle,
        expanded: {
          title,
          company,
          location: role?.location,
          description: desc && desc.trim() ? desc : undefined,
        },
      };
    }

    const attachmentsWithGaps = allBeams.map((b) => ({
      ...b,
      fromGap: gapFor(commits[b.fromIdx].type),
      toGap: gapFor(commits[b.toIdx].type),
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
    };
  }, [commits, identities, locale]);

  return (
    <div>
      {/* Tag ref marker — like `git log --decorate` ref annotations */}
      <div
        className={cn(
          "sticky top-4 z-20 flex items-center gap-3 py-2",
          tagIndex > 0 && "mt-6 pt-6 border-t border-border/30",
        )}
      >
        {/* Frosted-glass fill: translucent + blurred so the ambient gradient
            shows through and gets tinted per-theme rather than covered by a
            flat opaque patch. The tint direction follows the theme — lighten
            toward white in light mode (keeping the near-white chip it always
            was), darken with black in dark mode (the "shade darker than the
            page" look). Compositing a tint at alpha α over backdrop B gives a
            uniform shift, so a solid background reads the same as before while
            a gradient keeps its hue. */}
        {inspecting && edit ? (
          <button
            type="button"
            onClick={() => edit.onSelectTag(tag.id)}
            className={cn(
              "inline-flex items-center bg-white/70 dark:bg-black/25 backdrop-blur font-mono text-xs font-medium text-foreground px-2.5 py-0.5 border rounded-full transition-colors",
              isTagSelected
                ? "border-sky-500/70 ring-1 ring-inset ring-sky-500/35 bg-sky-500/[0.05]"
                : "border-border hover:border-sky-500/50",
            )}
            title="Inspect chapter"
          >
            {tagLabel}
          </button>
        ) : (
          <span className="inline-flex items-center bg-white/70 dark:bg-black/25 backdrop-blur font-mono text-xs font-medium text-foreground px-2.5 py-0.5 border border-border rounded-full">
            {tagLabel}
          </span>
        )}
        {!tag.hideDate && (
          <span className="font-mono text-xs text-muted-foreground/50">
            {formatTagDateRange(tag, locale)}
          </span>
        )}
        {inspecting && edit && (
          <button
            type="button"
            onClick={() => edit.onAddCommit(tag.id)}
            className="inline-flex items-center justify-center text-muted-foreground/40 hover:text-foreground transition-colors"
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
            if (c.type === "role" && c.hideRow === true) continue;
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
            const rows = run.indices.map((i) => (
              <Commit
                key={commits[i].id}
                commit={commits[i]}
                locale={locale}
                variant="timeline"
                expandAll={expandAll}
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
              />
            ));
            return run.kind === "cluster" ? (
              <div key={`cluster-${run.segmentId}`} className="group/tenure">
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
