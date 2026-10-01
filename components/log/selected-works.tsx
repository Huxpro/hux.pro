"use client";

// =============================================================================
// Selected works — the head of /works under the `selected` flag
// (components/log/works-flags.ts).
//
// The log answers "what happened, when" and leaves "what are the main works"
// to be found around its twelfth row. With the flag on, the handful of
// flagship projects lead the page, each printed whole — its mark, name,
// years, the role and team it was done in, its description at a reading
// rung, and where to see it — and the log follows, otherwise as it was.
//
// The entries are not a second rendering of the work: each is the log's own
// row (TimelineCommit, through `Commit`) in its `lead` presentation, so what
// a row can wear, an entry wears too. And each flagship keeps its slot in
// the log as a one-line pointer (`↑ selected works`, TimelineCommit's
// `pointer`), so it is printed in full exactly once while the chronology,
// the tenure rail and the connectors keep the slot they are drawn through.
// The ways between the two:
//
//   - the hash, on the entry or the pointer, is the commit's permalink, and
//     a permalink lands on the entry (`useCommitAnchor` follows a pointer);
//   - a press on the pointer is the same;
//   - the entry's years go down to its slot, among what else was going on.
//
// The page's controls mean the same up here: a type chip that is not the
// flagships' hides the head (and the log then is exactly the log without
// the flag — view.tsx passes no pointers), and the form sets the entries'
// picture as it sets every row's — their links as text in the index, the
// strip of covers, the grid and the notes in the feed.
//
// With `fold` on too, a flagship's fold line (its talks and press) hangs
// under its entry here rather than under its pointer, and opens here into
// the log's own rows: a project's talks live in one place.
//
// The curation is data: the `works-selected` group in content/log.json, in
// the shape the home widgets' groups use, `hidden` so the home grid does not
// grow a card for it.
// =============================================================================

import { useMemo, type MouseEvent } from "react";
import { t, type Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  isRowVisible,
  localize,
  localizeOptional,
  resolveIdentity,
  type Commit as CommitData,
  type FilterableCommitType,
  type Identity,
  type LogData,
  type Media,
  type RoleCommit,
  type TimelineData,
} from "@/lib/log";
import type { LogForm } from "@/lib/log-view";
import {
  attachmentSetFor,
  linkTarget,
  useOptionalAttachments,
} from "@/systems/attachments";
import { computeBylines, type Byline } from "./bylines";
import { Commit } from "./commit-embed";
import { FoldLine } from "./fold-line";
import type { LogFold } from "./log-timeline";
import type { RowLead, RowPointer } from "./timeline-commit";
import type { CommitAnchorOptions } from "./use-commit-anchor";

/** The curated group in content/log.json the head is made of. */
export const SELECTED_GROUP_ID = "works-selected";

/** A flagship, with the chapter it sits in (for its role, its fold). */
export interface SelectedWork {
  commit: CommitData;
  chapter: TimelineData;
}

/**
 * The flagships, in the group's order, as the log has them: the same commit
 * objects, from the same `buildTimelineData`, so a flagship the log does not
 * print in this locale is not printed here either, and the hash, the fold
 * and the pointer all agree on which commit is which.
 */
export function selectedWorks(
  logData: LogData,
  data: readonly TimelineData[],
): SelectedWork[] {
  const group = logData.groups?.find((g) => g.id === SELECTED_GROUP_ID);
  if (!group || !("commitIds" in group) || !group.commitIds) return [];
  return group.commitIds.flatMap((id) => {
    for (const chapter of data) {
      const commit = chapter.commits.find((c) => c.id === id);
      if (commit) return [{ commit, chapter }];
    }
    return [];
  });
}

/** Where an entry is printed: the id its pointer in the log names. */
export function selectedEntryId(commit: CommitData): string {
  return `selected-${computeCommitHash(commit.id)}`;
}

/** Each shown flagship's pointer, by id — what the log's slots print. */
export function selectedPointers(
  works: readonly SelectedWork[],
  locale: Locale,
): Map<string, RowPointer> {
  const label = t(locale, "logSelectedPointer");
  return new Map(
    works.map(({ commit }) => [
      commit.id,
      { to: selectedEntryId(commit), label },
    ]),
  );
}

