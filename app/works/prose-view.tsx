"use client";

/**
 * /works as prose — the chapters, written out.
 *
 * The log's information was always in its text: what each era was, what
 * each project did, where each talk was given. The page around that text
 * — hash, rail, ref pills, type chips, three forms, a strip of covers per
 * row, a byline per cluster — was a way of *drawing* a career as a git
 * log, and it out-shouted the sentences. This reading keeps the sentences
 * and drops the drawing.
 *
 *   Now                                          2023 – Present
 *   Architect of Lynx at ByteDance, an open source, cross platform
 *   framework powering TikTok and CapCut. …
 *
 *   Lynx Framework                                       Feb 2023
 *   Open source cross platform framework behind TikTok. …
 *   lynxjs.org ↗ · github.com ↗
 *
 *   Talks  Why AI Agents Deserve a Better App Framework, GOSIM Paris
 *   2026 · Lynx: Unlock Native for More, React Summit · …
 *
 * Each era opens with the narrative that was already authored for it in
 * `log.json` (`tag.narrative`) and never printed. Projects get a heading
 * and their whole description. Talks and press fold into one running line
 * per era, the way a bio lists them, so nineteen talks stop being nineteen
 * rows between eleven projects.
 *
 * Nothing is lost, it is behind the text: every title and every link word
 * opens the commit's attachments (systems/attachments — the sheet on a
 * phone, the theater or a window on a desk) and peeks its covers under a
 * pointer. The hash is gone from the page but not from the address:
 * `/works#<hash>` still lands on its entry, so the About's badges and the
 * home widgets keep their links.
 */

import { Fragment, useMemo, type MouseEvent, type ReactNode } from "react";
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
  getLocalizedTagDescription,
  getLocalizedTagTitle,
  isImageMedia,
  isSlidesMedia,
  isVideoMedia,
  localize,
  type Commit,
  type LogData,
  type Media,
  type Tag,
} from "@/lib/log";

interface WorksProseProps {
  logData: LogData;
}

