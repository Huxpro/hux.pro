"use client";

/**
 * Selected works — the reading of /works a newcomer meets (lib/log-view.ts).
 *
 * The log is a complete record and a poor introduction: thirty-odd commits
 * at one weight, newest first, so the question a visitor actually arrives
 * with — what are this person's most important works, what did they do on
 * each, when, and where can I see it? — was answered somewhere around the
 * twelfth row, under a cover tile, in two clamped lines of tertiary ink.
 *
 * This page answers it in tiers, the way a printed CV or a good projects
 * page does, and the hierarchy comes from how much is written rather than
 * from boxes:
 *
 *   Selected works   a handful of works, each a name, who I was on it, a
 *                    paragraph of prose at reading size, and where to see it
 *   More projects    the rest, one line each — name, team, years
 *   Talks            one line each — title, venue, date
 *   Press            the same
 *
 * The curation is data, not code: the `works-selected` group in
 * content/log.json names the works, in the same shape the home widgets'
 * groups use (and `hidden`, so the home grid does not grow a card for it).
 * Everything else is derived — the tiers are the rest of the log sorted by
 * type, and a row's meta is read off the fields the log already prints.
 *
 * Every row that is a commit keeps its address in the log: a name opens the
 * log at that commit, where the covers, the commentary and the byline are.
 * A talk's title instead plays it, because for a talk the recording is the
 * work; its row in the log is one tap further, from the log itself.
 */

import { useMemo, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, type Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  getCommitLanguageBadge,
  getCommitTypePluralLabel,
  isCommitVisibleIn,
  localize,
  localizeOptional,
  resolveGroupCommits,
  resolveIdentity,
  sortCommitsByDate,
  type Commit,
  type LogData,
  type Media,
  type RoleCommit,
} from "@/lib/log";
import {
  attachmentSetFor,
  linkTarget,
  useOptionalAttachments,
} from "@/systems/attachments";
import { BadgeMark, commitBadge } from "@/components/magic-link";
import { CommitIcon } from "@/components/log/icons";

/** The curated group in content/log.json this page leads with. */
export const SELECTED_GROUP_ID = "works-selected";

/** Section anchors — the bar's jumps land on these (SelectedToolbar). */
export const WORKS_SECTION_IDS = {
  selected: "works-selected",
  projects: "works-projects",
  talks: "works-talks",
  press: "works-press",
} as const;

/** A commit's row in the log: the log reading, travelled to that commit. */
export function logHrefFor(commit: Commit): string {
  return `/works?view=log#${computeCommitHash(commit.id)}`;
}

// =============================================================================
// Derivation
// =============================================================================

export interface SelectedWorksData {
  title: string;
  selected: Commit[];
  projects: Commit[];
  talks: Commit[];
  press: Commit[];
}

/**
 * The page's tiers from the log. Visibility is the log's own
 * (`isCommitVisibleIn`), so a commit listed for one locale only is listed
 * here for that locale only, and nothing can be on this page that the log
 * would not show.
 */
export function buildSelectedWorks(
  logData: LogData,
  locale: Locale,
): SelectedWorksData {
  const group = logData.groups?.find((g) => g.id === SELECTED_GROUP_ID);
  const selected = group
    ? resolveGroupCommits(group, logData.commits, undefined, locale)
    : [];
  const picked = new Set(selected.map((c) => c.id));
  const visible = sortCommitsByDate(
    logData.commits.filter((c) => isCommitVisibleIn(c, locale)),
  );
  return {
    title: group
      ? localize(group.title, locale)
      : t(locale, "logSelectedWorks"),
    selected,
    projects: visible.filter((c) => c.type === "project" && !picked.has(c.id)),
    talks: visible.filter((c) => c.type === "talk"),
    press: visible.filter((c) => c.type === "press"),
  };
}

const month = (d: string) => d.slice(0, 7);
const OPEN_END = "9999-12";

