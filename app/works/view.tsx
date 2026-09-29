"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { chapterLabel, LogTimeline } from "@/components/log/log-timeline";
import { WorksToolbar, type TypeFacet } from "@/components/log/works-toolbar";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import type { RowPointer } from "@/components/log/timeline-commit";
import { t, useLocale } from "@/services";
import {
  buildTimelineData,
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  isFilterableCommitType,
  isRowVisible,
  type Commit,
  type FilterableCommitType,
  type LogData,
  type TimelineData,
} from "@/lib/log";
import {
  parseViewState,
  serializeViewState,
  toggleType,
  type LogForm,
} from "@/lib/log-view";
import {
  buildSelectedWorks,
  printedAtId,
  ProjectMark,
  SelectedWorks,
  TierHeading,
} from "./selected";

interface WorksViewProps {
  logData: LogData;
}

// -----------------------------------------------------------------------------
// The fragment, as a store
//
// A permalink is `/works#<hash>` (use-commit-anchor.ts), and the anchor hook
// travels to it by itself on a load and on `hashchange`. The page reads the
// fragment too, for the two things the hook cannot do: open what hides the
// row (a type filter — the row is not on the page to travel to), and hear
// an arrival that fires no event at all — the router moves to `/works#<hash>`
// from /works itself (a magic link in the About sheet, say) with
// `pushState`, which fires neither `hashchange` nor `popstate`. So it is
// re-read a frame after any click as well.
// -----------------------------------------------------------------------------

const COMMIT_HASH = /^#[0-9a-f]{7}$/;

function subscribeHash(onChange: () => void) {
  let frame = 0;
  const afterClick = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(onChange);
  };
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  document.addEventListener("click", afterClick, true);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    document.removeEventListener("click", afterClick, true);
  };
}
const readHash = () => window.location.hash;
const readNoHash = () => "";

/** The row a permalink names, if the page has it at all (a commit listed
 *  for the other locale does not). */
function commitAt(data: TimelineData[], hash: string): Commit | null {
  for (const { commits } of data) {
    const found = commits.find((c) => computeCommitHash(c.id) === hash);
    if (found) return found;
  }
  return null;
}

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const data = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );
  // The top of the page: the flagship commits, and what hangs off each.
  const selected = useMemo(
    () => buildSelectedWorks(logData, locale),
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
  const hash = useSyncExternalStore(subscribeHash, readHash, readNoHash);

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

  // The commit a permalink asked for, once it is on the page. Set on
  // arrival only — on hydration (the server rendered without a fragment),
  // by the back button, or by a link on this very page.
  const [travel, setTravel] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState(hash);
  if (hash !== lastHash) {
    setLastHash(hash);
    if (COMMIT_HASH.test(hash)) {
      const at = hash.slice(1);
      setTravel(at);
      // Open what hides it. A filter that leaves the commit out is cleared,
      // because the link asked for that commit, and a reader cannot see why
      // a page would refuse it.
      const target = commitAt(data, at);
      if (target && !isRowVisible(target, view.types)) {
        setView({ ...view, types: [] });
      }
    }
  }

  const selectHash = useCommitAnchor();

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

  // A filter cleared for a permalink is written back to the URL the way a
  // chip's is, with the fragment kept: the link is why the filter went, and
  // a reload should land where this did.
  const target = travel ? commitAt(data, travel) : null;
  const opened =
    !!target &&
    !isRowVisible(target, urlView.types) &&
    isRowVisible(target, view.types);
  useEffect(() => {
    if (!opened) return;
    const query = serializeViewState(
      view,
      new URLSearchParams(searchParams.toString()),
    );
    router.replace(
      (query ? `${pathname}?${query}` : pathname) + window.location.hash,
      { scroll: false },
    );
  }, [opened, view, searchParams, router, pathname]);

  // Travel once the row is rendered and measured: gated on the webfonts for
  // the reason the anchor hook's own arrival is (their swap moves every
  // row), and without a history entry — whoever asked has written the URL.
  // On a cold load the hook arrives by itself as well; it takes the two
  // requests for one.
  //
  // Once per arrival: a filter tapped afterwards is not a reason to pull
  // the reader back to a row they have since scrolled away from.
  const travelled = useRef<string | null>(null);
  useEffect(() => {
    if (!travel || travelled.current === travel) return;
    let cancelled = false;
    let frame = 0;
    const whenReady = document.fonts?.ready ?? Promise.resolve();
    void whenReady.then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        travelled.current = travel;
        selectHash(travel, { push: false });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [travel, selectHash]);

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
  // the rows under it. (The selected works are among those rows: each keeps
  // its slot in the log as a pointer, so it is counted once, as it is
  // printed once.)
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

  // Whether the page leads with the selected works under this filter — the
  // same question SelectedWorks asks itself. When it does, the log under it
  // takes a heading of its own, so the page reads as one document in two
  // parts; when a filter has stepped the selected works aside, the log is
  // the page, and needs no heading to say so.
  const leads = selected.works.some((c) => isRowVisible(c, view.types));

  // A selected work keeps its slot in the log, as a pointer up to where it
  // is printed: the chronology stays whole, the tenure rail and the
  // connectors that attach to it still have their row, and nothing is said
  // in full twice.
  const selectedIds = useMemo(
    () => new Set(selected.works.map((c) => c.id)),
    [selected],
  );
  const pointerLabel = `↑ ${t(locale, "worksPrintedAbove")}`;
  const pointerFor = useCallback(
    (c: Commit): RowPointer | null =>
      selectedIds.has(c.id)
        ? { to: printedAtId(c), label: pointerLabel }
        : null,
    [selectedIds, pointerLabel],
  );
  // Every project wears its logo, the one it wears at the top of the page
  // and on the About.
  const markFor = useCallback(
    (c: Commit) =>
      c.type === "project" ? (
        <ProjectMark commit={c} locale={locale} className="align-[-0.2em]" />
      ) : null,
    [locale],
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
      <SelectedWorks
        data={selected}
        commits={logData.commits}
        locale={locale}
        form={view.form}
        types={view.types}
        onSelectHash={selectHash}
      />

      {leads && hasMatches && (
        <TierHeading className="!mb-3">{t(locale, "worksLogTitle")}</TierHeading>
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
        markFor={markFor}
        pointerFor={pointerFor}
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
