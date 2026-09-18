"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import type { WidgetSize } from "@/components/ui/widget-size";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AlbumTabs, TrackThumb, useTheater } from "@/systems/theater";
import { buildTalkAlbums } from "@/systems/theater/lib/albums";
import { PRESS_CARD } from "@/systems/theater/lib/chrome";
import { Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the combined "Featured Talks" home card, in three
// sizes.
//
//   medium  one talk: the first track of the first album, cover beside its
//           title, as a single thing to press play on. No albums, no
//           paging — a medium has one row's height, and one row is one
//           talk.
//   large   the albums: pick one (segmented control), scroll its videos
//           horizontally, tap one to open the immersive theater / PiP
//           player — the card the widget has always been.
//   xl      the gallery: the same albums, but a page wide enough to lay
//           four covers side by side without a carousel, and eight in two
//           rows once the cells are tall enough. The album is visible
//           whole; nothing needs a swipe.
//
// The albums are the same curated groups used everywhere else, so content
// stays in sync.
// ---------------------------------------------------------------------------

export const TALKS_WIDGET_SIZES: readonly WidgetSize[] = ["medium", "large", "xl"];

/** Covers the gallery lays out, at most — one or two rows of four. */
const GALLERY_MAX = 8;

export function FeaturedTalksWidget({ size = "large" }: { size?: WidgetSize }) {
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

  // ---------------------------------------------------------------------------
  // medium — one talk
  // ---------------------------------------------------------------------------
  if (size === "medium") {
    const track = albums[0].tracks[0];
    return (
      <WidgetShell href="/works">
        <WidgetHeader className="pb-2">
          <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
          <WidgetLink href="/works" />
        </WidgetHeader>
        <WidgetBody fill className="justify-center">
          <button
            type="button"
            onClick={() => open({ albums, albumIndex: 0, trackIndex: 0 })}
            className={cn(
              "group/thumb -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-left",
              "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
              PRESS_CARD,
            )}
          >
            <div className="relative w-[44%] shrink-0">
              <TrackThumb track={track} />
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover/thumb:scale-105">
                  <Play className="h-3 w-3 translate-x-px" fill="currentColor" />
                </span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("mb-1", TYPE.rowMeta)}>
                {t(locale, "widgetWatch")}
              </div>
              <div className={cn("line-clamp-2", TYPE.rowTitle)}>
                {track.title}
              </div>
              {track.subtitle && (
                <div className={cn("mt-1 truncate", TYPE.labelSm)}>
                  {track.subtitle}
                </div>
              )}
            </div>
          </button>
        </WidgetBody>
      </WidgetShell>
    );
  }

  // ---------------------------------------------------------------------------
  // xl — the gallery
  // ---------------------------------------------------------------------------
  if (size === "xl") {
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

        <WidgetBody fill className="justify-center">
          <div
            className={cn(
              "grid grid-cols-4 gap-3 overflow-hidden",
              // Cells are square, so width stands in for height: the second
              // row of covers only shows once the card is wide enough to be
              // tall enough for it.
              "[&>*:nth-child(n+5)]:hidden @min-[744px]:[&>*:nth-child(n+5)]:block",
            )}
          >
            {album.tracks.slice(0, GALLERY_MAX).map((track, i) => (
              <button
                key={track.id}
                type="button"
                onClick={() =>
                  open({ albums, albumIndex: activeAlbum, trackIndex: i })
                }
                className={cn(
                  "group/thumb min-w-0 rounded-xl text-left",
                  "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
                  PRESS_CARD,
                )}
              >
                <TrackThumb track={track} />
                <div className={cn("mt-2 truncate", TYPE.rowTitle)}>
                  {track.title}
                </div>
                {track.subtitle && (
                  <div className={cn("mt-0.5 truncate", TYPE.labelSm)}>
                    {track.subtitle}
                  </div>
                )}
              </button>
            ))}
          </div>
        </WidgetBody>
      </WidgetShell>
    );
  }

  // ---------------------------------------------------------------------------
  // large — the albums
  // ---------------------------------------------------------------------------
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

      <div className="flex min-h-0 flex-1 flex-col justify-center pb-5">
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
