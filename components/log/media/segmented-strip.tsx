"use client";

/**
 * SegmentedStrip — several commits laid across the page, each over its own
 * covers.
 *
 * A work given three times has three sets of covers; a project that holds
 * its talks has the talks' covers as well as its own. Printed a row per
 * commit, they cost the page a line each and leave the width beside a
 * single cover empty. Printed across, as columns on one strip, they cost
 * one line of covers, and the strip scrolls where it runs past the screen,
 * as a strip always has (media-strip.tsx).
 *
 * The strip is `git log` turned on its side. Each segment is one commit (a
 * version of a talk, the interview, the project's own post and repository)
 * and prints its caption over its covers: what it is, where, when. Segments
 * that are versions of one work stand under the work's title together
 * (`group`), and when the strip has groups, their titles sit on a line
 * running through them, a node each, the way a branch's commits sit on
 * its lane.
 *
 *   🎙 Lynx: Unlock Native for More ──────────────────── ● ───────
 *   D2 · Debut in China  Mar 2025   React Summit · …  Jun 2025
 *   [cover]                         [cover] [cover]              [post] [repo]
 *
 * One segment is the current one (`active`): its caption is lit. Choosing is
 * one choice from three places:
 *
 *   - Pressing a caption, or a group's title, chooses it (`onActive`).
 *   - Whatever names the segments elsewhere (a row's badges in the index)
 *     sets `active`, and the strip brings that segment into view.
 *   - Scrolling the strip by hand reports the segment that fills most of it.
 *
 * The strip only reports what a hand did: while it is scrolling itself to a
 * segment it stays quiet, or the segments it passed on the way would each
 * be chosen in turn.
 */

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { Media, StripItem } from "@/lib/log";
import { resolveTile } from "./attachment-tile";
import { CoverTile } from "./media-strip";

export interface StripSegment {
  id: string;
  items: StripItem[];
  /** Its own attachments: a cover opens the set it belongs to. */
  set: AttachmentSet | null;
  /** The line over its covers: `EN · React Universe Conf`. */
  caption?: string;
  /** When it happened, at the caption's end: `Sep 2025`. */
  date?: string;
  /** Where the caption's name comes from, in full, for its tooltip. */
  title?: string;
  /**
   * The work it is a version of. Consecutive segments of one group stand
   * under one title; a group without a title (a project's own attachments)
   * is still a node on the line.
   */
  group?: { id: string; title?: string; icon?: ReactNode };
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
  // Segments with covers, in runs of one group each.
  const groups = useMemo(() => {
    const out: {
      id: string;
      title?: string;
      icon?: ReactNode;
      segments: (StripSegment & { slots: ReturnType<typeof resolveTile>[] })[];
    }[] = [];
    for (const s of segments) {
      if (s.items.length === 0) continue;
      const seg = {
        ...s,
        slots: s.items.map((item) => resolveTile(item, locale, s.set, attachments)),
      };
      const key = s.group?.id ?? s.id;
      const last = out[out.length - 1];
      if (last && last.id === key) last.segments.push(seg);
      else out.push({ id: key, title: s.group?.title, icon: s.group?.icon, segments: [seg] });
    }
    return out;
  }, [segments, locale, attachments]);
  const onLane = segments.some((s) => s.group);

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
    // Measured against the track, not the segment's offset parent (a group).
    const start =
      seg.getBoundingClientRect().left -
      track.getBoundingClientRect().left +
      track.scrollLeft;
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
      const box = track.getBoundingClientRect();
      let best: string | null = null;
      let bestWidth = 0;
      for (const seg of track.querySelectorAll<HTMLElement>("[data-segment]")) {
        const r = seg.getBoundingClientRect();
        const visible = Math.min(box.right, r.right) - Math.max(box.left, r.left);
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

  const choose = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onActive?.(id);
  };

  if (groups.length === 0) return null;

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
        "flex w-max max-w-[calc(100%+var(--page-bleed))] gap-4 pr-6",
        "[margin-right:calc(var(--page-bleed)*-1)]",
        "overflow-x-auto overscroll-x-contain",
        "snap-x snap-proximity no-scrollbar",
        className,
      )}
    >
      {groups.map((group, g) => {
        const last = g === groups.length - 1;
        const lit = group.segments.some((s) => s.id === active);
        return (
          <div key={group.id} className="flex shrink-0 snap-start flex-col gap-1">
            {onLane && (
              // The lane: the group's node, its title, and the line on to
              // the next one, through the gap between them.
              <button
                type="button"
                onClick={choose(group.segments[0].id)}
                onKeyDown={(e) => e.stopPropagation()}
                className="flex h-5 w-0 min-w-full items-center gap-1.5 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center",
                    lit ? "text-muted-foreground" : "text-quaternary-foreground",
                  )}
                >
                  {group.icon ?? (
                    <span className="block h-[5px] w-[5px] rounded-full bg-current" />
                  )}
                </span>
                {group.title && (
                  <span
                    className={cn(
                      "min-w-0 truncate text-xs transition-colors",
                      lit ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {group.title}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    "h-px min-w-3 flex-1 bg-muted-foreground/15",
                    !last && "-mr-4",
                  )}
                />
              </button>
            )}
            <div className="flex gap-2">
              {group.segments.map((seg) => (
                <div
                  key={seg.id}
                  data-segment={seg.id}
                  className="flex flex-col gap-1"
                >
                  {(seg.caption || seg.date) && (
                    <button
                      type="button"
                      onClick={choose(seg.id)}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-pressed={seg.id === active}
                      title={seg.title}
                      className={cn(
                        "flex w-0 min-w-full items-baseline gap-2 text-left transition-colors",
                        TYPE.rowMeta,
                        seg.id === active
                          ? "text-muted-foreground"
                          : "hover:text-muted-foreground",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{seg.caption}</span>
                      {seg.date && <span className="shrink-0">{seg.date}</span>}
                    </button>
                  )}
                  <div className="flex gap-2">
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
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
