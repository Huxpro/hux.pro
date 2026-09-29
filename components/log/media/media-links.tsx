"use client";

/**
 * MediaLinks — a commit's attachments as a line of words.
 *
 * The `prose` form (lib/log-view.ts) prints one of these under each row
 * where `covers` prints the strip: every attachment the commit carries, in
 * authored order, as a named link — `▶ YouTube`, `▤ Slides`, `⊕ React
 * Compiler – react.dev`. It is the answer to the other half of the /works
 * paradox: the covers say what the work *looks like* at a glance and take a
 * row of tiles to do it; a projects page in the plain style says what the
 * work *is* and where to go, in a line. This is that line.
 *
 * Not a second vocabulary. Each link is the same door its cover is: it
 * opens the commit's attachment set at its own item (systems/attachments —
 * the stage for a recording, the in-app browser for a page, the sheet on a
 * phone), wears the same mark its cover would (media-mark.tsx: the platform
 * on a recording, `Slides` on a deck, `New tab` on a page that will leave),
 * and peeks the same cover on hover — so the picture the form left out is
 * still one pointer-rest away, which is what lets the form leave it out.
 *
 * Chrome-light, the way the strip is: a glyph and a name, mono, on the
 * secondary rung — the links are the row's doors and carry information, so
 * not tertiary — with the underline this site's prose gives an outbound
 * link (/prompt's `LinkRow`). A long page title is cut at the line, not
 * wrapped into a paragraph of its own; the tooltip and the peek say the
 * rest.
 */

import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import type { Locale } from "@/lib/i18n";
import { isVideoMedia, type Media } from "@/lib/log";
import { TYPE } from "@/lib/typography";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { MouseEvent } from "react";
import { tileCaption } from "./attachment-tile";
import { InspectableMedia } from "./inspectable";
import { markFor } from "./media-mark";
import { mediaPeek } from "./media-peek";

export interface MediaLinksProps {
  /** The attachments to name, in authored order — every one, cover or not. */
  items: readonly Media[];
  /** The commit's attachments as one set (see systems/attachments). Without
   *  a set, or outside the provider, the links are plain outbound links. */
  set?: AttachmentSet | null;
  /** Whether a link peeks its cover on hover: the form's `peek` and a
   *  pointer to hover with. */
  peek?: boolean;
  className?: string;
  /** Editor inspect: the same handle the strip's covers wear. */
  inspecting?: boolean;
  onInspect?: (media: Media) => void;
  selectedMedia?: Media | null;
}

/**
 * What a link is called. The page's title where it has one — that is what
 * a projects page prints inline — and the platform for a recording, whose
 * "title" (`Recording`) says less than where it is.
 */
function linkLabel(media: Media, locale: Locale): string {
  const caption = tileCaption(media, locale);
  if (isVideoMedia(media)) return caption.source;
  return caption.title || caption.source;
}

const LINK = cn(
  TYPE.meta,
  "inline-flex max-w-[36ch] items-center gap-1 align-baseline",
  "underline underline-offset-2 decoration-ink-line",
  "transition-colors hover:text-foreground hover:decoration-foreground",
);

export function MediaLinks({
  items,
  set,
  peek = true,
  className,
  inspecting = false,
  onInspect,
  selectedMedia = null,
}: MediaLinksProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();

  if (items.length === 0) return null;

  return (
    <div
      // Content inside the row that is not the row's fold trigger — see the
      // `data-row-body` note in TimelineCommit. A press on a link opens the
      // attachment; the prose around it is the row's.
      data-row-body
      className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}
    >
      {items.map((media, i) => {
        const index = set && attachments ? set.items.indexOf(media) : -1;
        const leaves =
          index >= 0 && set && attachments
            ? attachments.homeOf(set, index) === "tab"
            : false;
        const mark = markFor(media, locale, { all: true, leaves });
        const label = linkLabel(media, locale);
        const Icon = mark?.icon;
        const spec = peek ? mediaPeek(media, locale, { leaves }) : null;

        const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
          // The link's press is the link's: without this the row would fold
          // under you as you left for the page.
          e.stopPropagation();
          // Modified clicks belong to the browser — never hijack them.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          if (index < 0 || !set || !attachments) return;
          e.preventDefault();
          attachments.open(set, index);
        };

        return (
          <MagneticPreview
            key={`${media.url}-${i}`}
            as="span"
            preview={spec?.node}
            enabled={!!spec}
            panelClassName={spec?.panelClassName}
            className="min-w-0"
          >
            <InspectableMedia
              media={media}
              inspecting={inspecting}
              selected={selectedMedia === media}
              onInspect={onInspect}
              inline
            >
              <a
                href={media.url}
                target="_blank"
                rel="noopener noreferrer"
                title={leaves ? `${label} · ${t(locale, "linkOpensInTab")}` : label}
                onClick={onClick}
                className={LINK}
              >
                {Icon && (
                  <Icon
                    aria-hidden
                    className={cn("size-3 shrink-0", mark?.fill && "translate-x-px")}
                    strokeWidth={2.25}
                    fill={mark?.fill ? "currentColor" : "none"}
                  />
                )}
                <span className="truncate">{label}</span>
              </a>
            </InspectableMedia>
          </MagneticPreview>
        );
      })}
    </div>
  );
}
