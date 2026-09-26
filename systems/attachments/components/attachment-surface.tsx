"use client";

import { PagerDots, useSnapPager } from "@/components/ui/snap-pager";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  ADAPTIVE_PRESENTATION,
  AdaptiveSurface,
  useSheetAxisLock,
  useSurfaceContext,
} from "@/systems/surface";
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
  const { scrollRef, index, settled, scrollTo } = useSnapPager(count, initial);
  // In a sheet, a swipe on the track is the track's or the sheet's, never
  // both — a diagonal one otherwise moves the two together on iOS and the
  // snap strands between pages (systems/surface/axis-lock.ts).
  const { mode } = useSurfaceContext();
  useSheetAxisLock(scrollRef, mode === "sheet");

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
          // X only, the way the talks widget's strip is. An `overflow-x`
          // scroller scrolls Y too the moment anything pokes out below it —
          // here the 6px hit areas under the action pills did, by 3px — and
          // iOS then pans the track in two dimensions and rubber-bands it
          // vertically under a sideways swipe. The bottom padding (given back
          // by the margin) keeps those hit areas whole inside the clip.
          "overflow-y-hidden pb-1.5 -mb-1.5",
          // No `scroll-smooth`: the dots already ask for a smooth scroll by
          // name, and on WebKit the property is one more hand on a snap.
          "snap-x snap-mandatory no-scrollbar",
        )}
      >
        {set.items.map((media, i) => (
          <div
            key={`${media.url}-${i}`}
            data-pager-card
            className="w-full shrink-0 snap-center"
            // Pages off screen are inert to the keyboard and the reader —
            // from the page the track settled on, not the one passing under
            // the finger: flipping these mid-snap restyles the pages while
            // WebKit is animating the snap between them.
            inert={i !== settled || undefined}
            aria-hidden={i !== settled || undefined}
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
