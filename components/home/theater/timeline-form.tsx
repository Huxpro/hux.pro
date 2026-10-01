"use client";

import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { TrackThumb, useTheater } from "@/systems/theater";
import {
  buildTimeline,
  latestMark,
  type Mark,
} from "@/systems/theater/lib/timeline";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// TheaterTimelineForm — the theater widget's "timeline" form (widgets.ts) —
// the library along time (systems/theater/lib/timeline.ts).
//
// Two lanes, one per language, the viewer's on top. A recording is a dot as
// big as it is long; a deck is a ring; the two tellings of one talk are
// joined across the lanes. The strip scrubs under a fixed playhead — swipe
// it, or wheel it sideways — and the mark under the playhead is the one the
// card shows above, cover and all; tap the cover to play it. Tapping a mark
// brings it to the playhead; the chevrons step mark by mark.
//
// The strip is `data-widget-inert`: a press on it scrolls the strip, never
// lifts the card.
// ---------------------------------------------------------------------------

/** Where the card's surface and its arrow go. */
const TALKS_HREF = "/works?type=talk";

const LANE_LABEL = { en: "EN", zh: "中文" } as const;
const LANE_H = 26;
const TICKS_H = 18;

/** A recording's dot, sized by running time; a deck's ring is fixed. */
function markSize(m: Mark): number {
  if (m.version.kind === "slides") return 9;
  const minutes = (m.version.duration ?? 1800) / 60;
  return Math.round(7 + 7 * Math.sqrt(Math.min(minutes, 60) / 60));
}

function dateLabel(date: string | undefined): string {
  return date ? date.slice(0, 7).replace("-", ".") : "";
}

