"use client";

/**
 * LinkWords — a commit's attachments as words.
 *
 * The `text` form prints one of these under each row: every attachment the
 * commit carries, named — `lynxjs.org`, `github.com ↗`, `Recording`,
 * `Slides` — on one mono line in authored order. It is the strip's sibling
 * (media-strip.tsx) with the picture taken out: the same items, the same
 * doors, the same peek under a pointer, at a line's height instead of a
 * cover's.
 *
 * A word is named for where it goes or what it is (`tileCaption`,
 * attachment-tile.tsx): a page by its host, a recording by the word, a deck
 * by the word, an image by its caption. When two attachments share a host
 * — three posts from this site, two pages on react.dev — the word is the
 * page's own title instead, clamped, so the line never reads `/writing
 * /writing /writing`.
 *
 * Each word is a real anchor (⌘-click, middle-click, copy link, and the
 * destination when no attachment provider is mounted), and a plain click
 * goes through the attachment system, which opens the set at this item
 * wherever the policy puts it: the sheet on a phone, the theater, a window
 * or a tab on a desk. A word that will open a tab says so with `↗`.
 */

import { useMemo, type MouseEvent } from "react";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { TYPE } from "@/lib/typography";
import type { Locale } from "@/lib/i18n";
import {
  useOptionalAttachments,
  type AttachmentSet,
  type AttachmentsApi,
} from "@/systems/attachments";
import { leavesSite } from "@/systems/attachments/lib/policy";
import {
  isImageMedia,
  isSlidesMedia,
  isVideoMedia,
  type Media,
} from "@/lib/log";
import { tileCaption } from "./attachment-tile";
import { InspectableMedia } from "./inspectable";
import { mediaPeek } from "./media-peek";

export interface LinkWordsProps {
  /** The attachments to name, in authored order. */
  media: readonly Media[];
  /** The commit's attachments as one set; a word opens the set at itself. */
  set?: AttachmentSet | null;
  /** Whether a word peeks on hover — the form's `peek` and a pointer. */
  peek?: boolean;
  className?: string;
  /** Editor inspect: the same handle the strip's covers wear. */
  inspecting?: boolean;
  onInspect?: (media: Media) => void;
  selectedMedia?: Media | null;
}

/** One attachment's word, and where its click lands. */
interface Word {
  media: Media;
  index: number;
  word: string;
  leaves: boolean;
}

/**
 * The word for one attachment among its siblings: a page's host, a
 * recording's or a deck's kind, an image's caption — and a page's title
 * when its host is already taken by another attachment of the same commit.
 */
export function linkWord(
  media: Media,
  all: readonly Media[],
  locale: Locale,
): string {
  const caption = tileCaption(media, locale);
  if (isVideoMedia(media)) return caption.title;
  if (isSlidesMedia(media)) return caption.source;
  if (isImageMedia(media)) return caption.title || caption.source;
  const repeats = all.some(
    (m) => m !== media && tileCaption(m, locale).source === caption.source,
  );
  return repeats && caption.title ? caption.title : caption.source;
}

function resolveWords(
  media: readonly Media[],
  locale: Locale,
  set: AttachmentSet | null | undefined,
  attachments: AttachmentsApi | null | undefined,
): Word[] {
  return media.map((m) => {
    const index = set && attachments ? set.items.indexOf(m) : -1;
    const leaves =
      index >= 0 && set && attachments
        ? attachments.homeOf(set, index) === "tab"
        : leavesSite(m);
    return { media: m, index, word: linkWord(m, media, locale), leaves };
  });
}

export function LinkWords({
  media,
  set,
  peek = true,
  className,
  inspecting = false,
  onInspect,
  selectedMedia = null,
}: LinkWordsProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  const words = useMemo(
    () => resolveWords(media, locale, set, attachments),
    [media, locale, set, attachments],
  );

  if (words.length === 0) return null;

  return (
    <div
      // Content inside the row that is not the row's fold trigger — see the
      // `data-row-body` note in TimelineCommit. A word opens its attachment;
      // the row's press is the title line's.
      data-row-body
      className={cn("flex flex-wrap gap-x-3 gap-y-0.5", className)}
    >
      {words.map(({ media: m, index, word, leaves }) => {
        const spec = peek ? mediaPeek(m, locale, { leaves }) : null;
        const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
          if (inspecting) return;
          if (!attachments || !set || index < 0) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          attachments.open(set, index);
        };
        return (
          <MagneticPreview
            key={`${m.url}-${index}`}
            preview={spec?.node}
            enabled={!!spec}
            panelClassName={spec?.panelClassName}
            as="span"
            className="inline-flex max-w-full"
          >
            <InspectableMedia
              media={m}
              inspecting={inspecting}
              selected={selectedMedia === m}
              onInspect={onInspect}
              inline
            >
              <a
                href={m.url}
                target={leaves ? "_blank" : undefined}
                rel={leaves ? "noopener noreferrer" : undefined}
                onClick={onClick}
                className={cn(
                  TYPE.rowMeta,
                  "inline-flex max-w-full items-center gap-0.5 transition-colors hover:text-foreground",
                )}
              >
                <span className="max-w-[14rem] truncate">{word}</span>
                {leaves && (
                  <span aria-hidden className="text-[0.7rem]">
                    ↗
                  </span>
                )}
              </a>
            </InspectableMedia>
          </MagneticPreview>
        );
      })}
    </div>
  );
}
