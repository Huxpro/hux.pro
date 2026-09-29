"use client";

/**
 * /works as a ledger — a CV, set in the site's type.
 *
 * A résumé delivers a career in one screen because it does not narrate:
 * it tabulates. Each era is a block; inside it the entries are grouped by
 * what they are — the projects, then the talks, then the press — and each
 * entry is one line with a mono date in a column of its own, so the eye
 * can run down the dates without reading, or down the titles without
 * counting.
 *
 *   Current                                          2023 – Present
 *
 *   Projects
 *   2023 –     Lynx Framework                       lynxjs.org · github.com ↗
 *
 *   Talks
 *   May 2026   Why AI Agents Deserve a Better App Framework   GOSIM Paris 2026
 *   Jun 2025   Lynx: Unlock Native for More                   React Summit
 *
 * The timeline interleaved eleven projects with nineteen talks in date
 * order, so the projects — the part of the record that takes years — sat
 * between rows that took an afternoon. Grouping by kind gives the projects
 * their own block at the head of every era and turns the talks into what
 * they are on a CV: a list.
 *
 * Nothing else prints on the line. A project's attachments are mono words
 * in the third column, and every line unfolds its description on a press;
 * a pointer resting on a line peeks its covers. `/works#<hash>` still lands.
 */

import { useMemo, useState, type MouseEvent } from "react";
import { PageLayout } from "@/components/ui/page-layout";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { buildCommitPreview } from "@/components/log/commit-embed";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import { mediaPeek } from "@/components/log/media/media-peek";
import { tileCaption } from "@/components/log/media/attachment-tile";
import {
  attachmentSetFor,
  leavesSite,
  useOptionalAttachments,
  type AttachmentSet,
} from "@/systems/attachments";
import { useInputCapability, useLocale } from "@/services";
import { t, type Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import {
  buildTimelineData,
  computeCommitHash,
  formatCommitDate,
  formatTagDateRange,
  getCommitTypePluralLabel,
  getLocalizedTagTitle,
  isImageMedia,
  isSlidesMedia,
  isVideoMedia,
  localize,
  type Commit,
  type CommitType,
  type LogData,
  type Media,
  type Tag,
} from "@/lib/log";

/** The groups of an era, in the order a CV lists them. */
const GROUPS: CommitType[] = ["project", "talk", "press"];

interface WorksLedgerProps {
  logData: LogData;
}

export function WorksLedger({ logData }: WorksLedgerProps) {
  const { locale } = useLocale();
  useCommitAnchor();
  const data = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );

  return (
    <PageLayout page="works">
      <div className="space-y-12 sm:space-y-14">
        {data.map(({ tag, commits }, i) => (
          <Era
            key={tag.id}
            tag={tag}
            first={i === 0}
            commits={commits}
            locale={locale}
          />
        ))}
      </div>
    </PageLayout>
  );
}

// =============================================================================
// An era — its groups, each a small table
// =============================================================================

function Era({
  tag,
  first,
  commits,
  locale,
}: {
  tag: Tag;
  first: boolean;
  commits: Commit[];
  locale: Locale;
}) {
  const groups = GROUPS.map((type) => ({
    type,
    rows: commits.filter((c) =>
      type === "press" ? c.type === "press" || c.type === "post" : c.type === type,
    ),
  })).filter((g) => g.rows.length > 0);
  if (groups.length === 0) return null;

  return (
    <section>
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-medium text-foreground">
          {first ? t(locale, "logCurrent") : getLocalizedTagTitle(tag, locale)}
        </h2>
        {!tag.hideDate && (
          <span className={cn("shrink-0", TYPE.rowMeta)}>
            {formatTagDateRange(tag, locale)}
          </span>
        )}
      </header>

      {groups.map(({ type, rows }) => (
        <div key={type} className="mt-5">
          <h3 className={cn(TYPE.label, "mb-1")}>
            {getCommitTypePluralLabel(type, locale)}
          </h3>
          {rows.map((c) => (
            <Line key={c.id} commit={c} locale={locale} />
          ))}
        </div>
      ))}
    </section>
  );
}

// =============================================================================
// A line — date · title · where, and what unfolds under it
// =============================================================================

/** The third column: where a talk or a piece of press happened. A project
 *  puts its links there instead (see `Line`). */
function venueOf(commit: Commit): string | undefined {
  switch (commit.type) {
    case "talk":
      return commit.conference.name;
    case "post":
      return commit.publication.name;
    case "press":
      return commit.platform;
    default:
      return undefined;
  }
}

/** The mono date, as a CV writes it: the year when the entry is a span,
 *  the month when it is a day. `Feb 2023` is already what the log prints;
 *  this only keeps a range from wrapping the column. */
function dateOf(commit: Commit, locale: Locale): string {
  return formatCommitDate(commit, locale).replace(" – ", "–");
}

