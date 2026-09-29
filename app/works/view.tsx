"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pageScrollTop, scrollPageTo } from "vitre";
import { PageLayout } from "@/components/ui/page-layout";
import { chapterLabel, LogTimeline } from "@/components/log/log-timeline";
import { WorksToolbar, type TypeFacet } from "@/components/log/works-toolbar";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import {
  ProjectsToolbar,
  ReadingSwitch,
  type WorksSection,
} from "@/components/works/reading-bar";
import { WorksIndexView } from "@/components/works/works-index";
import { t, useLocale } from "@/services";
import type { Locale } from "@/lib/i18n";
import {
  buildTimelineData,
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  isFilterableCommitType,
  isRowVisible,
  type FilterableCommitType,
  type LogData,
  type TimelineData,
} from "@/lib/log";
import {
  parseViewState,
  serializeViewState,
  toggleType,
  type LogForm,
  type WorksReading,
} from "@/lib/log-view";
import { buildWorksIndex } from "@/lib/works-index";

interface WorksViewProps {
  logData: LogData;
}

/** A commit permalink (`#1a2b3c4`) — see `computeCommitHash`. */
const COMMIT_HASH = /^#[0-9a-f]{7}$/;

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const data = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );

  // The projects reading (lib/works-index.ts): the same log, read as a
  // resume.
  const index = useMemo(
    () => buildWorksIndex(logData, locale),
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

  const commit = useCallback(
    (next: {
      reading?: WorksReading;
      types?: FilterableCommitType[];
      form?: LogForm;
    }) => {
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

  // Switching readings is switching pages in all but address: the new one
  // starts at its top, not at whatever depth the old one was read to.
  const changeReading = useCallback(
    (reading: WorksReading) => {
      if (reading === view.reading) return;
      commit({ reading });
      if (pageScrollTop() > 0) scrollPageTo(0);
    },
    [commit, view.reading],
  );

  // A commit permalink is an address in the log: every `/works#hash` on the
  // site (a home widget's row, an identity card, a badge on a desk) was
  // written when the log was the page, and means the row there. The hash is
  // not in the query string, so it is read here, on arrival and on change;
  // the log's own anchor hook (in `WorksLog`) travels to the row once the
  // log has mounted.
  const hashes = useMemo(
    () => new Set(logData.commits.map((c) => `#${computeCommitHash(c.id)}`)),
    [logData],
  );
  useEffect(() => {
    const land = () => {
      const hash = window.location.hash;
      if (!COMMIT_HASH.test(hash) || !hashes.has(hash)) return;
      // Local state only: the hash is the address, and `?view=log` beside
      // it would be a second one saying the same thing.
      setView((v) => (v.reading === "log" ? v : { ...v, reading: "log" }));
    };
    land();
    window.addEventListener("hashchange", land);
    return () => window.removeEventListener("hashchange", land);
  }, [hashes]);

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
  const chapters = useMemo(
    () =>
      data.map(({ tag }, i) => ({
        id: tag.id,
        label: chapterLabel(tag, i, locale),
      })),
    [data, locale],
  );

  // What the projects reading holds, for its bar — the marks and the words
  // the log's chips use, so the two readings name things the same way.
  const sections = useMemo<WorksSection[]>(
    () =>
      (
        [
          {
            id: "projects",
            type: "project",
            count: index.lead.length + index.more.length,
          },
          { id: "talks", type: "talk", count: index.talks.length },
          { id: "press", type: "press", count: index.press.length },
        ] satisfies WorksSection[]
      ).filter((s) => s.count > 0),
    [index],
  );

  if (view.reading === "projects") {
    return (
      <PageLayout
        page="works"
        pinnedActions={
          <ProjectsToolbar
            locale={locale}
            onReadingChange={changeReading}
            sections={sections}
          />
        }
      >
        <WorksIndexView index={index} locale={locale} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      page="works"
      pinnedActions={
        <WorksToolbar
          locale={locale}
          leading={
            <ReadingSwitch
              locale={locale}
              reading="log"
              onChange={changeReading}
              compact
            />
          }
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
      <WorksLog
        data={data}
        locale={locale}
        logData={logData}
        types={view.types}
        form={view.form}
      />
    </PageLayout>
  );
}

/**
 * The log reading, as it has always been: the timeline and its end marker.
 * Its own component so the permalink hook mounts with the rows it travels
 * to — a hash that switched the page into the log finds them there.
 */
function WorksLog({
  data,
  locale,
  logData,
  types,
  form,
}: {
  data: TimelineData[];
  locale: Locale;
  logData: LogData;
  types: FilterableCommitType[];
  form: LogForm;
}) {
  const selectHash = useCommitAnchor();

  // Whether the log has anything to print under the current filter — the same
  // question every TagBlock asks itself before rendering, so the end marker
  // and the rows can never disagree. (They used to: this check knew about the
  // filter but not about `hideRow`, so a filter matching only suppressed rows
  // printed `git init` over an empty page.)
  const hasMatches = useMemo(
    () =>
      data.some(({ commits }) => commits.some((c) => isRowVisible(c, types))),
    [data, types],
  );

  return (
    <>
      {/* Git Log Timeline */}
      <LogTimeline
        data={data}
        locale={locale}
        identities={logData.identities}
        form={form}
        activeTypes={types}
        onSelectHash={selectHash}
        pinnedChapters
      />

      {/* End marker — `git init` closes a timeline that has commits in it;
          a filter that matched nothing says so in the same slot, in the same
          voice, rather than leaving the page to end in silence. */}
      <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, hasMatches ? "logInit" : "logNoMatches")}
      </div>
    </>
  );
}