export function WorksProse({ logData }: WorksProseProps) {
  const { locale } = useLocale();
  const data = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );
  // Keeps `/works#<hash>` landing on its entry (see the header comment).
  useCommitAnchor();

  return (
    <PageLayout page="works">
      <div className="space-y-14 sm:space-y-16">
        {data.map(({ tag, commits }, i) => (
          <Chapter
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
// A chapter — an era's narrative, then what was made in it
// =============================================================================

function Chapter({
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
  const narrative = getLocalizedTagDescription(tag, locale);
  const projects = commits.filter((c) => c.type === "project");
  const talks = commits.filter((c) => c.type === "talk");
  const press = commits.filter((c) => c.type === "press" || c.type === "post");
  // A chapter with nothing to say prints nothing. One with only a story
  // (the early days: no commit, just the paragraph) prints the story — it
  // was authored for this page and the log never had a row to put it on.
  if (
    !narrative &&
    projects.length === 0 &&
    talks.length === 0 &&
    press.length === 0
  ) {
    return null;
  }

  return (
    <section>
      {/* The era, named the way the ref pill named it — except the newest,
          which was `HEAD`: right in a log, wrong at the head of a paragraph. */}
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

      {narrative && (
        <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">
          {narrative}
        </p>
      )}

      {projects.length > 0 && (
        <div className="mt-8 space-y-6">
          {projects.map((c) => (
            <Project key={c.id} commit={c} locale={locale} />
          ))}
        </div>
      )}

      {talks.length > 0 && (
        <Line
          label={getCommitTypePluralLabel("talk", locale)}
          commits={talks}
          locale={locale}
          className={projects.length > 0 ? "mt-8" : "mt-6"}
        />
      )}
      {press.length > 0 && (
        <Line
          label={getCommitTypePluralLabel("press", locale)}
          commits={press}
          locale={locale}
          className="mt-3"
        />
      )}
    </section>
  );
}

// =============================================================================
// A project — heading, the description whole, and its links as words
// =============================================================================

function Project({ commit, locale }: { commit: Commit; locale: Locale }) {
  const hash = computeCommitHash(commit.id);
  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const set = useMemo(
    () => attachmentSetFor(commit, locale),
    [commit, locale],
  );
  const media = commit.media ?? [];

  return (
    // `id` + `data-rail-row` is what `useCommitAnchor` looks for, and
    // `data-row-trigger` is where its arrival wash paints (globals.css).
    <article id={hash} data-rail-row className="group">
      <div data-row-trigger className="-mx-3 rounded-lg px-3 py-1">
        <h3 className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className={cn("shrink-0", TYPE.rowMeta)}>
            {formatCommitDate(commit, locale)}
          </span>
        </h3>
        {description && (
          <p className={cn("mt-1.5", TYPE.body)}>{description}</p>
        )}
        {media.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {media.map((m, i) => (
              <LinkWord
                key={`${m.url}-${i}`}
                media={m}
                index={i}
                set={set}
                word={linkWord(m, media, locale)}
                locale={locale}
              />
            ))}
          </p>
        )}
      </div>
    </article>
  );
}

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
 * One attachment as a mono word. The anchor is real — ⌘-click, middle-click
 * and copy-link work, and it is the destination when no attachment provider
 * is mounted — but a plain click goes through the attachment system, which
 * opens the set at this item wherever the policy says it lives.
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
      className="inline-flex"
    >
      <a
        href={media.url}
        target={leaves ? "_blank" : undefined}
        rel={leaves ? "noopener noreferrer" : undefined}
        onClick={onClick}
        className={cn(
          TYPE.rowMeta,
          "inline-flex items-center gap-0.5 transition-colors hover:text-foreground",
        )}
      >
        <span className="max-w-[14rem] truncate">{word}</span>
        {leaves && (
          <span aria-hidden className="text-[0.7rem]">
            ↗
          </span>
        )}
      </a>
    </MagneticPreview>
  );
}

// =============================================================================
// A line — the era's talks, or its press, as one running sentence
// =============================================================================

function Line({
  label,
  commits,
  locale,
  className,
}: {
  label: string;
  commits: Commit[];
  locale: Locale;
  className?: string;
}) {
  return (
    <p className={cn(TYPE.body, className)}>
      <span className={cn(TYPE.label, "mr-2")}>{label}</span>
      {commits.map((c, i) => (
        <Fragment key={c.id}>
          {i > 0 && (
            <span aria-hidden className="mx-1.5 text-quaternary-foreground">
              ·
            </span>
          )}
          <Mention commit={c} locale={locale} />
        </Fragment>
      ))}
    </p>
  );
}

/** Where a talk or a piece of press happened — the part of the sentence
 *  after the title. */
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

/**
 * A commit as a mention in running text: its title, then its venue. The
 * title opens the commit's attachments and peeks them under a pointer —
 * the whole row's worth of media, behind one word. An aside (a talk the
 * author marked minor on the timeline) is an ordinary mention here: in a
 * sentence, a rung of grey on every third name read as a broken link.
 */
function Mention({ commit, locale }: { commit: Commit; locale: Locale }) {
  const attachments = useOptionalAttachments();
  const { magneticPreviewEnabled } = useInputCapability();
  const hash = computeCommitHash(commit.id);
  const title = localize(commit.title, locale);
  const venue = venueOf(commit);
  const set = useMemo(
    () => attachmentSetFor(commit, locale),
    [commit, locale],
  );
  const preview = useMemo(
    () => (magneticPreviewEnabled ? buildCommitPreview(commit, locale) : null),
    [commit, locale, magneticPreviewEnabled],
  );
  const first = set?.items[0];
  const href = first?.url;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!attachments || !set) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    attachments.open(set, 0);
  };

  const name: ReactNode = href ? (
    <a
      href={href}
      onClick={onClick}
      className="text-foreground transition-colors hover:text-muted-foreground"
    >
      {title}
    </a>
  ) : (
    <span className="text-foreground">{title}</span>
  );

  return (
    <span id={hash} data-rail-row className="group">
      <span data-row-trigger className="rounded">
        <MagneticPreview
          preview={preview?.node}
          enabled={!!preview}
          panelClassName={preview?.panelClassName}
          as="span"
        >
          {name}
        </MagneticPreview>
        {venue && (
          <span>
            {locale === "zh" ? "，" : ", "}
            {venue}
          </span>
        )}
      </span>
    </span>
  );
}