function Line({ commit, locale }: { commit: Commit; locale: Locale }) {
  const { magneticPreviewEnabled } = useInputCapability();
  const [open, setOpen] = useState(false);
  const hash = computeCommitHash(commit.id);
  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const venue = venueOf(commit);
  const media = useMemo(() => commit.media ?? [], [commit]);
  const isProject = commit.type === "project";
  const set = useMemo(
    () => attachmentSetFor(commit, locale),
    [commit, locale],
  );
  const preview = useMemo(
    () =>
      magneticPreviewEnabled && !open ? buildCommitPreview(commit, locale) : null,
    [commit, locale, magneticPreviewEnabled, open],
  );
  const words = useMemo(
    () => media.map((m) => linkWord(m, media, locale)),
    [media, locale],
  );

  return (
    <div id={hash} data-rail-row className="group">
      <MagneticPreview
        preview={preview?.node}
        enabled={!!preview}
        panelClassName={preview?.panelClassName}
      >
        {/* Three columns from `sm` up: a fixed date column, the title, and
            the venue or the links on the right, sized to what they hold up
            to a share of the row (`fit-content`) so a long venue wraps
            rather than squeezing the title. On a phone the date takes the
            title's right and the third column drops under them — a table
            narrower than its columns is a list. */}
        <div
          data-row-trigger
          role={description ? "button" : undefined}
          tabIndex={description ? 0 : undefined}
          aria-expanded={description ? open : undefined}
          onClick={description ? () => setOpen((v) => !v) : undefined}
          onKeyDown={
            description
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen((v) => !v);
                  }
                }
              : undefined
          }
          className={cn(
            "-mx-3 grid gap-x-4 gap-y-0.5 rounded-lg px-3 py-1.5 transition-colors duration-150",
            "grid-cols-[1fr_auto] sm:grid-cols-[6.5rem_1fr_fit-content(40%)]",
            description &&
              "pressable cursor-pointer hover:bg-muted/40 active:bg-muted/50",
          )}
        >
          <span className={cn(TYPE.rowMeta, "order-2 sm:order-none shrink-0 tabular-nums")}>
            {dateOf(commit, locale)}
          </span>
          <span
            className={cn(
              TYPE.rowTitle,
              "min-w-0 order-1 sm:order-none",
              commit.present === "aside" && "text-muted-foreground",
            )}
          >
            {title}
          </span>
          <span
            className="order-3 sm:order-none col-span-2 sm:col-span-1 min-w-0 sm:text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {isProject ? (
              <span className="flex flex-wrap gap-x-3 sm:justify-end">
                {media.map((m, i) => (
                  <LinkWord
                    key={`${m.url}-${i}`}
                    media={m}
                    index={i}
                    set={set}
                    word={words[i]}
                    locale={locale}
                  />
                ))}
              </span>
            ) : (
              venue && (
                <VenueWord
                  venue={venue}
                  set={set}
                  media={media[0]}
                  locale={locale}
                />
              )
            )}
          </span>
        </div>
      </MagneticPreview>

      {open && description && (
        <p className={cn(TYPE.caption, "pb-3 pt-1 sm:pl-[6.5rem]")}>
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * A talk's venue, printed where a project prints its links — and, when the
 * talk attaches a recording or a deck, the venue is the door to it: press
 * it and the attachment opens. A venue with nothing behind it is a word.
 */
function VenueWord({
  venue,
  set,
  media,
  locale,
}: {
  venue: string;
  set: AttachmentSet | null;
  media: Media | undefined;
  locale: Locale;
}) {
  if (!media || !set) {
    return <span className={TYPE.rowMeta}>{venue}</span>;
  }
  return (
    <LinkWord media={media} index={0} set={set} word={venue} locale={locale} />
  );
}

// =============================================================================
// An attachment as a word
// =============================================================================

/**
 * What a link is called when it is a word rather than a cover: where it
 * goes (`github.com`, `/writing`), what it is (`Recording`, `Slides`), or
 * for an image its caption — and the page's own title when the same host
 * appears twice in one entry, so three posts from this site are not three
 * words that read `/writing`. A title can run long; the word is clamped
 * where it prints.
 */
function linkWord(media: Media, all: readonly Media[], locale: Locale): string {
  const caption = tileCaption(media, locale);
  if (isVideoMedia(media) || isSlidesMedia(media)) return caption.source;
  if (isImageMedia(media)) return caption.title || caption.source;
  const repeats = all.filter(
    (m) => m !== media && tileCaption(m, locale).source === caption.source,
  );
  return repeats.length > 0 && caption.title ? caption.title : caption.source;
}

/**
 * The anchor is real — ⌘-click, middle-click and copy-link work, and it is
 * the destination when no attachment provider is mounted — but a plain
 * click goes through the attachment system, which opens the set at this
 * item wherever the policy says it lives.
 */
function LinkWord({
  media,
  index,
  set,
  word,
  locale,
}: {
  media: Media;
  index: number;
  set: AttachmentSet | null;
  word: string;
  locale: Locale;
}) {
  const attachments = useOptionalAttachments();
  const { magneticPreviewEnabled } = useInputCapability();
  const leaves = leavesSite(media);
  const peek = useMemo(
    () => (magneticPreviewEnabled ? mediaPeek(media, locale, { leaves }) : null),
    [media, locale, leaves, magneticPreviewEnabled],
  );

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    if (!attachments || !set) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    attachments.open(set, index);
  };

  return (
    <MagneticPreview
      preview={peek?.node}
      enabled={!!peek}
      panelClassName={peek?.panelClassName}
      as="span"
      className="inline-flex max-w-full"
    >
      <a
        href={media.url}
        target={leaves ? "_blank" : undefined}
        rel={leaves ? "noopener noreferrer" : undefined}
        onClick={onClick}
        className={cn(
          TYPE.rowMeta,
          "inline-flex max-w-full items-center gap-0.5 transition-colors hover:text-foreground",
        )}
      >
        <span className="max-w-[12rem] truncate">{word}</span>
        {leaves && (
          <span aria-hidden className="text-[0.7rem]">
            ↗
          </span>
        )}
      </a>
    </MagneticPreview>
  );
}
