"use client";

import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AlbumTabs, TrackThumb, useTheater } from "@/systems/theater";
import {
  buildChannels,
  onAir,
  upNext,
} from "@/systems/theater/lib/channel";
import { useMemo, useState, useSyncExternalStore } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the theater as television.
//
// Two channels, one per language, the viewer's first. The card shows what is
// on the chosen channel right now — the same program for everyone, because it
// is a function of the clock (systems/theater/lib/channel.ts) — how far into
// it the broadcast is, and what comes on after. Tapping the program tunes in:
// the theater opens on the channel at that program, that far in, and plays on
// from there.
//
// Time is read only in the browser. The server renders the card's frame; the
// program arrives on mount, so no clock ever has to agree with another.
// ---------------------------------------------------------------------------

/** Where the card's surface and its arrow go. */
const TALKS_HREF = "/works?type=talk";

/** Programs listed under the one on air. */
const GUIDE = 2;

/**
 * The wall clock to the second — null on the server and in the hydrating
 * render, so the markup never depends on whose clock rendered it.
 */
function subscribeClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const readClock = () => Math.floor(Date.now() / 1000) * 1000;
function useNow(): number | null {
  return useSyncExternalStore<number | null>(subscribeClock, readClock, () => null);
}

function clock(ms: number, locale: string): string {
  return new Date(ms).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FeaturedTalksWidget() {
  const { locale } = useLocale();
  const { open } = useTheater();
  const channels = useMemo(() => buildChannels(locale), [locale]);
  const [active, setActive] = useState(0);
  const channel = channels[active] ?? channels[0] ?? null;
  const now = useNow();

  if (!channel) return null;

  const live = now === null ? null : onAir(channel, now);
  const guide = now === null ? [] : upNext(channel, now, GUIDE);
  const duration = live?.track.duration ?? 0;
  const progress = live && duration ? live.offset / duration : 0;
  const minutesLeft = live ? Math.max(1, Math.ceil((duration - live.offset) / 60)) : 0;

  const tuneIn = () => {
    if (!live) return;
    open({
      albums: channels,
      albumIndex: channels.indexOf(channel),
      trackIndex: live.index,
      startAt: live.offset,
    });
  };

  return (
    <WidgetShell href={TALKS_HREF}>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <span className="ml-auto mr-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-red-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/60 motion-reduce:hidden" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          {t(locale, "theaterOnAir")}
        </span>
        <WidgetLink href={TALKS_HREF} />
      </WidgetHeader>

      <div className="px-5 pb-3">
        <AlbumTabs
          albums={channels}
          activeIndex={active}
          onSelect={setActive}
          raised={false}
        />
      </div>

      <div className="px-5 pb-3">
        <button
          type="button"
          onClick={tuneIn}
          disabled={!live}
          className={cn(
            "group/thumb pressable block w-full rounded-xl text-left",
            "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
          )}
        >
          <div className="relative">
            {live ? (
              <TrackThumb track={live.track} />
            ) : (
              <div className="aspect-video w-full rounded-lg border border-border/40 bg-muted/20" />
            )}
            {/* The broadcast's position: how far into this program it is. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-lg bg-black/25">
              <div
                className="h-full bg-red-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
          <div className={cn("mt-2 truncate", TYPE.rowTitle)}>
            {live?.track.title ?? " "}
          </div>
          <div className={cn("mt-0.5 flex gap-2", TYPE.rowMeta)}>
            <span className="min-w-0 flex-1 truncate">{live?.track.subtitle}</span>
            {live && (
              <span className="shrink-0 tabular-nums">
                {t(locale, "theaterMinutesLeft").replace("{n}", String(minutesLeft))}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* The program guide: what comes on after, at what time here. */}
      <div className="px-5 pb-4">
        <div className={cn("pb-1", TYPE.rowMeta)}>{t(locale, "theaterUpNext")}</div>
        {guide.map((slot) => (
          <button
            key={`${slot.index}-${slot.startsAt}`}
            type="button"
            onClick={() =>
              open({
                albums: channels,
                albumIndex: channels.indexOf(channel),
                trackIndex: slot.index,
              })
            }
            className={cn(
              "pressable -mx-2 flex w-[calc(100%+1rem)] items-baseline gap-3 rounded-lg px-2 py-1.5 text-left",
              "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
              "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
            )}
          >
            <span className={cn("w-10 shrink-0 tabular-nums", TYPE.rowMeta)}>
              {clock(slot.startsAt, locale)}
            </span>
            <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>
              {slot.track.title}
            </span>
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}
