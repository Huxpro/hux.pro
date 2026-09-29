"use client";

/**
 * Selected works — the top of /works, and the top of its log.
 *
 * The log is a complete record and a poor introduction: thirty-odd commits
 * at one weight, newest first, so the question a visitor actually arrives
 * with — what are this person's most important works, what did they do on
 * each, when, and where can I see it? — was answered somewhere around the
 * twelfth row, under a cover tile, in two clamped lines of tertiary ink.
 *
 * So the page leads with the handful of commits that answer it, printed
 * open, and the log follows in the same scroll (lib/log-view.ts). These are
 * not a second rendering of the work beside the log: they are its flagship
 * commits at the shallowest depth, the prose a CV would print, with
 *
 *   - the log's own controls: a type chip that is not theirs hides them,
 *     and the form sets their picture as it sets every row's — their links
 *     as text in the index, their covers, their grid and notes in the feed;
 *   - their own history hanging off them: the talks and press about each
 *     one, counted (`10 talks`) and unfolding in place into their rows,
 *     every one of them a way down into the log at its hash;
 *   - their place in the log kept: each leaves a one-line pointer in its
 *     slot there (TimelineCommit's `pointer`), and the pointer, the entry's
 *     permalink, and its years are the ways between the two depths.
 *
 * The curation is data, not code: the `works-selected` group in
 * content/log.json names the works, in the same shape the home widgets'
 * groups use (and `hidden`, so the home grid does not grow a card for it).
 * What hangs off each one is derived (`hangingOff`).
 */

import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, type Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  getCommitLanguageBadge,
  getCommitTypeLabel,
  getCommitTypePluralLabel,
  isCommitVisibleIn,
  isRowVisible,
  localize,
  localizeOptional,
  resolveGroupCommits,
  resolveIdentity,
  sortCommitsByDate,
  type Commit,
  type CommitType,
  type FilterableCommitType,
  type LogData,
  type Media,
  type RoleCommit,
} from "@/lib/log";
import { ROW_FORM, type LogForm } from "@/lib/log-view";
import type { CommitAnchorOptions } from "@/components/log/use-commit-anchor";
import {
  attachmentSetFor,
  linkTarget,
  useOptionalAttachments,
} from "@/systems/attachments";
import { useInputCapability } from "@/services";
import { BadgeMark, commitBadge } from "@/components/magic-link";
import { CommitIcon } from "@/components/log/icons";
import { normalizeCommit } from "@/components/log/commit-data";
import { Commentary } from "@/components/log/embeds/shared";
import { AttachmentGrid } from "@/components/log/media/attachment-grid";
import { MediaStrip } from "@/components/log/media/media-strip";

/** The curated group in content/log.json this page leads with. */
export const SELECTED_GROUP_ID = "works-selected";

/** Where a selected work is printed: the id its log row points at. */
export function printedAtId(commit: Commit): string {
  return `selected-${computeCommitHash(commit.id)}`;
}

// =============================================================================
// Derivation
// =============================================================================

export interface SelectedWorksData {
  title: string;
  works: Commit[];
  /** Per work (by id): what hangs off it, newest first. */
  hanging: ReadonlyMap<string, Commit[]>;
}

/** The types that hang off a work — the ones that are *about* one. */
const HANGING_TYPES: readonly CommitType[] = ["talk", "post", "press"];

/** Tags compared as words: `Cross Platform` is `Cross-Platform`. */
const word = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * What a work is about, in the words its satellites are tagged with: its
 * name — the title's first word, which is what a talk about it is tagged
 * (`Lynx`, `React`, `Ele.me`) — and its first tag, the one its author put
 * first (`PWA` for Ele.me, whose talks never name it).
 */
function topicsOf(work: Commit): Set<string> {
  const name = word(work.title.en.split(/\s+/)[0] ?? "");
  const first = work.tags?.[0];
  return new Set([name, first ? word(first) : ""].filter(Boolean));
}

const monthsApart = (a: string, b: string) =>
  Math.abs(
    Number(a.slice(0, 4)) * 12 +
      Number(a.slice(5, 7)) -
      (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))),
  );

/**
 * Which talks, posts and press hang off which work. Derived, so a talk
 * filed tomorrow finds its project without anyone curating it:
 *
 *   1. attached to the work (`attachedTo`) — the author said so;
 *   2. otherwise, in the work's chapter and tagged with what it is about
 *      (`topicsOf`) — the most such tags wins, the nearer in time breaks
 *      a tie (a PWA talk in 2017 is Ele.me's, not the blog's).
 *
 * Each commit hangs off one work at most, so no count double-counts.
 */
