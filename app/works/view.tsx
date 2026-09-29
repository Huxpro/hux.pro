"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { scrollPageTo } from "vitre";
import { PageLayout } from "@/components/ui/page-layout";
import { chapterLabel, LogTimeline } from "@/components/log/log-timeline";
import { WorksToolbar, type TypeFacet } from "@/components/log/works-toolbar";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import { PlacesReading } from "@/components/log/places";
import { PlacesBar, ReadingSwitch } from "@/components/log/reading-switch";
import { t, useLocale } from "@/services";
import type { Locale } from "@/lib/i18n";
import {
  buildTimelineData,
  FILTERABLE_COMMIT_TYPES,
  isFilterableCommitType,
  isRowVisible,
  type FilterableCommitType,
  type Identity,
  type LogData,
  type TimelineData,
} from "@/lib/log";
import {
  DEFAULT_FORM,
  parseViewState,
  serializeViewState,
  toggleType,
  type LogForm,
  type LogReading,
  type LogViewState,
} from "@/lib/log-view";

// =============================================================================
// Two readings of one log (lib/log-view.ts): the places, which the page opens
// on, and the log itself. The query string says which, the way it already
// said which filter and which form — and a commit's permalink says it too,
// because a `#hash` names a row and only the log has rows.
// =============================================================================

/** A commit permalink: `#` and the 7 hex digits of `computeCommitHash`. */
const COMMIT_HASH = /^#[0-9a-f]{7}$/;

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * Whether the address points at a commit. Read from the location rather than
 * held in state, so a link from the palette or the identity card into
 * `/works#hash` — cold, or from the places — lands in the log on its first
 * client frame rather than one effect late. The server has no hash, so it
 * renders the reading the query names, and hydration takes it from there.
 */
function useCommitInAddress(): boolean {
  return useSyncExternalStore(
    subscribeHash,
    () => COMMIT_HASH.test(window.location.hash),
    () => false,
  );
}

interface WorksViewProps {
  logData: LogData;
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

  const commitInAddress = useCommitInAddress();
  const reading: LogReading = commitInAddress ? "log" : view.reading;

  const commit = useCallback(
    (next: Partial<LogViewState>) => {
      // `reading` as it is on screen, not as the query last said it: a chip
      // tapped in a log that a `#hash` opened is still a chip in the log.
      const merged = { ...view, reading, ...next };
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
    [view, reading, searchParams, router, pathname],
  );

  const switchReading = useCallback(
    (next: LogReading) => {
      if (next === reading) return;
      // Leaving the log leaves its permalink behind: the hash names a row
      // the places don't have, and while it is in the address it holds the
      // log open. Dropped before the state changes, so the render that
      // follows already reads an address without it.
      if (commitInAddress) {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
      }
      // The places carry no filter and no form (their URL is the bare one),
      // so leaving the log lets go of both: coming back is the log as it
      // opens, not a filter the address no longer mentions.
      commit(
        next === "places"
          ? { reading: next, types: [], form: DEFAULT_FORM }
          : { reading: next },
      );
      // The other reading starts at its top, not at whatever depth the one
      // being left was scrolled to.
      scrollPageTo(0);
    },
    [reading, commitInAddress, commit],
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

  if (reading === "places") {
    return (
      <PageLayout
        page="works"
        pinnedActions={
          <PlacesBar locale={locale} reading={reading} onChange={switchReading} />
        }
      >
        <PlacesReading log={logData} locale={locale} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      page="works"
      pinnedActions={
        <WorksToolbar
          locale={locale}
          lead={
            <ReadingSwitch
              locale={locale}
              reading={reading}
              onChange={switchReading}
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
      <LogReadingBody
        data={data}
        locale={locale}
        identities={logData.identities}
        form={view.form}
        types={view.types}
        hasMatches={hasMatches}
      />
    </PageLayout>
  );
}

/**
 * The log, as it always was. Its own component so the permalink hook mounts
 * with the rows it travels to: arriving from the places — a `#hash` followed,
 * or the switch — its first look for the row happens once the row exists,
 * not on a page that had none.
 */
function LogReadingBody({
  data,
  locale,
  identities,
  form,
  types,
  hasMatches,
}: {
  data: TimelineData[];
  locale: Locale;
  identities?: Record<string, Identity>;
  form: LogForm;
  types: FilterableCommitType[];
  hasMatches: boolean;
}) {
  const selectHash = useCommitAnchor();

  return (
    <>
      {/* Git Log Timeline */}
      <LogTimeline
        data={data}
        locale={locale}
        identities={identities}
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