/**
 * The role I held for the whole of a work, or null.
 *
 * Tenure inference (`resolveIdentity`) answers "who was I when this was
 * dated", which is right for a byline and wrong for a title: Hux Blog is
 * dated inside an Alibaba internship and has outlived it by a decade. A
 * role only speaks for a work it contains end to end — Architect for Lynx,
 * the visiting lead for Ele.me — and says nothing about the rest.
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

/** `2023 – present`, `2017`, `2014 – 2015`: years only, as written. */
function yearsOf(commit: Commit, locale: Locale): string {
  const start = commit.date.slice(0, 4);
  if (!commit.endDate) return start;
  if (commit.endDate === "present")
    return `${start} – ${locale === "zh" ? "至今" : "present"}`;
  const end = commit.endDate.slice(0, 4);
  return end === start ? start : `${start} – ${end}`;
}

/** `nov 2025` / `2025年11月` — the /writing list's date, in the same case.
 *  Read in UTC: the data is a month, and a local midnight west of Greenwich
 *  is the last day of the month before. */
function monthOf(date: string, locale: Locale): string {
  const d = new Date(/^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date);
  const s = d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return locale === "zh" ? s : s.toLowerCase();
}

/** Where a row happened: a talk's venue, the platform a piece ran on, the
 *  team a project was built in. Null when it would repeat the title. */
function venueOf(commit: Commit, title: string, locale: Locale): string | null {
  const venue =
    commit.type === "talk"
      ? commit.conference.name
      : commit.type === "press"
        ? commit.platform
        : localizeOptional(commit.team, locale);
  return venue && venue !== title ? venue : null;
}

/**
 * A word for each thing a work attaches, as the row of links under it.
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

// =============================================================================
// Opening a piece of media where the log would
// =============================================================================

/**
 * The click handler that sends a work's attachment to its home — the
 * theater, the in-app browser, the lightbox, or the sheet on a phone
 * (systems/attachments) — exactly as its cover in the log would. The element
 * stays a real link to the thing, so a modified click, a middle click or a
 * page without the provider still goes there.
 */
function useOpenMedia(locale: Locale) {
  const attachments = useOptionalAttachments();
  return (commit: Commit, index: number) => (e: MouseEvent) => {
    if (!attachments) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const set = attachmentSetFor(commit, locale);
    if (!set) return;
    e.preventDefault();
    attachments.open(set, index);
  };
}

/** The media a talk's title opens: its recording when it has one, else
 *  whatever it attaches first. */
function playableIndex(commit: Commit): number {
  const items = commit.media ?? [];
  const video = items.findIndex((m) => m.kind === "video");
  if (video >= 0) return video;
  const slides = items.findIndex((m) => m.kind === "slides");
  return slides >= 0 ? slides : items.length > 0 ? 0 : -1;
}

// =============================================================================
// The page
// =============================================================================

interface SelectedWorksProps {
  logData: LogData;
  locale: Locale;
  /**
   * Go to the log — at a commit, or (none given) at its top. The page's
   * own switch rather than a navigation: a route change costs a second
   * (see app/works/view.tsx), and this is one tap that should feel like
   * turning a page.
   */
  onOpenLog: (commit?: Commit) => void;
}

/** A plain click is ours; a modified one is the browser's (a new tab). */
const isPlainClick = (e: MouseEvent) =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

