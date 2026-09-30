"use client";

// =============================================================================
// Works Overview — the `overview` form of /works (lib/log-view.ts).
//
// The log is a complete record and a poor introduction: thirty-odd commits
// at one weight, newest first, so the question a visitor actually arrives
// with — what are this person's most important works, what did they do on
// each, when, and where can I see it? — was answered somewhere around the
// twelfth row. The index form was meant to be the answer and was the same
// rows with less printed.
//
// This is that answer as a page, in tiers, the way a printed CV or a good
// projects page reads, and the hierarchy comes from how much is written
// rather than from boxes:
//
//   Selected works   a handful of works, each a name, who I was on it, a
//                    paragraph at reading size, and where to see it
//   More projects    the rest, one line each — name, team, years
//   Talks            one line each — title, venue, date
//   Press            the same
//
// The curation is data, not code: the `works-selected` group in
// content/log.json names the works, in the shape the home widgets' groups
// use, `hidden` so the home grid does not grow a card for it. Everything
// else is derived from what the log itself renders (`buildTimelineData`),
// so nothing is here that the log would not print in this locale.
//
// The page's controls mean the same here as in the log. A type chip keeps
// its tiers — `project` the two project tiers, `talk` the talks — and the
// chip's count is the number of rows it prints. Roles are the one tier the
// overview leaves out until asked for: the selected works' role lines speak
// for them, the way a tenure's cluster speaks for its hidden role row in the
// log, and asking for roles by name is asking for the rows (`isRowVisible`).
//
// Every row opens where the log's covers open it: a work's links, and a
// talk's or a piece of press's title, go to the attachment's home
// (systems/attachments — the theater, the in-app browser, the sheet on a
// phone). A project's name — and a row with nothing attached — goes to its
// commit in the log, the covers form, where the covers, the commentary and
// the byline are. And each row carries its commit's hash as its id, so
// `?view=overview#<hash>` lands on it the way `#<hash>` lands on a log row
// (`useCommitAnchor`).
// =============================================================================

import {
  useEffect,
  useEffectEvent,
  useMemo,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, type Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  FILTERABLE_COMMIT_TYPES,
  formatCommitDate,
  getCommitLanguageBadge,
  getCommitTypePluralLabel,
  isRowVisible,
  localize,
  localizeOptional,
  resolveIdentity,
  sortCommitsByDate,
  VIDEO_PLATFORM_LABEL,
  type Commit,
  type FilterableCommitType,
  type LogData,
  type Media,
  type RoleCommit,
  type TimelineData,
} from "@/lib/log";
import {
  attachmentSetFor,
  linkTarget,
  useOptionalAttachments,
} from "@/systems/attachments";
import { parseViewState } from "@/lib/log-view";
import { commitMark } from "@/components/magic-link/resolve";
import { ProjectMark } from "./project-mark";

/** The curated group in content/log.json the overview leads with. */
export const OVERVIEW_GROUP_ID = "works-selected";

// =============================================================================
// Derivation
// =============================================================================

interface OverviewTier {
  /** The type the tier lists — also what its heading is named for. */
  type: FilterableCommitType;
  title: string;
  commits: Commit[];
}

interface OverviewData {
  /** The selected works' heading: the group's own title. */
  title: string;
  selected: Commit[];
  tiers: OverviewTier[];
}

/**
 * Whether a type's tier is on the page. With no filter, every tier but the
 * roles' (see the header); with one, exactly the types asked for.
 */
function tierShown(
  type: FilterableCommitType,
  activeTypes: readonly FilterableCommitType[],
): boolean {
  return activeTypes.length === 0
    ? type !== "role"
    : activeTypes.includes(type);
}

/**
 * The overview's tiers from the log's own data — the same commits, in the
 * same locale — so a chip's count and the rows under it cannot disagree.
 */
