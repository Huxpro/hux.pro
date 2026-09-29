"use client";

/**
 * /works as an index — the /writing list, for work.
 *
 * The writing page delivers its information with a title and a date, and
 * nothing else on the line; the log delivered the same kind of thing with
 * a hash, a rail, an icon, a byline, two lines of blurb and a strip of
 * covers. This reading makes the two pages the same page: one line per
 * work, the era as a quiet mono label above its run, and a chip row under
 * the title for the one question a reader brings — "just the talks".
 *
 *   All  Projects  Talks  Press
 *
 *   Current                                          2023 – Present
 *   Why AI Agents Deserve a Better App Framework  GOSIM Paris 2026    May 2026
 *   Lynx: Unlock Native for More  React Summit                        Jun 2025
 *   Lynx Framework                                                    Feb 2023
 *
 * What the line does not print is behind it, the way a post's excerpt is
 * behind its row: a pointer resting on the line peeks the commit's covers,
 * and pressing it unfolds the description and the attachments as link
 * words — each of which opens where the attachment system says it lives.
 * The hash is gone from the page but not from the address: `/works#<hash>`
 * still lands on its line.
 */

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { HeaderAction } from "@/components/ui/controls";
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
  type FilterableCommitType,
  type LogData,
  type Media,
} from "@/lib/log";
import { parseViewState, serializeViewState } from "@/lib/log-view";

/** The chips, in the order the page lists its rows' types. Roles are not
 *  in it: the log's roles are the identities behind other rows, and the
 *  narrative on the About says the rest. */
const INDEX_TYPES: FilterableCommitType[] = ["project", "talk", "press"];

interface WorksIndexProps {
  logData: LogData;
}

export function WorksIndex({ logData }: WorksIndexProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useCommitAnchor();

  const data = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );

  // One type at a time, the way the writing list's language chip is one
  // answer at a time. The URL is the state, so a reading is a link (and
  // the About's `/works?type=talk` keeps meaning what it says); the
  // codec is the timeline's own, so old links parse.
  const view = useMemo(
    () => parseViewState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const type: FilterableCommitType | null = view.types[0] ?? null;
  const setType = useCallback(
    (next: FilterableCommitType | null) => {
      const query = serializeViewState(
        { types: next ? [next] : [], form: view.form },
        new URLSearchParams(searchParams.toString()),
      );
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [view.form, searchParams, router, pathname],
  );

  const chapters = useMemo(
    () =>
      data
        .map(({ tag, commits }, i) => ({
          tag,
          first: i === 0,
          rows: commits.filter(
            (c) =>
              (c.type === "project" || c.type === "talk" || c.type === "press") &&
              (!type || c.type === type),
          ),
        }))
        .filter((c) => c.rows.length > 0),
    [data, type],
  );

  return (
    <PageLayout
      page="works"
      headerActions={
        <span className="inline-flex items-center gap-0.5 font-mono text-xs select-none">
          <HeaderAction active={type === null} onClick={() => setType(null)}>
            {t(locale, "allLanguages")}
          </HeaderAction>
          {INDEX_TYPES.map((k) => (
            <HeaderAction key={k} active={type === k} onClick={() => setType(k)}>
              {getCommitTypePluralLabel(k, locale)}
            </HeaderAction>
          ))}
        </span>
      }
    >
      {chapters.map(({ tag, first, rows }) => (
        <section key={tag.id} className="not-first:mt-10">
          {/* The era, as a label over its run — mono, muted, and not a
              control. `HEAD` was the pill's word; over a list it is just
              the current one. */}
          <div className={cn("flex items-baseline justify-between gap-4 mb-1", TYPE.label)}>
            <span>
              {first ? t(locale, "logCurrent") : getLocalizedTagTitle(tag, locale)}
            </span>
            {!tag.hideDate && <span>{formatTagDateRange(tag, locale)}</span>}
          </div>
          {rows.map((c) => (
            <Row key={c.id} commit={c} locale={locale} />
          ))}
        </section>
      ))}

      {chapters.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          {t(locale, "logNoMatches")}
        </p>
      )}
    </PageLayout>
  );
}

// =============================================================================
// A row — the title line, and what unfolds under it
// =============================================================================

/** Where it happened, printed after the title the way `译` follows a post. */
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

function Row({ commit, locale }: { commit: Commit; locale: Locale }) {
  const { magneticPreviewEnabled } = useInputCapability();
  const [open, setOpen] = useState(false);
  const hash = computeCommitHash(commit.id);
  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const venue = venueOf(commit);
  const media = commit.media ?? [];
  const aside = commit.present === "aside";
  const set = useMemo(
    () => attachmentSetFor(commit, locale),
    [commit, locale],
  );
  // The peek says what the row would unfold to; once it has unfolded, a
  // panel repeating it under the pointer is in the way of reading it.
  const preview = useMemo(
    () =>
      magneticPreviewEnabled && !open ? buildCommitPreview(commit, locale) : null,
    [commit, locale, magneticPreviewEnabled, open],
  );
  const canOpen = !!description || media.length > 0;

  return (
    <article id={hash} data-rail-row className="group relative">
      <MagneticPreview
        preview={preview?.node}
        enabled={!!preview}
        panelClassName={preview?.panelClassName}
      >
        <button
          type="button"
          data-row-trigger
          onClick={canOpen ? () => setOpen((v) => !v) : undefined}
          aria-expanded={canOpen ? open : undefined}
          className={cn(
            "pressable flex w-full items-baseline justify-between gap-4 rounded-lg py-3 sm:py-4 -mx-4 px-4 text-left transition-colors duration-200",
            canOpen ? "hover:bg-muted/50 active:bg-muted/60" : "cursor-default",
          )}
        >
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                TYPE.rowTitle,
                "sm:text-base",
                // A talk the author marked minor sits a rung down, still on
                // the line: the index is complete, and says which lines it
                // would skip.
                aside && "text-muted-foreground",
              )}
            >
              {title}
            </span>
            {venue && (
              // The venue is glued to the title's last word the way a post's
              // provenance is, in the same metadata ink as the date.
              <span className="whitespace-nowrap">
                {" "}
                <span className={cn("ml-1", TYPE.rowMeta)}>{venue}</span>
              </span>
            )}
          </span>
          <span className={cn("shrink-0", TYPE.rowMeta)}>
            {formatCommitDate(commit, locale)}
          </span>
        </button>
      </MagneticPreview>

      {open && (
        <div className="pb-4 pt-0 sm:-mt-1">
          {description && <p className={TYPE.caption}>{description}</p>}
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
      )}
    </article>
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