// ── The entry's lines ────────────────────────────────────────────────────────

const month = (d: string) => d.slice(0, 7);
const OPEN_END = "9999-12";

/**
 * The role I held for the whole of a work, or null.
 *
 * Tenure inference (`resolveIdentity`) answers "who was I when this was
 * dated", which is right for a byline and wrong for a title: a work dated
 * inside an internship can outlive it by a decade. A role only speaks for a
 * work it contains end to end, and says nothing about the rest.
 */
function roleOwning(
  commit: CommitData,
  chapter: CommitData[],
): RoleCommit | null {
  const role = resolveIdentity(commit, chapter)?.role;
  if (!role) return null;
  const start = month(commit.date);
  const end = !commit.endDate
    ? start
    : commit.endDate === "present"
      ? OPEN_END
      : month(commit.endDate);
  const roleEnd =
    !role.endDate || role.endDate === "present"
      ? OPEN_END
      : month(role.endDate);
  return month(role.date) <= start && end <= roleEnd ? role : null;
}

/** `Architect · Lynx @ ByteDance`: the role, then the team it was done in. */
function whoOf(
  commit: CommitData,
  chapter: CommitData[],
  locale: Locale,
): string | null {
  const role = roleOwning(commit, chapter);
  const team = localizeOptional(commit.team ?? role?.team, locale);
  const who = [role ? localize(role.title, locale) : null, team]
    .filter(Boolean)
    .join(" · ");
  return who || null;
}

/**
 * A word for each thing a work attaches, for its links in the index.
 *
 * Derived, never authored: a recording is named for where it plays, a deck
 * is a deck, and a page is named for the site it is on — which is what a
 * reader deciding whether to click wants to know. Two pages on one site
 * take their first path segment as well (`react.dev/blog`,
 * `react.dev/learn`), so no two words in a row are the same word.
 */
function mediaLabels(items: Media[], locale: Locale): string[] {
  const where = (m: Media) => {
    try {
      const url = new URL(linkTarget(m, locale), "https://hux.pro");
      return {
        host: url.host.replace(/^www\./, ""),
        segment: url.pathname.split("/").filter(Boolean)[0] ?? "",
      };
    } catch {
      return { host: "", segment: "" };
    }
  };
  const base = items.map((m) => {
    switch (m.kind) {
      case "video":
        return m.platform;
      case "slides":
        return t(locale, "logSlides").toLowerCase();
      case "image":
        return t(locale, "logView").toLowerCase();
      default: {
        const { host, segment } = where(m);
        // This site's own pages go by what they are, not by our domain.
        return host === "hux.pro" ? segment || host : host;
      }
    }
  });
  return base.map((label, i) => {
    if (base.indexOf(label) === base.lastIndexOf(label)) return label;
    const { segment } = where(items[i]);
    return segment ? `${label}/${segment}` : label;
  });
}

/** A plain click is ours; a modified one is the browser's (a new tab). */
const isPlainClick = (e: MouseEvent) =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/**
 * The index's picture of a work: its links, as quiet text — /prompt's link
 * row. Each opens where its cover would (systems/attachments: the theater,
 * the in-app browser, the sheet on a phone) and stays a real link, so a
 * modified click or a page without the provider still goes there.
 */
function WorkLinks({ commit, locale }: { commit: CommitData; locale: Locale }) {
  const attachments = useOptionalAttachments();
  const media = commit.media ?? [];
  const set = useMemo(() => attachmentSetFor(commit, locale), [commit, locale]);
  if (media.length === 0) return null;
  const labels = mediaLabels(media, locale);
  return (
    <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
      {media.map((m, i) => (
        <a
          key={`${m.url}-${i}`}
          href={linkTarget(m, locale)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!attachments || !set || !isPlainClick(e)) return;
            e.preventDefault();
            attachments.open(set, i);
          }}
          className="underline decoration-ink-line underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground"
        >
          {labels[i]}
        </a>
      ))}
    </p>
  );
}

// ── The head ─────────────────────────────────────────────────────────────────