function hangingOff(
  works: Commit[],
  commits: Commit[],
): Map<string, Commit[]> {
  const byId = new Map(works.map((w) => [w.id, w]));
  const topics = new Map(works.map((w) => [w.id, topicsOf(w)]));
  const hanging = new Map<string, Commit[]>(works.map((w) => [w.id, []]));

  for (const c of commits) {
    if (!HANGING_TYPES.includes(c.type) || byId.has(c.id)) continue;
    let best: { work: Commit; score: number } | null = null;
    if (typeof c.attachedTo === "string" && byId.has(c.attachedTo)) {
      best = { work: byId.get(c.attachedTo)!, score: Infinity };
    } else {
      const tags = new Set((c.tags ?? []).map(word));
      for (const work of works) {
        if (work.tagId !== c.tagId) continue;
        let score = 0;
        for (const topic of topics.get(work.id)!) if (tags.has(topic)) score++;
        if (score === 0) continue;
        if (
          !best ||
          score > best.score ||
          (score === best.score &&
            monthsApart(c.date, work.date) <
              monthsApart(c.date, best.work.date))
        ) {
          best = { work, score };
        }
      }
    }
    if (best) hanging.get(best.work.id)!.push(c);
  }
  return hanging;
}

/**
 * The page's top tier from the log. Visibility is the log's own
 * (`isCommitVisibleIn`), so a commit listed for one locale only is counted
 * for that locale only, and nothing can be here that the log would not show.
 */
