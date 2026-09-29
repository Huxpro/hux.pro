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
import { scrollPageTo } from "vitre";
import { PageLayout } from "@/components/ui/page-layout";
import { chapterLabel, LogTimeline } from "@/components/log/log-timeline";
import {
  SelectedToolbar,
  WorksToolbar,
  type TypeFacet,
} from "@/components/log/works-toolbar";
import { TYPE } from "@/lib/typography";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import { t, useLocale } from "@/services";
import {
  buildTimelineData,
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  getCommitTypePluralLabel,
  isCommitVisibleIn,
  isFilterableCommitType,
  isRowVisible,
  type Commit,
  type FilterableCommitType,
  type LogData,
} from "@/lib/log";
import {
  parseViewState,
  serializeViewState,
  toggleType,
  type LogForm,
  type LogViewState,
  type WorksReading,
} from "@/lib/log-view";
import { SelectedWorks, WORKS_SECTION_IDS } from "./selected";

interface WorksViewProps {
  logData: LogData;
}

// -----------------------------------------------------------------------------
// The fragment, as a store
//
// A permalink is `/works#<hash>` (use-commit-anchor.ts), and every one written
// before the selected reading existed — the magic links in posts, the identity
// card, the home widgets' rows — means "that commit, in the log". The fragment
// never reaches the server or the query codec, so the page reads it here and
// lets a commit hash open the log. Subscribed to `hashchange` and `popstate`
// so the back button onto a permalink lands in the log too — and re-read a
// frame after any click, because the router moves to `/works#<hash>` from
// /works itself (a magic link in the About sheet, say) with `pushState`,
// which fires neither.
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

/** The URL's reading, with a commit permalink counted as a vote for the log. */
function withHash(view: LogViewState, hash: string): LogViewState {
  return COMMIT_HASH.test(hash) && view.reading !== "log"
    ? { ...view, reading: "log" }
    : view;
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
  const [view, setView] = useState(() => withHash(urlView, hash));
  const [lastUrlKey, setLastUrlKey] = useState(urlKey);
  const [lastHash, setLastHash] = useState(hash);
  if (urlKey !== lastUrlKey) {
    setLastUrlKey(urlKey);
    // Adopt the URL only when it is genuinely a different reading — our own
    // replace() landing is not news, and re-adopting it would hand every
    // consumer a fresh `types` array for no reason. (React's "adjusting
    // state when a prop changes" pattern, as used by TimelineCommit.)
    if (urlKey !== serializeViewState(view)) setView(urlView);
  }
  // The commit the log owes a travel to, once it is on the page.
  const [travel, setTravel] = useState<string | null>(null);
  if (hash !== lastHash) {
    setLastHash(hash);
    // A permalink arriving — on hydration (the server rendered without
    // one), by the back button, or by a link on this very page — opens the
    // log at it. Only on arrival: a reader who then chooses the selected
    // works has answered the hash.
    if (COMMIT_HASH.test(hash)) {
      if (view.reading !== "log") setView({ ...view, reading: "log" });
      setTravel(hash.slice(1));
    }
  }

  const selectHash = useCommitAnchor();

  // Travel once the log is rendered and measured. Gated on the webfonts for
  // the reason the anchor hook's own arrival is (their swap moves every
  // row), and without a history entry: whoever asked has written the URL.
  // On a cold load the hook arrives by itself as well; it takes the two
  // requests for one.
  //
  // Once per commit: the fragment of a name's `?view=log#<hash>` is written
  // by the router in its own time, and it landing is the same arrival
  // again, not a reason to pull the reader back to a row they have since
  // scrolled away from. Leaving the log clears the request (`setReading`),
  // so the switch back starts the log at its top, and the same permalink
  // arriving later is an arrival again.
  const travelled = useRef<string | null>(null);
  useEffect(() => {
    if (!travel) {
      travelled.current = null;
      return;
    }
    if (view.reading !== "log" || travelled.current === travel) return;
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
  }, [travel, view.reading, selectHash]);

  const commit = useCallback(
    (
      next: Partial<LogViewState>,
      { hash, push = false }: { hash?: string; push?: boolean } = {},
    ) => {
      const merged = { ...view, ...next };
      setView(merged);
      const query = serializeViewState(
        merged,
        new URLSearchParams(searchParams.toString()),
      );
      const url =
        (query ? `${pathname}?${query}` : pathname) + (hash ? `#${hash}` : "");
      // `replace`, not `push`: toggling four chips to find the right view
      // should not cost four taps of the back button to undo. Opening the
      // log at a commit is the exception — that is going somewhere, and
      // back should bring you back.
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [view, searchParams, router, pathname],
  );

  // The two readings are two pages, so changing between them starts the
  // new one from its top rather than at wherever the old one was scrolled.
  const setReading = useCallback(
    (reading: WorksReading) => {
      if (reading === view.reading) return;
      commit({ reading });
      // Leaving the log spends whatever it was opened at, so the same
      // permalink arriving again later is an arrival again.
      if (reading === "selected") setTravel(null);
      scrollPageTo(0);
    },
    [commit, view.reading],
  );

  // A name on the selected page: the log, travelled to that commit.
  const openLogAt = useCallback(
    (target?: Commit) => {
      if (!target) return setReading("log");
      const at = computeCommitHash(target.id);
      commit({ reading: "log" }, { hash: at, push: true });
      setTravel(at);
    },
    [commit, setReading],
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

  // The selected page's list tiers, as its bar offers them. The tiers that
  // are one row a work — the ones worth jumping to past the fold.
  const sections = useMemo(() => {
    const visible = logData.commits.filter((c) => isCommitVisibleIn(c, locale));
    return (["talk", "press"] as const)
      .map((type) => ({
        id: WORKS_SECTION_IDS[type === "talk" ? "talks" : "press"],
        label: getCommitTypePluralLabel(type, locale),
        count: visible.filter((c) => c.type === type).length,
      }))
      .filter((s) => s.count > 0);
  }, [logData, locale]);

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

  if (view.reading === "selected") {
    return (
      <PageLayout
        page="works"
        pinnedActions={
          <SelectedToolbar
            locale={locale}
            onReadingChange={setReading}
            sections={sections}
          />
        }
      >
        <SelectedWorks
          logData={logData}
          locale={locale}
          onOpenLog={openLogAt}
        />
      </PageLayout>
    );
  }

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
          onFormChange={(form: LogForm) => commit({ form })}
          chapters={chapters}
        />
      }
    >
      {/* The way back to the selected works. Not in the bar: the bar is the
          log's own, already spends a phone's whole width, and is left as it
          was. Here it is the first thing under it, in the back link's voice,
          and the browser's back does the same after a name opened the log. */}
      <div className="-mt-2 mb-6 sm:mb-8">
        <a
          href={pathname}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            setReading("selected");
          }}
          className={TYPE.nav}
        >
          ← {t(locale, "worksBackToSelected")}
        </a>
      </div>

      {/* Git Log Timeline */}
      <LogTimeline
        data={data}
        locale={locale}
        identities={logData.identities}
        form={view.form}
        activeTypes={view.types}
        onSelectHash={selectHash}
        pinnedChapters
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
