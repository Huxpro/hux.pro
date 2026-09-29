"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { WorksToolbar, type TypeFacet } from "@/components/log/works-toolbar";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import { Branches, laneChapters, laneShows } from "@/components/log/places";
import { t, useLocale } from "@/services";
import {
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  isFilterableCommitType,
  isRowVisible,
  type FilterableCommitType,
  type LogData,
} from "@/lib/log";
import { buildLanes, summarize, type Lane } from "@/lib/log-places";
import {
  parseViewState,
  serializeViewState,
  toggleType,
  type LogDepth,
  type LogViewState,
} from "@/lib/log-view";

// =============================================================================
// One page, one log: the places are its branches (lib/log-places.ts), and
// the page is that log at a depth (lib/log-view.ts) — folded to a summary
// by default, unfolded a branch at a time or all at once.
// =============================================================================

/** The lane a commit permalink (`#<hash>`) needs unfolded, if any: the one
 *  holding a commit the summary folds (a talk, a press piece). A project,
 *  a role and an event print at the summary, and are travelled to there. */
function laneToUnfold(lanes: Lane[], hash: string): string | null {
  const id = hash.replace(/^#/, "");
  if (!/^[0-9a-f]{7}$/.test(id)) return null;
  for (const lane of lanes) {
    const { folded } = summarize(lane);
    if (folded.some((c) => computeCommitHash(c.id) === id)) return lane.id;
  }
  return null;
}

interface WorksViewProps {
  logData: LogData;
}

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const lanes = useMemo(() => buildLanes(logData, locale), [logData, locale]);

  // View state lives in the URL, the way /writing's language filter does:
  // a reading of this page ("just the talks, every branch unfolded") is a
  // link someone can send, and the back button undoes a filter the way you
  // would expect it to.
  const urlView = useMemo(
    () => parseViewState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  // Canonical form of just the params we own, so an unrelated query param
  // can't make every comparison below look like a change.
  const urlKey = serializeViewState(urlView);

  // …but the URL is not what we render from. `router.replace` re-runs the
  // route, which costs about a second — far too long for a control you tap
  // three times in a row to find the view you want. So local state paints
  // immediately and the URL follows, which is also what makes the chips feel
  // like switches rather than links.
  const [view, setView] = useState(urlView);
  const [lastUrlKey, setLastUrlKey] = useState(urlKey);
  if (urlKey !== lastUrlKey) {
    setLastUrlKey(urlKey);
    // Adopt the URL only when it is genuinely a different reading — our own
    // replace() landing is not news, and re-adopting it would hand every
    // consumer a fresh `types` array for no reason. (React's "adjusting
    // state when a prop changes" pattern, as used by TimelineCommit.)
    if (urlKey !== serializeViewState(view)) setView(urlView);
  }

  const commit = useCallback(
    (next: Partial<LogViewState>) => {
      const merged = { ...view, ...next };
      setView(merged);
      const query = serializeViewState(
        merged,
        new URLSearchParams(searchParams.toString()),
      );
      // `replace`, not `push`: toggling four chips to find the right view
      // should not cost four taps of the back button to undo.
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [view, searchParams, router, pathname],
  );

  // The branches the reader unfolded (or folded) by hand, against what the
  // depth says. Page state, not URL state: a depth is a reading worth
  // sending, one branch opened on the way is not. A depth change is a new
  // default for every branch, so the deviations are spent — reconciled
  // during render, like the view above and TimelineCommit's own press.
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const [flippedAt, setFlippedAt] = useState<LogDepth>(view.depth);
  if (flippedAt !== view.depth) {
    setFlippedAt(view.depth);
    setFlipped(new Set());
  }

  // A filter that leaves out the projects leaves the summary nothing to
  // lead with, and nothing to protect from the talks it folds: `Talks` alone
  // is a request for the talks, so every branch unfolds to its rows (and
  // `Roles` alone to its header). The summary is for the mix.
  const summarizes =
    view.depth === "summary" &&
    (view.types.length === 0 || view.types.includes("project"));

  const isDeep = useCallback(
    (lane: Lane) => (summarizes ? flipped.has(lane.id) : true),
    [summarizes, flipped],
  );

  const toggleLane = useCallback((lane: Lane) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (!next.delete(lane.id)) next.add(lane.id);
      return next;
    });
  }, []);

  // A permalink to a commit the summary folds unfolds its branch first —
  // the page opens whatever encloses the row, and the anchor then travels
  // to it (useCommitAnchor waits for the row to exist).
  useEffect(() => {
    const open = () => {
      const lane = laneToUnfold(lanes, window.location.hash);
      if (!lane) return;
      setFlipped((prev) => (prev.has(lane) ? prev : new Set(prev).add(lane)));
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [lanes]);

  const selectHash = useCommitAnchor();

  // Facet counts are of the UNFILTERED log, so a chip's number never moves
  // as you select — it answers "how much of this is there?", not "how much
  // survived what I just did?", which is the question the page answers.
  //
  // The question it answers precisely is "how many rows does tapping this
  // chip print?", which is why each commit is asked against its own type
  // rather than against no filter at all. For every type but one the two
  // are the same sentence; for `role` they are not, because a suppressed
  // role un-suppresses under its own chip (see `isRowVisible`) and a count
  // of 2 over a column of 9 is just a wrong number.
  //
  // Counted over the lanes rather than the raw log, because the lanes are
  // what the page lays out — locale filtered, every commit on a branch or on
  // `main`. A count derived from a different array is a count that can
  // disagree with the rows under it.
  const facets = useMemo<TypeFacet[]>(() => {
    // Per type: how many rows, and every distinct `icon` override they carry.
    // One override and the chip can wear it; more than one (or none) and it
    // falls back to the type's own mark.
    const seen = new Map<
      FilterableCommitType,
      { count: number; icons: Set<string | undefined> }
    >();

    for (const lane of lanes) {
      for (const c of lane.commits) {
        if (!isFilterableCommitType(c.type)) continue;
        if (!isRowVisible(c, [c.type])) continue;
        const entry = seen.get(c.type) ?? { count: 0, icons: new Set() };
        entry.count += 1;
        entry.icons.add(c.icon);
        seen.set(c.type, entry);
      }
    }

    return FILTERABLE_COMMIT_TYPES.filter((t) => seen.has(t)).map((type) => {
      const { count, icons } = seen.get(type)!;
      return {
        type,
        count,
        iconOverride: icons.size === 1 ? [...icons][0] : undefined,
      };
    });
  }, [lanes]);

  const chapters = useMemo(() => laneChapters(lanes), [lanes]);

  // Whether the page has anything to print under the current filter — the
  // same question every lane asks itself before rendering, so the end
  // marker and the lanes can never disagree.
  const hasMatches = useMemo(
    () => lanes.some((lane) => laneShows(lane, view.types)),
    [lanes, view.types],
  );

  return (
    <PageLayout
      page="works"
      pinnedActions={
        <WorksToolbar
          locale={locale}
          facets={facets}
          active={view.types}
          onToggleType={(type) =>
            commit({ types: toggleType(view.types, type) })
          }
          onClearTypes={() => commit({ types: [] })}
          depth={view.depth}
          onDepthChange={(depth) => commit({ depth })}
          chapters={chapters}
        />
      }
    >
      <Branches
        lanes={lanes}
        locale={locale}
        identities={logData.identities}
        depth={view.depth}
        types={view.types}
        isDeep={isDeep}
        foldable={summarizes}
        onToggle={toggleLane}
        onSelectHash={selectHash}
      />

      {/* End marker — `git init` closes a log that has commits in it; a
          filter that matched nothing says so in the same slot, in the same
          voice, rather than leaving the page to end in silence. */}
      <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, hasMatches ? "logInit" : "logNoMatches")}
      </div>
    </PageLayout>
  );
}