function buildOverview(
  logData: LogData,
  data: readonly TimelineData[],
  activeTypes: readonly FilterableCommitType[],
  locale: Locale,
): OverviewData {
  const all = sortCommitsByDate(data.flatMap((d) => d.commits));
  const group = logData.groups?.find((g) => g.id === OVERVIEW_GROUP_ID);
  const ids = group && "commitIds" in group ? (group.commitIds ?? []) : [];
  const selected = tierShown("project", activeTypes)
    ? ids.flatMap((id) => all.filter((c) => c.id === id))
    : [];
  const picked = new Set(selected.map((c) => c.id));

  const tiers = FILTERABLE_COMMIT_TYPES.filter((type) =>
    tierShown(type, activeTypes),
  )
    .map((type) => ({
      type,
      // The projects the selected works did not take are "more"; with none
      // selected (no group, or a locale that lists none) they are just the
      // projects.
      title:
        type === "project" && selected.length > 0
          ? t(locale, "logOverviewMoreProjects")
          : getCommitTypePluralLabel(type, locale),
      commits: all.filter(
        (c) =>
          c.type === type && !picked.has(c.id) && isRowVisible(c, activeTypes),
      ),
    }))
    .filter((tier) => tier.commits.length > 0);

  return {
    title: group
      ? localize(group.title, locale)
      : t(locale, "logSelectedWorks"),
    selected,
    tiers,
  };
}

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
function roleOwning(commit: Commit, commits: Commit[]): RoleCommit | null {
  const role = resolveIdentity(commit, commits)?.role;
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
function whoOf(commit: Commit, commits: Commit[], locale: Locale): string {
  const role = roleOwning(commit, commits);
  const team = localizeOptional(commit.team ?? role?.team, locale);
  return [role ? localize(role.title, locale) : null, team]
    .filter(Boolean)
    .join(" · ");
}

/** Where a row happened — a talk's venue, the platform a piece ran on, the
 *  team a project was built in, the company a role was at. Null when it
 *  would only repeat the title. */
function venueOf(commit: Commit, title: string, locale: Locale): string | null {
  const venue =
    commit.type === "talk"
      ? commit.conference.name
      : commit.type === "post"
        ? commit.publication.name
        : commit.type === "press"
          ? commit.platform
          : commit.type === "role"
            ? localize(commit.company, locale)
            : commit.type === "project"
              ? localizeOptional(commit.team, locale)
              : undefined;
  return venue && venue !== title ? venue : null;
}

/**
 * A word for each thing a work attaches, for its row of links.
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
        return VIDEO_PLATFORM_LABEL[m.platform];
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

/** The attachment a talk's (or a piece of press's) title opens: its
 *  recording when it has one, then its deck, then whatever comes first. */
function leadIndex(commit: Commit): number {
  const items = commit.media ?? [];
  const video = items.findIndex((m) => m.kind === "video");
  if (video >= 0) return video;
  const slides = items.findIndex((m) => m.kind === "slides");
  return slides >= 0 ? slides : items.length > 0 ? 0 : -1;
}

/** A plain click is ours; a modified one is the browser's (a new tab). */
const isPlainClick = (e: MouseEvent) =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

// =============================================================================
// The page
// =============================================================================

/** Where a row goes. Always a real `href`, so a modified click, a middle
 *  click or a copied link goes where the row says; a plain click is the
 *  page's own (`onClick`). */
interface RowLink {
  href: string;
  /** Out to a piece of media — a new tab, when it is not taken. */
  external?: boolean;
  title?: string;
  onClick: (e: MouseEvent) => void;
}

interface WorksOverviewProps {
  logData: LogData;
  /** What the log renders — `buildTimelineData` for this locale. */
  data: readonly TimelineData[];
  locale: Locale;
  /** The page's type filter; empty is "no filter". */
  activeTypes: readonly FilterableCommitType[];
  /** The address of a commit (by hash) in the log, for a name's `href`. */
  logHrefFor: (hash: string) => string;
  /** Go there — the page's own switch rather than a route change, which
   *  costs about a second (see app/works/view.tsx). `replace` for a
   *  permalink that arrived here, and is only being carried on. */
  onOpenInLog: (hash: string, opts?: { replace?: boolean }) => void;
}

export function WorksOverview({
  logData,
  data,
  locale,
  activeTypes,
  logHrefFor,
  onOpenInLog,
}: WorksOverviewProps) {
  const overview = useMemo(
    () => buildOverview(logData, data, activeTypes, locale),
    [logData, data, activeTypes, locale],
  );
  // Every commit the log holds, roles included — what tenure inference
  // reads a work's role out of.
  const commits = useMemo(() => data.flatMap((d) => d.commits), [data]);
  const attachments = useOptionalAttachments();

  // A permalink that arrives here lands on its row (each carries its hash;
  // `useCommitAnchor` does the travel). One the overview does not print — a
  // role, an event, a work the filter leaves out — opens the log at it
  // instead, so `#<hash>` always lands on its commit.
  //
  // Only an arrival: the page loaded at an overview address with a hash, or
  // a hash landed while reading it. Not the overview being chosen from the
  // bar with an older hash still in it — the router takes that hash away a
  // moment later, and until then the URL still names the other form, which
  // is how the two are told apart.
  const landInLog = useEffectEvent(() => {
    const url = new URL(window.location.href);
    if (parseViewState(url.searchParams).form !== "overview") return;
    const hash = url.hash.slice(1);
    if (!/^[0-9a-f]{7}$/.test(hash) || document.getElementById(hash)) return;
    if (commits.some((c) => computeCommitHash(c.id) === hash)) {
      onOpenInLog(hash, { replace: true });
    }
  });
  useEffect(() => {
    // A frame late, outside React's commit, so the log it opens can be
    // painted synchronously for the anchor to measure.
    const frame = requestAnimationFrame(() => landInLog());
    const onHash = () => landInLog();
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const inLog = (commit: Commit): RowLink => {
    const hash = computeCommitHash(commit.id);
    return {
      href: logHrefFor(hash),
      title: t(locale, "logOverviewInLog"),
      onClick: (e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        onOpenInLog(hash);
      },
    };
  };

  /** An attachment, opened where its cover in the log would open it. */
  const toMedia = (commit: Commit, index: number): RowLink => ({
    href: linkTarget(commit.media![index], locale),
    external: true,
    onClick: (e) => {
      const set = attachments && attachmentSetFor(commit, locale);
      if (!set || !isPlainClick(e)) return;
      e.preventDefault();
      attachments.open(set, index);
    },
  });

  // A filter nothing matches says so, in the log's end-marker slot and voice.
  // (The same rows under the same filter as the log's, so the same answer.)
  if (overview.selected.length === 0 && overview.tiers.length === 0) {
    return (
      <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, "logNoMatches")}
      </div>
    );
  }

  return (
    <div>
      {overview.selected.length > 0 && (
        <Section title={overview.title} first>
          <div className="space-y-7 sm:space-y-8">
            {overview.selected.map((commit) => (
              <SelectedWork
                key={commit.id}
                commit={commit}
                locale={locale}
                who={whoOf(commit, commits, locale)}
                name={inLog(commit)}
                links={(commit.media ?? []).map((_, i) => toMedia(commit, i))}
              />
            ))}
          </div>
        </Section>
      )}

      {overview.tiers.map((tier, i) => (
        <Section
          key={tier.type}
          title={tier.title}
          first={i === 0 && overview.selected.length === 0}
        >
          <ul className="-mx-3">
            {tier.commits.map((commit) => {
              const title = localize(commit.title, locale);
              const lead = commit.type === "project" ? -1 : leadIndex(commit);
              return (
                <Row
                  key={commit.id}
                  hash={computeCommitHash(commit.id)}
                  mark={
                    commit.type === "project" ? (
                      <ProjectMark
                        icon={commitMark(commit, locale)}
                        className="mr-2 inline-block size-4 rounded-[4px] align-[-0.2em]"
                      />
                    ) : null
                  }
                  title={title}
                  venue={venueOf(commit, title, locale)}
                  badge={getCommitLanguageBadge(commit, locale)}
                  date={formatCommitDate(commit, locale)}
                  link={lead >= 0 ? toMedia(commit, lead) : inLog(commit)}
                />
              );
            })}
          </ul>
        </Section>
      ))}
    </div>
  );
}

// =============================================================================
// Pieces
// =============================================================================

/**
 * A tier: a serif heading — /prompt's section face, a step under the page
 * title — and what it holds. Separated by space alone.
 */
function Section({
  title,
  first = false,
  children,
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn(!first && "mt-12 sm:mt-14")}>
      <h2 className="mb-3 sm:mb-4 font-serif text-xl sm:text-2xl text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The anchor a permalink lands on: the commit's hash as the id, and the
 * attributes `useCommitAnchor` looks for — `data-rail-row` to know it for a
 * commit's row, `data-row-trigger` for where the arrival wash paints.
 */
const anchorProps = (hash: string) => ({ id: hash, "data-rail-row": "" });

/**
 * One selected work, in three lines of intent:
 *
 *   ▣ Lynx Framework       Architect · Lynx @ ByteDance   2023 – Present
 *     Open-source cross-platform UI framework behind TikTok, …
 *     lynxjs.org   github.com
 *
 * The first is the log's title line (docs/system-attachments.md, "The
 * title line"): the name, then — in a column before the date, packed to the
 * edge — who I was on it, the way a log row prints its venue there. So
 * nothing stands between the name and its sentence; below `@md` the same
 * two are an eyebrow over the name, as a log row's are. The second is the
 * log's description whole and at reading size — this tier is the one that
 * says the most, so it is the one written larger — and the last is where
 * to see it.
 */
function SelectedWork({
  commit,
  locale,
  who,
  name,
  links,
}: {
  commit: Commit;
  locale: Locale;
  who: string;
  /** Where the name goes: this commit in the log. */
  name: RowLink;
  /** One per attachment, in order. */
  links: RowLink[];
}) {
  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const labels = mediaLabels(commit.media ?? [], locale);

  return (
    <article {...anchorProps(computeCommitHash(commit.id))} className="@container">
      <div data-row-trigger className="-mx-3 rounded-lg px-3 py-1">
        {/* The eyebrow, below `@md`: who, then the years at the right edge,
            over the name — clear of the mark, in the name's column. */}
        {who && (
          <p
            className={cn(
              "@md:hidden mb-0.5 flex items-baseline gap-2 pl-[30px] leading-4",
              TYPE.rowMeta,
            )}
          >
            <span className="min-w-0 flex-1">{who}</span>
            <span className="ml-auto shrink-0">
              {formatCommitDate(commit, locale)}
            </span>
          </p>
        )}
        <div className="flex items-baseline gap-2">
          <h3 className="min-w-0 flex-1 text-base font-medium text-foreground">
            {/* The project's mark — the face its row wears in the log, at
                the name's size. */}
            <ProjectMark
              icon={commitMark(commit, locale)}
              className="mr-2.5 inline-block size-5 rounded-[5px] align-[-0.25em]"
            />
            <LinkTo
              link={name}
              className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-ink-line"
            >
              {title}
            </LinkTo>
          </h3>
          {/* Wider than a log row's venue column (55%): a selected work's
              name is short, and who I was on it is the point of the tier,
              so it gets the room to print whole. */}
          <span
            className={cn(
              "ml-auto min-w-0 max-w-[70%] shrink items-baseline justify-end gap-2",
              who ? "hidden @md:flex" : "flex",
            )}
          >
            {who && (
              <span className={cn("min-w-0 truncate", TYPE.rowMeta)}>{who}</span>
            )}
            <span className={cn("shrink-0", TYPE.rowMeta)}>
              {formatCommitDate(commit, locale)}
            </span>
          </span>
        </div>
        {description && (
          <p className={cn("mt-1 text-pretty", TYPE.body)}>{description}</p>
        )}
        {links.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
            {links.map((link, i) => (
              <LinkTo
                key={i}
                link={link}
                className="underline decoration-ink-line underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground"
              >
                {labels[i]}
              </LinkTo>
            ))}
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * The log's title line, as a one-liner (the `index` row): the title, its
 * language mismatch hint after it, and — packed to the right edge — the
 * venue in a column before the date (docs/system-attachments.md, "The
 * title line"). Below `@md` the venue and the date are an eyebrow over the
 * title, as a log row's are, so the venue is never under the title and
 * never cut to a column. Tighter than /writing's rows because a list of
 * nineteen talks should be one screen, not three — the row is still a
 * full-width target.
 */
function Row({
  hash,
  mark,
  title,
  venue,
  badge,
  date,
  link,
}: {
  hash: string;
  /** Leads the title — a project's mark. Talks and press wear none: their
   *  venue says where, and nineteen platform marks would say it louder. */
  mark: ReactNode;
  title: string;
  venue: string | null;
  badge: string | null;
  date: string;
  link: RowLink;
}) {
  return (
    <li {...anchorProps(hash)} className="@container">
      <LinkTo
        link={link}
        data-row-trigger
        className="pressable block rounded-lg px-3 py-1.5 transition-colors duration-200 hover:bg-muted/50 active:bg-muted/60"
      >
        {venue && (
          <span
            className={cn(
              "@md:hidden mb-0.5 flex items-baseline gap-2 leading-4",
              // In the title's column, clear of a project's mark.
              mark && "pl-6",
              TYPE.rowMeta,
            )}
          >
            <span className="min-w-0 flex-1">{venue}</span>
            <span className="ml-auto shrink-0">{date}</span>
          </span>
        )}
        <span className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1", TYPE.rowTitle)}>
            {mark}
            {title}
            {badge && (
              // The same mismatch hint the log and /writing print after a
              // title, silent when the work is in the reader's language.
              <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>
                {badge}
              </span>
            )}
          </span>
          <span
            className={cn(
              "ml-auto min-w-0 max-w-[55%] shrink items-baseline justify-end gap-2",
              venue ? "hidden @md:flex" : "flex",
            )}
          >
            {venue && (
              <span className={cn("min-w-0 truncate", TYPE.rowMeta)}>{venue}</span>
            )}
            <span className={cn("shrink-0", TYPE.rowMeta)}>{date}</span>
          </span>
        </span>
      </LinkTo>
    </li>
  );
}

function LinkTo({
  link,
  className,
  children,
  ...rest
}: {
  link: RowLink;
  className?: string;
  children: ReactNode;
  "data-row-trigger"?: boolean;
}) {
  return (
    <a
      href={link.href}
      title={link.title}
      onClick={link.onClick}
      {...(link.external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : null)}
      data-row-trigger={rest["data-row-trigger"] ? "" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}
