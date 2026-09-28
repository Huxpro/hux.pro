"use client";

/**
 * SegmentedStrip — several things' covers on one strip, and which one you
 * are looking at.
 *
 * A work given three times has three sets of covers, and a project that
 * holds its talks has the talks' covers as well as its own. Printed a strip
 * per thing, they cost a line of page each; printed one after another on a
 * single strip, they cost one, and the page's width, which was sitting
 * empty beside a single cover, takes the rest. The strip scrolls where it
 * runs past the screen, as a strip always has (media-strip.tsx).
 *
 * The strip is in segments, one per thing, and a segment's first cover
 * wears its name (`EN`, `中文`, `React Summit`) where a cover wears its
 * chip, at the other corner. One segment is the current one (`active`):
 * its name is lit. The two ways of choosing are one choice:
 *
 *   - Whatever names the segments elsewhere (a row's version badges, the
 *     rows on a project's branch) sets `active`, and the strip brings that
 *     segment into view if it isn't already.
 *   - Scrolling the strip by hand reports the segment that fills most of
 *     it (`onActive`), so the badges follow the covers.
 *
 * The strip only reports what a hand did: while it is scrolling itself to
 * a segment it stays quiet, or the segments it passed on the way would
 * each be chosen in turn.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { ARTWORK_CHIP_REST } from "@/lib/glass";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { Media, StripItem } from "@/lib/log";
import { resolveTile } from "./attachment-tile";
import { CoverTile } from "./media-strip";

export interface StripSegment {
  id: string;
  /** The name its first cover wears. */
  label?: string;
  items: StripItem[];
  /** Its own attachments: a cover opens the set it belongs to. */
  set: AttachmentSet | null;
}

export function SegmentedStrip({
  segments,
  active,
  onActive,
  peek = true,
  className,
  inspecting = false,
  onInspect,
  selectedMedia = null,
}: {
  segments: readonly StripSegment[];
  active?: string;
  onActive?: (id: string) => void;
  peek?: boolean;
  className?: string;
  inspecting?: boolean;
  onInspect?: (media: Media) => void;
  selectedMedia?: Media | null;
}) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  const shown = useMemo(
    () =>
      segments
        .filter((s) => s.items.length > 0)
        .map((s) => ({
          ...s,
          slots: s.items.map((item) => resolveTile(item, locale, s.set, attachments)),
        })),
    [segments, locale, attachments],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  // The segment the strip last reported or was last brought to: a change of
  // `active` from anywhere else is a request to show it.
  const known = useRef(active);
  const selfScrolling = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (active === undefined || active === known.current) return;
    known.current = active;
    const track = trackRef.current;
    const seg = track?.querySelector<HTMLElement>(
      `[data-segment="${CSS.escape(active)}"]`,
    );
    if (!track || !seg) return;
    const start = seg.offsetLeft;
    const end = start + seg.offsetWidth;
    const inView =
      start >= track.scrollLeft && end <= track.scrollLeft + track.clientWidth;
    if (inView) return;
    selfScrolling.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: start, behavior: reduce ? "auto" : "smooth" });
    if (settle.current) clearTimeout(settle.current);
    // `scrollend` where there is one; a timeout where there isn't.
    settle.current = setTimeout(() => (selfScrolling.current = false), 900);
  }, [active]);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const handleScroll = useCallback(() => {
    if (selfScrolling.current || !onActive) return;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const track = trackRef.current;
      if (!track) return;
      const left = track.scrollLeft;
      const right = left + track.clientWidth;
      let best: string | null = null;
      let bestWidth = 0;
      for (const seg of track.querySelectorAll<HTMLElement>("[data-segment]")) {
        const visible =
          Math.min(right, seg.offsetLeft + seg.offsetWidth) -
          Math.max(left, seg.offsetLeft);
        if (visible > bestWidth) {
          bestWidth = visible;
          best = seg.dataset.segment ?? null;
        }
      }
      if (best && best !== known.current) {
        known.current = best;
        onActive(best);
      }
    });
  }, [onActive]);

  if (shown.length === 0) return null;
  const labelled = shown.length > 1;

  return (
    <div
      ref={trackRef}
      data-row-body
      onScroll={handleScroll}
      onScrollEnd={() => {
        if (settle.current) clearTimeout(settle.current);
        selfScrolling.current = false;
      }}
      className={cn(
        // The track, exactly as MediaStrip draws one (see there): as wide
        // as its covers, capped at the column plus the page's bleed, and
        // scrolling past that under the screen's edge.
        "relative flex w-max max-w-[calc(100%+var(--page-bleed))] gap-4 pr-6",
        "[margin-right:calc(var(--page-bleed)*-1)]",
        "overflow-x-auto overscroll-x-contain",
        "snap-x snap-proximity no-scrollbar",
        className,
      )}
    >
      {shown.map((seg) => (
        <div
          key={seg.id}
          data-segment={seg.id}
          className="flex shrink-0 snap-start gap-2"
        >
          {seg.slots.map((slot, i) => (
            <CoverTile
              key={`${slot.media.url}-${i}`}
              slot={slot}
              peek={peek}
              set={seg.set}
              attachments={attachments}
              locale={locale}
              inspecting={inspecting}
              onInspect={onInspect}
              selectedMedia={selectedMedia}
              className="snap-align-none"
            >
              {labelled && i === 0 && seg.label && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5",
                    "font-mono text-[10px] leading-none whitespace-nowrap backdrop-blur-sm",
                    "transition-colors duration-200",
                    // The current one is lit the way a pressed segment is:
                    // solid, where the others are the cover's glass.
                    seg.id === active
                      ? "bg-white/90 text-black ring-1 ring-black/5"
                      : ARTWORK_CHIP_REST,
                  )}
                >
                  {seg.label}
                </span>
              )}
            </CoverTile>
          ))}
        </div>
      ))}
    </div>
  );
}
