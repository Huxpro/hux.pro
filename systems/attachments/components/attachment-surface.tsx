"use client";

import { PagerDots, useSnapPager } from "@/components/ui/snap-pager";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { ADAPTIVE_PRESENTATION, AdaptiveSurface } from "@/systems/surface";
import { useLayoutEffect } from "react";
import type { AttachmentSession } from "../provider";
import { useAttachments } from "../provider";
import { AttachmentPage } from "./attachment-page";

// =============================================================================
// AttachmentSurface — a commit's attachments, paged.
//
// One system-wide surface, mounted once in the root layout, that the provider
// brings up at the item that was tapped. Its shape is the viewport's call
// (systems/surface): a bottom sheet on a phone, which is the case it exists
// for — a panel on a tablet and a window on a desktop for the attachments
// that have no native home there.
//
// Inside is the widgets' strip (components/ui/snap-pager): one page per
// attachment, full width, snapping page by page, dots underneath. A commit
// with a talk video, a deck and a write-up reads as one thing with three
// faces, and a swipe moves between them without going back to the row. The
// header carries the commit's title and a `2 / 3` counter; the pages carry
// the covers, the venue and the actions.
//
// It sizes to its content (`fitContent`): a sheet holding one cover and a
// row of actions should not stand at a detent with an empty half beneath.
// The track is a flex row, so every page is as tall as the tallest and the
// sheet holds still while swiping.
// =============================================================================

/** Narrower than the playlist's window: a page is one cover wide. */
const WINDOW_WIDTH = "min(92vw, 560px)";
const MAX_HEIGHT = "min(84dvh, 760px)";

export function AttachmentSurface() {
  const { locale } = useLocale();
  const { session, isOpen, close } = useAttachments();

  return (
    <AdaptiveSurface
      id="surface-attachments"
      open={isOpen && !!session}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      presentation={ADAPTIVE_PRESENTATION}
      title={session?.set.title ?? ""}
      closeLabel={t(locale, "attachmentsClose")}
      windowWidth={WINDOW_WIDTH}
      maxHeight={MAX_HEIGHT}
      fitContent
      // The track bleeds to the surface's edges so a page is exactly the
      // surface wide, and the next one starts past the edge rather than
      // peeking through the padding.
      contentClassName="pb-5"
    >
      {session && <Pager key={session.key} session={session} />}
    </AdaptiveSurface>
  );
}

function Pager({ session }: { session: AttachmentSession }) {
  const { set, index: initial } = session;
  const count = set.items.length;
  const { scrollRef, index, scrollTo } = useSnapPager(count);

  // Land on the item that was tapped before the first paint, not after: the
  // surface arrives already showing it.
  useLayoutEffect(() => {
    scrollTo(initial, "instant");
  }, [initial, scrollTo]);

  return (
    <div>
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto px-4 scroll-px-4",
          "snap-x snap-mandatory scroll-smooth no-scrollbar",
        )}
      >
        {set.items.map((media, i) => (
          <div
            key={`${media.url}-${i}`}
            data-pager-card
            className="w-full shrink-0 snap-center"
            // Pages off screen are inert to the keyboard and the reader.
            inert={i !== index || undefined}
            aria-hidden={i !== index || undefined}
          >
            <AttachmentPage set={set} index={i} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <PagerDots count={count} index={index} onSelect={scrollTo} />
          <span className="font-mono text-[10px] tabular-nums text-tertiary-foreground">
            {index + 1} / {count}
          </span>
        </div>
      )}
    </div>
  );
}