export function TheaterTimelineForm() {
  const { locale } = useLocale();
  const { openVideo, openMedia } = useTheater();
  const timeline = useMemo(() => buildTimeline(locale), [locale]);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => latestMark(timeline)?.key ?? null,
  );
  const scroller = useRef<HTMLDivElement>(null);

  const selected =
    timeline.marks.find((m) => m.key === selectedKey) ??
    latestMark(timeline);
  const index = selected ? timeline.marks.indexOf(selected) : -1;

  // Open on the selected mark, at the playhead.
  useEffect(() => {
    if (scroller.current && selected) scroller.current.scrollLeft = selected.x;
    // Once, on mount: afterwards the strip is the visitor's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The mark under the playhead is the selection. The inner padding is half
  // the strip on each side, so scrollLeft *is* the playhead's x.
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const x = el.scrollLeft;
    let best: Mark | null = null;
    for (const m of timeline.marks) {
      if (
        !best ||
        Math.abs(m.x - x) < Math.abs(best.x - x) ||
        // Between two at the same distance, the viewer's lane.
        (Math.abs(m.x - x) === Math.abs(best.x - x) && m.lane === timeline.lanes[0])
      ) {
        best = m;
      }
    }
    if (best && best.key !== selectedKey) setSelectedKey(best.key);
  };

  const bringTo = (m: Mark) => {
    setSelectedKey(m.key);
    scroller.current?.scrollTo({ left: m.x, behavior: "smooth" });
  };

  const play = (m: Mark) => {
    const v = m.version;
    if (v.kind === "video") {
      openVideo({
        url: v.url,
        platform: v.platform,
        title: v.title,
        subtitle: v.subtitle,
        thumbnail: v.thumbnail,
      });
    } else {
      openMedia({ kind: "slides", url: v.url }, { id: m.key, title: v.title });
    }
  };

  if (!selected) return null;
  const v = selected.version;
  const minutes = v.duration ? Math.round(v.duration / 60) : null;
  const laneY = (lane: Mark["lane"]) =>
    timeline.lanes.indexOf(lane) * LANE_H + LANE_H / 2;
  const height = LANE_H * timeline.lanes.length + TICKS_H;

  return (
    <WidgetShell href={TALKS_HREF}>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href={TALKS_HREF} />
      </WidgetHeader>

      <div className="px-5">
        <button
          type="button"
          onClick={() => play(selected)}
          className={cn(
            "group/thumb pressable block w-full rounded-xl text-left",
            "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
          )}
        >
          <TrackThumb track={selected.track} />
        </button>
        <div className="mt-2 flex items-center gap-2">
          <div className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>{v.title}</div>
          <div className="-mr-1.5 flex shrink-0 items-center">
            {[
              { d: -1, Icon: ChevronLeft, label: "Earlier" },
              { d: 1, Icon: ChevronRight, label: "Later" },
            ].map(({ d, Icon, label }) => {
              const to = timeline.marks[index + d];
              return (
                <button
                  key={d}
                  type="button"
                  aria-label={label}
                  disabled={!to}
                  onClick={() => to && bringTo(to)}
                  className="pressable flex h-7 w-7 items-center justify-center rounded-full text-tertiary-foreground hover:bg-muted/30 hover:text-foreground disabled:opacity-30"
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
        {/* Where, then when and how long — the second never truncated. */}
        <div className={cn("flex gap-3 tabular-nums", TYPE.rowMeta)}>
          <span className="min-w-0 flex-1 truncate">{v.subtitle}</span>
          <span className="shrink-0">
            {[
              dateLabel(v.date),
              v.kind === "slides"
                ? t(locale, "logSlides")
                : minutes
                  ? `${minutes} min`
                  : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>

      {/* The strip. The playhead is fixed at its centre; the timeline moves. */}
      <div className="relative mt-3 pb-4 pl-14">
        <div
          ref={scroller}
          data-widget-inert
          onScroll={onScroll}
          className="no-scrollbar overflow-x-auto overscroll-x-contain"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 18%, black 82%, transparent)",
          }}
        >
          <div style={{ paddingInline: "50%", width: "max-content" }}>
            <div className="relative" style={{ width: timeline.width, height }}>
              {/* Lane rules, the year ticks, the pairs. */}
              <svg
                className="absolute inset-0 overflow-visible"
                width={timeline.width}
                height={height}
                aria-hidden
              >
                {timeline.lanes.map((lane) => (
                  <line
                    key={lane}
                    x1={0}
                    x2={timeline.width}
                    y1={laneY(lane)}
                    y2={laneY(lane)}
                    className="stroke-border"
                    strokeWidth={1}
                  />
                ))}
                {timeline.pairs.map(([a, b]) => (
                  <line
                    key={`${a.key}-${b.key}`}
                    x1={a.x}
                    x2={b.x}
                    y1={laneY(a.lane)}
                    y2={laneY(b.lane)}
                    className="stroke-red-500/50"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                ))}
                {timeline.years.map((y) => (
                  <line
                    key={y.year}
                    x1={y.x}
                    x2={y.x}
                    y1={LANE_H * timeline.lanes.length - 4}
                    y2={LANE_H * timeline.lanes.length + 3}
                    className="stroke-border"
                    strokeWidth={1}
                  />
                ))}
              </svg>

              {timeline.years.map((y) => (
                <span
                  key={y.year}
                  className={cn(
                    "absolute font-mono text-[10px] tabular-nums",
                    y.year === selected.year
                      ? "text-foreground"
                      : "text-quaternary-foreground",
                  )}
                  style={{ left: y.x + 3, top: LANE_H * timeline.lanes.length + 2 }}
                >
                  {y.width >= 52 || y.year === selected.year
                    ? y.year
                    : `’${String(y.year).slice(2)}`}
                </span>
              ))}

              {timeline.marks.map((m) => {
                const size = markSize(m);
                const on = m.key === selected.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-label={`${m.version.title} · ${dateLabel(m.version.date)}`}
                    aria-pressed={on}
                    onClick={() => bringTo(m)}
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center p-1.5 outline-none"
                    style={{ left: m.x, top: laneY(m.lane) }}
                  >
                    <span
                      className={cn(
                        "block rounded-full transition-[transform,background-color,border-color] duration-200",
                        m.version.kind === "slides"
                          ? cn("border-[1.5px] bg-background", on ? "border-red-500" : "border-muted-foreground")
                          : on
                            ? "bg-red-500"
                            : "bg-muted-foreground",
                        on && "scale-125 ring-2 ring-red-500/25 ring-offset-1 ring-offset-background",
                      )}
                      style={{ width: size, height: size }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lane names, over the strip's left fade. */}
        {timeline.lanes.map((lane) => (
          <span
            key={lane}
            // In a gutter of their own, so a mark never passes under a name.
            className="pointer-events-none absolute left-5 font-mono text-[10px] text-tertiary-foreground"
            style={{ top: laneY(lane) - 7 }}
          >
            {LANE_LABEL[lane]}
          </span>
        ))}

        {/* The playhead. */}
        <span
          aria-hidden
          // At the centre of the strip, not of the card: the gutter is
          // not part of the strip.
          className="pointer-events-none absolute left-[calc(50%+1.75rem)] top-0 w-px -translate-x-1/2 bg-red-500/60"
          style={{ height: LANE_H * timeline.lanes.length }}
        />
      </div>
    </WidgetShell>
  );
}