interface SelectedWorksProps {
  /** The flagships to print — already the ones the filter shows. */
  works: readonly SelectedWork[];
  /** The heading: the group's own title. */
  title: string;
  locale: Locale;
  identities?: Record<string, Identity>;
  /** The page's form and filter — the same two the log reads. */
  form: LogForm;
  activeTypes: readonly FilterableCommitType[];
  /** The page's permalink handler (`useCommitAnchor`). */
  onSelectHash: (hash: string, opts?: CommitAnchorOptions) => void;
  /** The `fold` flag's state, when it is on: the flagships' folds hang here. */
  fold?: LogFold;
}

export function SelectedWorks({
  works,
  title,
  locale,
  identities,
  form,
  activeTypes,
  onSelectHash,
  fold,
}: SelectedWorksProps) {
  if (works.length === 0) return null;
  return (
    <section aria-labelledby="works-selected-title" className="mb-12 sm:mb-14">
      {/* /prompt's section face: serif, a step under the page title. */}
      <h2
        id="works-selected-title"
        className="mb-3 font-serif text-xl sm:text-2xl text-foreground"
      >
        {title}
      </h2>
      <div className="space-y-3">
        {works.map((work) => (
          <SelectedEntry
            key={work.commit.id}
            work={work}
            locale={locale}
            identities={identities}
            form={form}
            activeTypes={activeTypes}
            onSelectHash={onSelectHash}
            fold={fold}
          />
        ))}
      </div>
    </section>
  );
}

function SelectedEntry({
  work: { commit, chapter },
  locale,
  identities,
  form,
  activeTypes,
  onSelectHash,
  fold,
}: Omit<SelectedWorksProps, "works" | "title"> & { work: SelectedWork }) {
  const hash = computeCommitHash(commit.id);
  const lead = useMemo<RowLead>(
    () => ({
      id: selectedEntryId(commit),
      who: whoOf(commit, chapter.commits, locale),
      links: <WorkLinks commit={commit} locale={locale} />,
      // To the slot itself, not through it back up here; and not a new
      // address — this is going to see where the work sits, not naming it.
      onDate: () => onSelectHash(hash, { follow: false, push: false }),
      dateTitle: t(locale, "logSelectedInLog"),
    }),
    [commit, chapter, locale, hash, onSelectHash],
  );

  // What folds under it (the `fold` flag), as far as the filter lets
  // through — the same rule as a fold in the log (TagBlock).
  const rows = useMemo(
    () =>
      fold
        ? chapter.commits.filter(
            (c) => fold.of.get(c.id) === commit.id && isRowVisible(c, activeTypes),
          )
        : [],
    [fold, chapter, commit, activeTypes],
  );
  // Their bylines are the log's (a role is found in the chapter), each
  // quiet at rest: the entry above already says who did the work, so a
  // handle on the first talk under it would only say it again.
  const bylines = useMemo(() => {
    const byId = new Map<string, Byline>();
    if (rows.length === 0) return byId;
    const all = computeBylines(chapter.commits, identities, locale);
    chapter.commits.forEach((c, i) => {
      const b = all[i];
      if (b && rows.includes(c)) byId.set(c.id, { ...b, isClusterHead: false });
    });
    return byId;
  }, [rows, chapter, identities, locale]);
  const open = !!fold && fold.isOpen(commit.id);

  return (
    <div>
      <Commit
        commit={commit}
        locale={locale}
        variant="timeline"
        form={form}
        onSelectHash={onSelectHash}
        lead={lead}
      />
      {fold && rows.length > 0 && (
        <>
          <FoldLine
            rows={rows}
            open={open}
            rail={false}
            locale={locale}
            onToggle={() => fold.onToggle(commit.id)}
          />
          {open &&
            rows.map((c) => (
              <Commit
                key={c.id}
                commit={c}
                locale={locale}
                variant="timeline"
                hideDate={chapter.tag.hideDate || c.hideDate}
                byline={bylines.get(c.id) ?? null}
                form={form}
                onSelectHash={onSelectHash}
              />
            ))}
        </>
      )}
    </div>
  );
}
