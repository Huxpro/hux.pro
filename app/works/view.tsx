"use client";

import { useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import {
  chapterLabel,
  LogTimeline,
  type LogFold,
} from "@/components/log/log-timeline";
import { useOptionalDevtool, WORKS_REF_DEFAULT } from "@/systems/devtool";
import { ProjectShelf } from "@/components/log/project-shelf";
import { WorksToolbar, type TypeFacet } from "@/components/log/works-toolbar";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import { useWorksFlag } from "@/components/log/works-flags";
import {
  SELECTED_GROUP_ID,
  SelectedWorks,
  selectedPointers,
  selectedWorks,
} from "@/components/log/selected-works";
import { t, useLocale } from "@/services";
import {
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  isFilterableCommitType,
  isRowVisible,
  localize,
  type FilterableCommitType,
  type LogData,
} from "@/lib/log";
import {
  parseViewState,
  serializeViewState,
  toggleType,
  type LogForm,
} from "@/lib/log-view";
import { buildEraTimeline } from "@/lib/log-eras";
import { foldUnderProjects } from "@/lib/works-projects";

const NO_FLIPS: ReadonlySet<string> = new Set();

interface WorksViewProps {
  logData: LogData;
}

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const data = useMemo(
    () => buildEraTimeline(logData, locale),
    [logData, locale],
  );

  // View state lives in the URL, the way /writing's language filter does:
  // a reading of this page ("just the talks, with the media showing") is a
  // link someone can send, and the back button undoes a filter the way you
  // would expect it to.
  const urlView = useMemo(
    () => parseViewState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  // Canonical form of just the two params we own, so an unrelated query
  // param can't make every comparison below look like a change.
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

  // ── The `fold` flag (components/log/works-flags.ts) ─────────────────────
  // Which rows fold under which project: lib/works-projects.ts, per chapter.
  const foldFlag = useWorksFlag("fold");
  const foldOf = useMemo(
    () =>
      foldFlag
        ? new Map(data.flatMap(({ commits }) => [...foldUnderProjects(commits)]))
        : null,
    [foldFlag, data],
  );

  // Whether a fold starts open is the reading's, not the row's:
  //  - a `?type=` filter opens them, so a filter never hides its own
  //    results behind a line (a fold holding none of them prints nothing);
  //  - the feed opens them, because the feed is the form that prints
  //    everything, and a fold there would be the one thing it kept back;
  //  - `index` and `covers` start them shut — the overview is the point.
  // The page remembers only the folds the reader flipped from that, stamped
  // with the reading they were flipped in, so a new form or filter spends
  // them the way a form change spends an opened row (TimelineCommit) —
  // without an effect to clear them.
  const foldsOpen = view.form === "feed" || view.types.length > 0;
  const foldStamp = `${view.form}|${view.types.join(",")}`;
  const [flips, setFlips] = useState<{
    stamp: string;
    ids: ReadonlySet<string>;
  }>({ stamp: foldStamp, ids: NO_FLIPS });
  const flipped = flips.stamp === foldStamp ? flips.ids : NO_FLIPS;
  const isFoldOpen = useCallback(
    (projectId: string) => foldsOpen !== flipped.has(projectId),
    [foldsOpen, flipped],
  );
  const toggleFold = useCallback(
    (projectId: string) => {
      const ids = new Set(flipped);
      if (ids.has(projectId)) ids.delete(projectId);
      else ids.add(projectId);
      setFlips({ stamp: foldStamp, ids });
    },
    [flipped, foldStamp],
  );
  const fold = useMemo<LogFold | undefined>(
    () =>
      foldOf
        ? { of: foldOf, isOpen: isFoldOpen, onToggle: toggleFold }
        : undefined,
    [foldOf, isFoldOpen, toggleFold],
  );

  // A permalink to a row a fold has shut away: open the fold first,
  // synchronously, so the row is in the document when the anchor measures
  // it (`useCommitAnchor`). Every other row a hash can name is already on
  // the page.
  const reveal = useCallback(
    (hash: string) => {
      if (!foldOf) return;
      for (const { commits } of data) {
        const c = commits.find((c) => computeCommitHash(c.id) === hash);
        if (!c) continue;
        const projectId = foldOf.get(c.id);
        if (projectId && !isFoldOpen(projectId)) {
          flushSync(() => toggleFold(projectId));
        }
        return;
      }
    },
    [data, foldOf, isFoldOpen, toggleFold],
  );
  const selectHash = useCommitAnchor(reveal);

  // How a chapter's ref sits on the graph — on trial, a saved setting in
  // the DevTool's Works module.
  const devtool = useOptionalDevtool();
  const refLook = devtool?.worksRef ?? WORKS_REF_DEFAULT;
  // The projects shelf, on trial: a saved DevTool setting, off by default.
  const shelf = devtool?.worksShelf ?? false;
  // The shelf's projects: every project row the log prints, in the log's
  // own order (newest first across the chapters). It stands only while
  // the reading includes projects — a page filtered to talks opens on
  // talks, not on a directory of something it is not showing.
  const projects = useMemo(
    () => data.flatMap(({ commits }) => commits.filter((c) => c.type === "project")),
    [data],
  );
  // ── The `selected` flag (components/log/works-flags.ts) ─────────────────
  // The flagships lead the page (components/log/selected-works.tsx), as far
  // as the filter shows them: a chip that is not theirs hides the head, and
  // then there are no pointers either — the log is the log without the flag,
  // folds and all. Shown, each leaves a pointer in its slot in the log.
  const selectedFlag = useWorksFlag("selected");
  const selected = useMemo(
    () =>
      selectedFlag
        ? selectedWorks(logData, data).filter(({ commit }) =>
            isRowVisible(commit, view.types),
          )
        : [],
    [selectedFlag, logData, data, view.types],
  );
  const pointers = useMemo(
    () =>
      selected.length > 0 ? selectedPointers(selected, locale) : undefined,
    [selected, locale],
  );
  const selectedTitle = useMemo(() => {
    const group = logData.groups?.find((g) => g.id === SELECTED_GROUP_ID);
    return group
      ? localize(group.title, locale)
      : t(locale, "logSelectedWorks");
  }, [logData, locale]);

  const commit = useCallback(
    (next: { types?: FilterableCommitType[]; form?: LogForm }) => {
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

  // Facet counts are of the UNFILTERED timeline, so a chip's number never
  // moves as you select — it answers "how much of this is there?", not "how
  // much survived what I just did?", which is the question the rows answer.
  //
  // The question it answers precisely is "how many rows does tapping this
  // chip print?", which is why each commit is asked against its own type
  // rather than against no filter at all. For every type but one the two
  // are the same sentence; for `role` they are not, because a suppressed
  // role un-suppresses under its own chip (see `isRowVisible`) and a count
  // of 2 over a column of 9 is just a wrong number.
  //
  // Counted over `data` rather than the raw log, because `data` is what the
  // timeline renders — locale filtered and grouped under a tag that exists.
  // A count derived from a different array is a count that can disagree with
  // the rows under it.
  const facets = useMemo<TypeFacet[]>(() => {
    // Per type: how many rows, and every distinct `icon` override they carry.
    // One override and the chip can wear it; more than one (or none) and it
    // falls back to the type's own mark.
    const seen = new Map<
      FilterableCommitType,
      { count: number; icons: Set<string | undefined> }
    >();

    for (const { commits } of data) {
      for (const c of commits) {
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
  }, [data]);

  // The chapters, as the pinned bar names them when it wears one.
  // Chapters that overlap share a block; each wears its own marker in turn.
  const chapters = useMemo(
    () =>
      data.flatMap(({ members }, i) =>
        members.map((tag, k) => ({
          id: tag.id,
          label: chapterLabel(tag, k === 0 ? i : -1, locale),
        })),
      ),
    [data, locale],
  );

  // Whether the log has anything to print under the current filter — the same
  // question every TagBlock asks itself before rendering, so the end marker
  // and the rows can never disagree. (They used to: this check knew about the
  // filter but not about `hideRow`, so a filter matching only suppressed rows
  // printed `git init` over an empty page.)
  const hasMatches = useMemo(
    () =>
      data.some(({ commits }) =>
        commits.some((c) => isRowVisible(c, view.types)),
      ),
    [data, view.types],
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
          form={view.form}
          onFormChange={(form) => commit({ form })}
          chapters={chapters}
        />
      }
    >
      {/* The directory: which projects there are, before when. */}
      {shelf && (view.types.length === 0 || view.types.includes("project")) && (
        <ProjectShelf
          projects={projects}
          locale={locale}
          onSelectHash={selectHash}
        />
      )}

      {/* The flagships, whole (the `selected` flag) — under the shelf when
          both are on: the directory names every project, this prints a
          few of them in full. */}
      {selected.length > 0 && (
        <SelectedWorks
          works={selected}
          title={selectedTitle}
          locale={locale}
          identities={logData.identities}
          form={view.form}
          activeTypes={view.types}
          onSelectHash={selectHash}
          fold={fold}
        />
      )}

      {/* Git Log Timeline */}
      <LogTimeline
        data={data}
        locale={locale}
        identities={logData.identities}
        form={view.form}
        activeTypes={view.types}
        onSelectHash={selectHash}
        pinnedChapters
        refLook={refLook}
        fold={fold}
        pointers={pointers}
      />

      {/* End marker — `git init` closes a timeline that has commits in it;
          a filter that matched nothing says so in the same slot, in the same
          voice, rather than leaving the page to end in silence. */}
      <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, hasMatches ? "logInit" : "logNoMatches")}
      </div>
    </PageLayout>
  );
}
