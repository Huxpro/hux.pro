"use client";

import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AlbumTabs } from "@/systems/theater/components/album-tabs";
import { TrackThumb } from "@/systems/theater/components/track-thumb";
import { useTheater } from "@/systems/theater/provider";
import { buildTalkAlbums } from "@/systems/theater/lib/albums";
import { PRESS_CARD } from "@/systems/theater/lib/chrome";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the combined "Featured Talks" home card.
//
// Replaces the three separate React / Lynx / Personal talk widgets with one
// album-switching card: pick an album (segmented control), scroll its videos
// horizontally, tap one to open the immersive theater / PiP player. The albums
// are the same curated groups used everywhere else, so content stays in sync.
// ---------------------------------------------------------------------------

export function FeaturedTalksWidget() {
  const { locale } = useLocale();
  const { open } = useTheater();
  const albums = useMemo(() => buildTalkAlbums(locale), [locale]);
  const [activeAlbum, setActiveAlbum] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);

  const album = albums[activeAlbum] ?? null;

  const getStride = useCallback((): number | null => {
    const el = scrollRef.current;
    if (!el) return null;
    const card = el.querySelector<HTMLElement>("[data-talk-card]");
    if (!card) return null;
    const gap = Number.parseFloat(getComputedStyle(el).gap || "0");
    return card.offsetWidth + (Number.isFinite(gap) ? gap : 0);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stride = getStride();
    if (!stride) return;
    setActiveCard(Math.round(el.scrollLeft / stride));
  }, [getStride]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Reset scroll to the start whenever the album changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveCard(0);
  }, [activeAlbum]);

  if (albums.length === 0 || !album) return null;

  return (
    <WidgetShell href="/works">
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href="/works" />
      </WidgetHeader>

      <div className="px-5 pb-3">
        <AlbumTabs
          albums={albums}
          activeIndex={activeAlbum}
          onSelect={setActiveAlbum}
          raised={false}
        />
      </div>

      <div className="pb-5">
        <div
          ref={scrollRef}
          className={cn(
            "flex gap-3 pl-5 pr-5",
            "overflow-x-auto snap-x snap-mandatory scroll-pl-5 scroll-smooth",
            "no-scrollbar",
          )}
        >
          {album.tracks.map((track, i) => (
            <button
              key={track.id}
              data-talk-card
              onClick={() =>
                open({ albums, albumIndex: activeAlbum, trackIndex: i })
              }
              // Cards sink slightly under the finger (iOS card press) and
              // spring back on release.
              className={cn(
                "group/thumb w-[86%] max-w-[200px] shrink-0 snap-start rounded-xl text-left",
                "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
                PRESS_CARD,
              )}
            >
              <TrackThumb track={track} />
              <div className={cn("mt-2 truncate", TYPE.rowTitle)}>
                {track.title}
              </div>
              {track.subtitle && (
                <div className={cn("mt-0.5 truncate", TYPE.labelWide)}>
                  {track.subtitle}
                </div>
              )}
            </button>
          ))}
          <div className="w-5 shrink-0" aria-hidden />
        </div>

        {album.tracks.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3">
            {album.tracks.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === activeCard ? "w-3 bg-foreground/45" : "w-1.5 bg-foreground/15",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
