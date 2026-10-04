"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { chapterLabel, LogTimeline } from "@/components/log/log-timeline";
import { useOptionalDevtool, WORKS_REF_DEFAULT } from "@/systems/devtool";
import { ProjectShelf } from "@/components/log/project-shelf";
import { WorksToolbar, type TypeFacet } from "@/components/log/works-toolbar";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import { t, useLocale } from "@/services";
import {
  FILTERABLE_COMMIT_TYPES,
  isFilterableCommitType,
  isRowVisible,
  type FilterableCommitType,
  type LogData,
} from "@/lib/log";
import {
  DEFAULT_FORM,
  LOG_FORMS,
  parseViewState,
  serializeViewState,
  toggleType,
  type LogForm,
} from "@/lib/log-view";
import { buildEraTimeline } from "@/lib/log-eras";
import { arrangeTalks, WORKS_TALKS_DEFAULT } from "@/lib/works-talks";

interface WorksViewProps {
  logData: LogData;
}

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // How a project carries its talks, on trial in the DevTool's Works module
  // (lib/works-talks.ts). Read before the data, since it rearranges the rows.
  const talksLook = useOptionalDevtool()?.worksTalks ?? WORKS_TALKS_DEFAULT;
  const data = useMemo(
    () => arrangeTalks(buildEraTimeline(logData, locale), talksLook, locale),
    [logData, locale, talksLook],
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
  // route, which costs about a second. That is far too long for a control you
  // tap three times in a row to find the view you want. So local state paints
  // immediately and the URL follows, which is also what makes the chips feel
  // like switches rather than links.
  const [view, setView] = useState(urlView);
  const [lastUrlKey, setLastUrlKey] = useState(urlKey);
  if (urlKey !== lastUrlKey) {
    setLastUrlKey(urlKey);
    // Adopt the URL only when it is a different reading. Our own
    // replace() landing is not news, and re-adopting it would hand every
    // consumer a fresh `types` array for no reason. (React's "adjusting
    // state when a prop changes" pattern, as used by TimelineCommit.)
    if (urlKey !== serializeViewState(view)) setView(urlView);
  }

  const selectHash = useCommitAnchor();

  // How a chapter's ref sits on the graph. On trial, as a saved setting in
  // the DevTool's Works module.
  const devtool = useOptionalDevtool();
  const refLook = devtool?.worksRef ?? WORKS_REF_DEFAULT;
  // The projects shelf, on trial: a saved DevTool setting, off by default.
  const shelf = devtool?.worksShelf ?? false;
  // The feed, on its way out: offered only while the DevTool switches it on.
  // Off, its stop leaves the control, and a `?view=feed` link (or one left
  // in the URL from before) reads as the default form, the URL untouched.
  const feed = devtool?.worksFeed ?? false;
  const forms = useMemo<readonly LogForm[]>(
    () => (feed ? LOG_FORMS : LOG_FORMS.filter((f) => f !== "feed")),
    [feed],
  );
  const form: LogForm = forms.includes(view.form) ? view.form : DEFAULT_FORM;
  // The shelf's projects: every project row the log prints, in the log's
  // own order (newest first across the chapters). It stands only while
  // the reading includes projects: a page filtered to talks opens on
  // talks, not on a directory of something it is not showing.
  const projects = useMemo(
    () => data.flatMap(({ commits }) => commits.filter((c) => c.type === "project")),
    [data],
  );

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
  // moves as you select. It answers "how much of this is there?", not "how
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
  // timeline renders: locale filtered and grouped under a tag that exists.
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

  // Whether the log has anything to print under the current filter. It is the
  // same question every TagBlock asks itself before rendering, so the end marker
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
          form={form}
          forms={forms}
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

      {/* Git Log Timeline */}
      <LogTimeline
        data={data}
        locale={locale}
        identities={logData.identities}
        form={form}
        activeTypes={view.types}
        onSelectHash={selectHash}
        pinnedChapters
        refLook={refLook}
      />

      {/* End marker. `git init` closes a timeline that has commits in it;
          a filter that matched nothing says so in the same slot, in the same
          voice, rather than leaving the page to end in silence. */}
      <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, hasMatches ? "logInit" : "logNoMatches")}
      </div>
    </PageLayout>
  );
}