export function buildSelectedWorks(
  logData: LogData,
  locale: Locale,
): SelectedWorksData {
  const group = logData.groups?.find((g) => g.id === SELECTED_GROUP_ID);
  const works = group
    ? resolveGroupCommits(group, logData.commits, undefined, locale)
    : [];
  const visible = sortCommitsByDate(
    logData.commits.filter((c) => isCommitVisibleIn(c, locale)),
  );
  return {
    title: group
      ? localize(group.title, locale)
      : t(locale, "logSelectedWorks"),
    works,
    hanging: hangingOff(works, visible),
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
 *  publication a post ran in. Null when it would repeat the title. */
function venueOf(commit: Commit, title: string): string | null {
  const venue =
    commit.type === "talk"
      ? commit.conference.name
      : commit.type === "press"
        ? commit.platform
        : commit.type === "post"
          ? commit.publication.name
          : null;
  return venue && venue !== title ? venue : null;
}

/**
 * The count a work carries, in the metadata voice: `10 talks · 2 press`,
 * or `演讲 10 · 媒体 2` — the chip row's own order of word and number.
 */
function countLine(commits: Commit[], locale: Locale): string {
  return HANGING_TYPES.map((type) => {
    const n = commits.filter((c) => c.type === type).length;
    if (n === 0) return null;
    if (locale === "zh") return `${getCommitTypeLabel(type, locale)} ${n}`;
    const noun =
      n === 1
        ? getCommitTypeLabel(type, locale)
        : getCommitTypePluralLabel(type, locale);
    return `${n} ${noun.toLowerCase()}`;
  })
    .filter(Boolean)
    .join(" · ");
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
    if (!isPlainClick(e)) return;
    const set = attachmentSetFor(commit, locale);
    if (!set) return;
    e.preventDefault();
    attachments.open(set, index);
  };
}
type OpenMedia = ReturnType<typeof useOpenMedia>;

/** The media a talk's title opens: its recording when it has one, else
 *  whatever it attaches first. */
function playableIndex(commit: Commit): number {
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
// The tier
// =============================================================================

/**
 * A tier's heading: a serif line — the /prompt section's face, a step under
 * the page title. The selected works wear it, and so does the log where it
 * follows them, so the page reads as one document in two parts.
 */
export function TierHeading({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "mb-4 sm:mb-5 font-serif text-xl sm:text-2xl text-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}

interface SelectedWorksProps {
  data: SelectedWorksData;
  /** Every commit, for the role a work was done in. */
  commits: Commit[];
  locale: Locale;
  /** The page's form and filter (lib/log-view.ts) — the same two the log
   *  reads, so the bar means one thing from the top of the page down. */
  form: LogForm;
  types: readonly FilterableCommitType[];
  /** Travel to a commit (useCommitAnchor): a row that hangs off a work, or
   *  the work's own place in the log. */
  onSelectHash: (hash: string, opts?: CommitAnchorOptions) => void;
}

export function SelectedWorks({
  data,
  commits,
  locale,
  form,
  types,
  onSelectHash,
}: SelectedWorksProps) {
  const openMedia = useOpenMedia(locale);
  const works = data.works.filter((c) => isRowVisible(c, types));
  if (works.length === 0) return null;

  return (
    <section aria-labelledby="works-selected-title" className="mb-14 sm:mb-16">
      <TierHeading id="works-selected-title">{data.title}</TierHeading>
      <div className="space-y-7 sm:space-y-8">
        {works.map((commit) => (
          <SelectedWork
            key={commit.id}
            commit={commit}
            commits={commits}
            // What hangs off it, as far as the filter lets through: with
            // `?type=project` a work carries no count of talks the page is
            // not showing.
            hanging={(data.hanging.get(commit.id) ?? []).filter((c) =>
              isRowVisible(c, types),
            )}
            locale={locale}
            form={form}
            openMedia={openMedia}
            onSelectHash={onSelectHash}
          />
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// Pieces
// =============================================================================

/**
 * One selected work, printed open:
 *
 *   Lynx Framework                              2023 – present
 *   Architect · Lynx @ ByteDance
 *   Open-source cross-platform UI framework behind TikTok, …
 *   lynxjs.org   github.com                          10 talks ⌄
 *
 * The name and the years are a list row's skeleton, so the log under it
 * reads as the same grammar with less said. The second line is who I was on
 * it, the third is the log's description whole and at reading size, and the
 * last is where to see it — at the page's form: links as text in the index,
 * covers and the grid further down — and the count of what hangs off it.
 *
 * The name goes where the work is (its first link). The years go to where
 * the work sits in the log, in its chapter, among what else I did then.
 */
function SelectedWork({
  commit,
  commits,
  hanging,
  locale,
  form,
  openMedia,
  onSelectHash,
}: {
  commit: Commit;
  commits: Commit[];
  hanging: Commit[];
  locale: Locale;
  form: LogForm;
  openMedia: OpenMedia;
  onSelectHash: SelectedWorksProps["onSelectHash"];
}) {
  const [open, setOpen] = useState(false);
  const { magneticPreviewEnabled } = useInputCapability();
  const hash = computeCommitHash(commit.id);
  const title = localize(commit.title, locale);
  const role = roleOwning(commit, commits);
  const team = localizeOptional(commit.team ?? role?.team, locale);
  const who = [role ? localize(role.title, locale) : null, team]
    .filter(Boolean)
    .join(" · ");
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const media = commit.media ?? [];
  const labels = mediaLabels(media, locale);
  const atoms = ROW_FORM[form];
  // The log's own derivations for the covers and their set, so a cover here
  // is the same cover, opening the same way, as it is on any row.
  const normalized = useMemo(
    () => normalizeCommit(commit, locale),
    [commit, locale],
  );
  const set = useMemo(
    () => attachmentSetFor(commit, locale),
    [commit, locale],
  );
  const count = countLine(hanging, locale);

  const links = media.length > 0 && atoms.media === "none" && (
    <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
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
  );

  return (
    // The id the log's pointer row names (`data-printed-at`), so the
    // commit's permalink lands here, and `data-row-trigger` is where the
    // arrival mark paints — the same wash a row in the log gets.
    <article id={printedAtId(commit)} aria-labelledby={`${hash}-name`}>
      <div data-row-trigger className="relative -mx-3 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between gap-4">
          <h3
            id={`${hash}-name`}
            className="flex min-w-0 items-center text-base font-medium text-foreground"
          >
            {/* The project's mark, at about twice the name's cap height. On
                a desk it hangs in the margin, where the log hangs its hash
                column, so every line of the entry keeps the column's edge;
                narrower, it leads the name. */}
            <ProjectMark
              commit={commit}
              locale={locale}
              className="text-[1.3rem] lg:absolute lg:top-[0.6rem] lg:-left-7"
            />
            {media.length > 0 ? (
              <a
                href={linkTarget(media[0], locale)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openMedia(commit, 0)}
                className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-ink-line"
              >
                {title}
              </a>
            ) : (
              title
            )}
          </h3>
          <a
            href={`#${hash}`}
            title={t(locale, "worksInTheLog")}
            onClick={(e) => {
              if (!isPlainClick(e)) return;
              e.preventDefault();
              // To the row itself, not through it back to here; and not a
              // new address — this is going to see where the work sits, not
              // naming it.
              onSelectHash(hash, { follow: false, push: false });
            }}
            className={cn(
              "shrink-0 transition-colors hover:text-foreground",
              TYPE.rowMeta,
            )}
          >
            {yearsOf(commit, locale)}
          </a>
        </div>
        {who && <p className={cn("mt-1", TYPE.meta)}>{who}</p>}
        {description && (
          <p className="mt-2.5 text-sm sm:text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        )}
        {atoms.notes && commentary && (
          <Commentary text={commentary} className="mt-2.5" />
        )}
        {atoms.media === "covers" && normalized.stripItems.length > 0 && (
          <MediaStrip
            items={normalized.stripItems}
            set={set}
            peek={atoms.peek && magneticPreviewEnabled}
            className="mt-3 min-w-0"
          />
        )}
        {atoms.media === "grid" && normalized.stripItems.length > 0 && (
          <AttachmentGrid
            items={normalized.stripItems}
            set={set}
            className="mt-3"
          />
        )}
        {(links || count) && (
          <div className="mt-2.5 flex items-baseline justify-between gap-4">
            {links || <span />}
            {count && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className={cn(
                  "pressable inline-flex shrink-0 items-center gap-1 transition-colors hover:text-foreground",
                  TYPE.rowMeta,
                  open && "text-muted-foreground",
                )}
              >
                {count}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3 transition-transform duration-200",
                    open && "rotate-180",
                  )}
                />
              </button>
            )}
          </div>
        )}
      </div>
      {open && (
        <ul className="mt-1 mb-2">
          {hanging.map((c) => (
            <HangingRow
              key={c.id}
              commit={c}
              locale={locale}
              openMedia={openMedia}
              onSelectHash={onSelectHash}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * A row hanging off a work, unfolded under it: a /writing row, tightened —
 * title left, date right, the venue between them in the metadata voice —
 * with the log's hash in the margin, where the log prints it.
 *
 * The title plays the talk (or opens the piece), because for a talk the
 * recording is the work. The hash goes down to the row in the log, where
 * the prose, the covers and the byline are.
 */
function HangingRow({
  commit,
  locale,
  openMedia,
  onSelectHash,
}: {
  commit: Commit;
  locale: Locale;
  openMedia: OpenMedia;
  onSelectHash: SelectedWorksProps["onSelectHash"];
}) {
  const hash = computeCommitHash(commit.id);
  const title = localize(commit.title, locale);
  const venue = venueOf(commit, title);
  const badge = getCommitLanguageBadge(commit, locale);
  const index = playableIndex(commit);
  const toLog = (e: MouseEvent) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    onSelectHash(hash);
  };

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={TYPE.rowTitle}>{title}</span>
        {/* An en space rather than a margin: it breaks like a space, so a
            venue that wraps starts flush on its own line. */}{" "}
        {(venue || badge) && (
          // One metadata run after the title: where, then — the same
          // mismatch hint the log and /writing print, silent when the talk
          // is in the reader's language — in what. Its own line on a phone;
          // on a wider column it follows the title and wraps as a whole,
          // never a venue broken across two lines.
          <span
            className={cn("block sm:inline sm:whitespace-nowrap", TYPE.rowMeta)}
          >
            {[venue, badge].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className={cn("shrink-0", TYPE.rowMeta)}>
        {monthOf(commit.date, locale)}
      </span>
    </>
  );
  const rowClass =
    "pressable flex items-baseline justify-between gap-4 rounded-lg -mx-3 px-3 py-1.5 transition-colors duration-200 hover:bg-muted/50 active:bg-muted/60";

  return (
    <li className="relative">
      {/* The hash, hung in the margin the log hangs it in — the way down
          into the log, and the only git on this part of the page. */}
      <a
        href={`#${hash}`}
        onClick={toLog}
        aria-label={`${t(locale, "worksInTheLog")}: ${hash}`}
        title={t(locale, "worksInTheLog")}
        className={cn(
          "absolute top-1.5 right-full mr-9 hidden lg:block",
          TYPE.hash,
          "transition-colors hover:text-muted-foreground",
        )}
      >
        {hash}
      </a>
      {index >= 0 ? (
        <a
          href={linkTarget(commit.media![index], locale)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openMedia(commit, index)}
          className={rowClass}
        >
          {body}
        </a>
      ) : (
        <a href={`#${hash}`} onClick={toLog} className={rowClass}>
          {body}
        </a>
      )}
    </li>
  );
}

/**
 * A project's logo: the icon its `<Badge commit=…>` wears on the About
 * (components/magic-link), because a project is the protagonist of its row
 * and should look the same wherever it is named — here, and on its row in
 * the log. Sized by the font size around it, the way the badge is. A commit
 * the badge resolver cannot find falls back to the log's own project glyph,
 * quietly.
 */
export function ProjectMark({
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
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 leading-none", className)}
    >
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