export function SelectedWorks({
  logData,
  locale,
  onOpenLog,
}: SelectedWorksProps) {
  const data = useMemo(
    () => buildSelectedWorks(logData, locale),
    [logData, locale],
  );
  const openMedia = useOpenMedia(locale);
  const inLog = (commit: Commit): RowLink => ({
    href: logHrefFor(commit),
    internal: true,
    hint: t(locale, "worksOpenInLog"),
    onClick: (e) => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      onOpenLog(commit);
    },
  });

  return (
    <div>
      <Section id={WORKS_SECTION_IDS.selected} title={data.title} first>
        <div className="space-y-9 sm:space-y-10">
          {data.selected.map((commit) => (
            <SelectedWork
              key={commit.id}
              commit={commit}
              commits={logData.commits}
              locale={locale}
              openMedia={openMedia}
              name={inLog(commit)}
            />
          ))}
        </div>
      </Section>

      {data.projects.length > 0 && (
        <Section
          id={WORKS_SECTION_IDS.projects}
          title={t(locale, "worksMoreProjects")}
        >
          <RowList>
            {data.projects.map((commit) => {
              const title = localize(commit.title, locale);
              return (
                <Row
                  key={commit.id}
                  mark={
                    <ProjectMark
                      commit={commit}
                      locale={locale}
                      className="align-[-0.2em]"
                    />
                  }
                  title={title}
                  venue={venueOf(commit, title, locale)}
                  badge={getCommitLanguageBadge(commit, locale)}
                  date={yearsOf(commit, locale)}
                  link={inLog(commit)}
                />
              );
            })}
          </RowList>
        </Section>
      )}

      {(["talks", "press"] as const).map((tier) => {
        const commits = data[tier];
        if (commits.length === 0) return null;
        return (
          <Section
            key={tier}
            id={WORKS_SECTION_IDS[tier]}
            title={getCommitTypePluralLabel(
              tier === "talks" ? "talk" : "press",
              locale,
            )}
          >
            <RowList>
              {commits.map((commit) => {
                const title = localize(commit.title, locale);
                const index = playableIndex(commit);
                const media = index >= 0 ? commit.media![index] : null;
                return (
                  <Row
                    key={commit.id}
                    title={title}
                    venue={venueOf(commit, title, locale)}
                    badge={getCommitLanguageBadge(commit, locale)}
                    date={monthOf(commit.date, locale)}
                    link={
                      media
                        ? {
                            href: linkTarget(media, locale),
                            onClick: openMedia(commit, index),
                          }
                        : inLog(commit)
                    }
                  />
                );
              })}
            </RowList>
          </Section>
        );
      })}

      {/* The end of the page hands on to the archive, in the slot and the
          voice the log closes with (`git init`). */}
      <p className="mt-16 py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, "worksArchiveLead")}{" "}
        <a
          href="/works?view=log"
          onClick={(e) => {
            if (!isPlainClick(e)) return;
            e.preventDefault();
            onOpenLog();
          }}
          className="text-muted-foreground underline decoration-ink-line underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground"
        >
          git log
        </a>
      </p>
    </div>
  );
}

// =============================================================================
// Pieces
// =============================================================================

/**
 * A tier: a serif heading — the /prompt section's face, a step under the
 * page title — and what it holds. Separated by space alone.
 */
