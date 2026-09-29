"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { WorksToolbar, type TypeFacet } from "@/components/log/works-toolbar";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import {
  openByDefault,
  projectMatches,
  WorksIndexView,
} from "@/components/works/works-index";
import { ProjectIcon } from "@/components/works/project-icon";
import { YearRail } from "@/components/works/year-rail";
import { useLocale } from "@/services";
import {
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  isFilterableCommitType,
  isRowVisible,
  type FilterableCommitType,
  type LogData,
} from "@/lib/log";
import {
  parseViewState,
  serializeViewState,
  toggleType,
  type LogForm,
} from "@/lib/log-view";
import { buildWorksIndex } from "@/lib/works-index";

interface WorksViewProps {
  logData: LogData;
}

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // The page, as data (lib/works-index.ts): the projects, what each one's
  // history holds, and the rows no project claims.
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

  // Which projects the reader has opened or closed by hand: a deviation
  // from the depth the page stands at (`openByDefault`), kept as the set of
  // ids that differ from it. A new form or filter is a new default, so the
  // deviations are spent — the same rule a row's own press follows
  // (TimelineCommit) — reconciled during render, so no frame paints the
  // old ones against the new depth.
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const viewKey = serializeViewState(view);
  const [lastViewKey, setLastViewKey] = useState(viewKey);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setFlipped(new Set());
  }

  const projects = useMemo(
    () => [...index.lead, ...index.more],
    [index],
  );
  const byId = useMemo(
    () => new Map(projects.map((e) => [e.commit.id, e])),
    [projects],
  );

  const isOpen = useCallback(
    (id: string) => {
      const entry = byId.get(id);
      if (!entry) return false;
      const base = openByDefault(
        entry.history,
        entry.commit,
        view.form,
        view.types,
      );
      return flipped.has(id) ? !base : base;
    },
    [byId, view.form, view.types, flipped],
  );

  const toggle = useCallback((id: string) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  // A commit permalink (`#1a2b3c4`) is an address in the log, and every
  // `/works#hash` on the site (a home widget's row, an identity card, a
  // badge on a desk) still means that row. Its row may be inside a project
  // nobody has opened: then the project opens — by hand, as far as the
  // page is concerned, so a later filter tap folds it again — and the
  // anchor travels once the row has mounted.
  const homeOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, home] of index.home) {
      map.set(`#${computeCommitHash(id)}`, home);
    }
    return map;
  }, [index]);
  const reveal = useCallback(
    (hash: string) => {
      const home = homeOf.get(hash);
      if (!home || !byId.has(home) || isOpen(home)) return false;
      toggle(home);
      return true;
    },
    [homeOf, byId, isOpen, toggle],
  );
  const selectHash = useCommitAnchor(reveal);

  // Facet counts are of the UNFILTERED page, so a chip's number never
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
  // Counted over `index.context` — every commit the locale shows, which is
  // every row the page can print, each in exactly one place.
  const facets = useMemo<TypeFacet[]>(() => {
    // Per type: how many rows, and every distinct `icon` override they carry.
    // One override and the chip can wear it; more than one (or none) and it
    // falls back to the type's own mark.
    const seen = new Map<
      FilterableCommitType,
      { count: number; icons: Set<string | undefined> }
    >();

    for (const c of index.context) {
      if (!isFilterableCommitType(c.type)) continue;
      if (!isRowVisible(c, [c.type])) continue;
      const entry = seen.get(c.type) ?? { count: 0, icons: new Set() };
      entry.count += 1;
      entry.icons.add(c.icon);
      seen.set(c.type, entry);
    }

    return FILTERABLE_COMMIT_TYPES.filter((t) => seen.has(t)).map((type) => {
      const { count, icons } = seen.get(type)!;
      return {
        type,
        count,
        iconOverride: icons.size === 1 ? [...icons][0] : undefined,
      };
    });
  }, [index]);

  // The markers the pinned bar's ref slot hands over at: each open project,
  // named as the branch it is and wearing its icon, and the end of its
  // history, where the slot goes back to `main`.
  const chapters = useMemo(
    () =>
      projects
        .filter(
          (e) => projectMatches(e, view.types) && isOpen(e.commit.id),
        )
        .flatMap((e) => [
          {
            id: e.commit.id,
            label: e.commit.id,
            mark: (
              <ProjectIcon
                commit={e.commit}
                monogram={e.monogram}
                locale={locale}
                className="size-3.5"
                small
              />
            ),
          },
          { id: `${e.commit.id}/end` },
        ]),
    [projects, view.types, isOpen, locale],
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
      <WorksIndexView
        index={index}
        locale={locale}
        form={view.form}
        types={view.types}
        identities={logData.identities}
        isOpen={isOpen}
        onToggle={toggle}
        onSelectHash={selectHash}
      />
      <YearRail index={index} types={view.types} />
    </PageLayout>
  );
}