function Section({
  id,
  title,
  first = false,
  children,
}: {
  id: string;
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(!first && "mt-14 sm:mt-16")}
    >
      <h2
        id={`${id}-title`}
        className="mb-4 sm:mb-5 font-serif text-xl sm:text-2xl text-foreground"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * One selected work, in four lines of intent:
 *
 *   Lynx Framework                              2023 – present
 *   Architect · Lynx @ ByteDance
 *   Open-source cross-platform UI framework behind TikTok, …
 *   lynxjs.org   github.com
 *
 * The name and the years are a list row's skeleton, so the tiers under it
 * read as the same grammar with less said. The second line is who I was on
 * it, the third is the log's description whole and at reading size, and
 * the last is where to see it.
 */
function SelectedWork({
  commit,
  commits,
  locale,
  openMedia,
  name,
}: {
  commit: Commit;
  commits: Commit[];
  locale: Locale;
  openMedia: ReturnType<typeof useOpenMedia>;
  /** Where the name goes: this commit in the log. */
  name: RowLink;
}) {
  const title = localize(commit.title, locale);
  const role = roleOwning(commit, commits);
  const team = localizeOptional(commit.team ?? role?.team, locale);
  const who = [role ? localize(role.title, locale) : null, team]
    .filter(Boolean)
    .join(" · ");
  const description = localize(commit.description, locale);
  const media = commit.media ?? [];
  const labels = mediaLabels(media, locale);

  return (
    <article className="relative">
      <div className="flex items-center justify-between gap-4">
        <h3 className="flex min-w-0 items-center text-base font-medium text-foreground">
          {/* The project's mark, at about twice the name's cap height. On a
              desk it hangs in the margin, where the log hangs its hash
              column, so every line of the entry keeps the column's edge;
              narrower, it leads the name. */}
          <ProjectMark
            commit={commit}
            locale={locale}
            className="text-[1.3rem] lg:absolute lg:top-px lg:-left-10"
          />
          <LinkTo
            link={name}
            className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-ink-line"
          >
            {title}
          </LinkTo>
        </h3>
        <span className={cn("shrink-0", TYPE.rowMeta)}>
          {yearsOf(commit, locale)}
        </span>
      </div>
      {who && <p className={cn("mt-1", TYPE.meta)}>{who}</p>}
      {description && (
        <p className="mt-2.5 text-sm sm:text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      )}
      {media.length > 0 && (
        <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          {media.map((m, i) => (
            <a
              key={`${m.url}-${i}`}
              href={linkTarget(m, locale)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openMedia(commit, i)}
              className="underline decoration-ink-line underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground"
            >
              {labels[i]}
            </a>
          ))}
        </p>
      )}
    </article>
  );
}

/**
 * A project's logo: the icon its `<Badge commit=…>` wears on the About
 * (components/magic-link), because a project is the protagonist of its row
 * and should look the same wherever it is named. Sized by the font size
 * around it, the way the badge is. A commit the badge resolver cannot find
 * falls back to the log's own project glyph, quietly.
 */
function ProjectMark({
  commit,
  locale,
  className,
}: {
  commit: Commit;
  locale: Locale;
  className?: string;
}) {
  const badge = commitBadge(commit.id, locale);
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 leading-none", className)}>
      {badge ? (
        <BadgeMark icon={badge.icon} kind={badge.kind} />
      ) : (
        <CommitIcon
          type="project"
          className="mr-[0.34em] size-[1.08em] text-tertiary-foreground"
        />
      )}
    </span>
  );
}

function RowList({ children }: { children: ReactNode }) {
  return <ul className="-mx-3">{children}</ul>;
}

/** Where a row goes: into the log (`internal`, with a hint saying so), or
 *  out to a piece of media — in both cases by the page's own hand. */
interface RowLink {
  href: string;
  internal?: boolean;
  hint?: string;
  onClick: (e: MouseEvent) => void;
}

/**
 * A /writing row, tightened: title left, date right, and between them the
 * venue in the metadata voice. Tighter than /writing's because a list of
 * nineteen talks should be one screen, not three — the rows are still a
 * full-width target.
 */
function Row({
  mark,
  title,
  venue,
  badge,
  date,
  link,
}: {
  /** Leads the title — a project's logo. Talks and press wear none: their
   *  venue says where, and nineteen platform marks would say it louder. */
  mark?: ReactNode;
  title: string;
  venue: string | null;
  badge: string | null;
  date: string;
  link: RowLink;
}) {
  const className =
    "pressable flex items-baseline justify-between gap-4 rounded-lg px-3 py-1.5 transition-colors duration-200 hover:bg-muted/50 active:bg-muted/60";
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={TYPE.rowTitle}>
          {mark}
          {title}
        </span>
        {/* An en space rather than a margin: it breaks like a space, so a
            venue that wraps starts flush on its own line. */}
        {" "}
        {(venue || badge) && (
          // One metadata run after the title: where, then — the same
          // mismatch hint the log and /writing print, silent when the talk
          // is in the reader's language — in what. Its own line on a phone;
          // on a wider column it follows the title and wraps as a whole,
          // never a venue broken across two lines.
          <span
            className={cn(
              "block sm:inline sm:whitespace-nowrap",
              TYPE.rowMeta,
            )}
          >
            {[venue, badge].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className={cn("shrink-0", TYPE.rowMeta)}>{date}</span>
    </>
  );
  return (
    <li>
      <LinkTo link={link} className={className}>
        {body}
      </LinkTo>
    </li>
  );
}

/**
 * A row's anchor. Always a real `href`, so a modified click, a middle click
 * or a copied link goes where the row says; a plain click is the page's own
 * (`onClick`): into the log, or to the attachment's home.
 */
function LinkTo({
  link,
  className,
  children,
}: {
  link: RowLink;
  className?: string;
  children: ReactNode;
}) {
  return link.internal ? (
    <a
      href={link.href}
      title={link.hint}
      onClick={link.onClick}
      className={className}
    >
      {children}
    </a>
  ) : (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={link.onClick}
      className={className}
    >
      {children}
    </a>
  );
}
