"use client";

import { PagerDots, useSnapPager } from "@/components/ui/snap-pager";
import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
  WIDGET_REVEAL,
} from "@/components/ui/widget";
import type { WidgetSize } from "@/components/ui/widget-size";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AlbumTabs, TrackThumb, useTheater } from "@/systems/theater";
import { buildTalkAlbums } from "@/systems/theater/lib/albums";
import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the combined "Featured Talks" home card, in three
// sizes.
//
//   medium  one talk: the first track of the first album, cover beside its
//           title, as a single thing to press play on. No albums, no
//           paging — a medium has one row's height, and one row is one
//           talk.
//   large   the albums: the card below, as it has always been.
//   xl      the gallery: the same albums, but a page wide enough to lay
//           four covers side by side without a carousel, and eight in two
//           rows once the cells are tall enough. The album is visible
//           whole; nothing needs a swipe.
//
// Replaces the three separate React / Lynx / Personal talk widgets with one
// album-switching card: pick an album (segmented control), scroll its videos
// horizontally, tap one to open the immersive theater / PiP player. The albums
// are the same curated groups used everywhere else, so content stays in sync.
//
// The card hands off to the reading of /works it is a preview of, not to the
// page's default: a card about talks that lands you in a column of twenty-five
// commits has made you do the filtering it was already doing for you.
// ---------------------------------------------------------------------------

/** Where the card's surface and its arrow go. */
const TALKS_HREF = "/works?type=talk";

export const TALKS_WIDGET_SIZES: readonly WidgetSize[] = ["medium", "large", "xl"];

/** Covers the gallery lays out, at most — one or two rows of four. */
const GALLERY_MAX = 8;

/** A cover's press: dims under the finger (`group/thumb` + `pressable`),
 *  never scales the card — see TrackThumb. */
const THUMB_PRESS = cn(
  "group/thumb pressable rounded-xl text-left",
  "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
);

export function FeaturedTalksWidget({ size = "large" }: { size?: WidgetSize }) {
  const { locale } = useLocale();
  const { open } = useTheater();
  const albums = useMemo(() => buildTalkAlbums(locale), [locale]);
  const [activeAlbum, setActiveAlbum] = useState(0);

  const album = albums[activeAlbum] ?? null;
  const { scrollRef, index: activeCard, scrollTo } = useSnapPager(
    album?.tracks.length ?? 0,
  );

  // Reset scroll to the start whenever the album changes.
  useEffect(() => {
    scrollTo(0, "instant");
  }, [activeAlbum, scrollTo]);

  if (albums.length === 0 || !album) return null;

  // ---------------------------------------------------------------------------
  // medium — one talk
  // ---------------------------------------------------------------------------
  if (size === "medium") {
    const track = albums[0].tracks[0];
    return (
      <WidgetShell accent="purple" href={TALKS_HREF}>
        <WidgetHeader className="pb-2">
          <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
          <WidgetLink href={TALKS_HREF} />
        </WidgetHeader>
        <WidgetBody fill className="justify-center">
          <button
            type="button"
            onClick={() => open({ albums, albumIndex: 0, trackIndex: 0 })}
            className={cn(THUMB_PRESS, "-mx-2 flex items-center gap-3 px-2 py-1.5")}
          >
            <div className="relative w-[44%] shrink-0">
              <TrackThumb track={track} />
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
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
      <WidgetShell accent="purple" href={TALKS_HREF}>
        <WidgetHeader className="pb-3">
          <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
          <WidgetLink href={TALKS_HREF} />
        </WidgetHeader>

        <div className="px-(--widget-pad) pb-3">
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
                className={cn(THUMB_PRESS, "min-w-0")}
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
    <WidgetShell accent="purple" href={TALKS_HREF}>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href={TALKS_HREF} />
      </WidgetHeader>

      {/* Tabs and thumbs are sibling press surfaces. The shell is
          `group/widget`; AlbumTabs is `group/glass`. A finger on a
          thumbnail must not deepen the segmented control. */}
      <div className="px-(--widget-pad) pb-3">
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
            "flex gap-3 px-(--widget-pad)",
            "overflow-x-auto snap-x snap-mandatory scroll-pl-(--widget-pad) scroll-smooth",
            "no-scrollbar",
          )}
        >
          {album.tracks.map((track, i) => (
            <button
              key={track.id}
              type="button"
              data-pager-card
              onClick={() =>
                open({ albums, albumIndex: activeAlbum, trackIndex: i })
              }
              className={cn(
                "group/thumb pressable w-[86%] max-w-[200px] shrink-0 snap-start rounded-xl text-left",
                "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
              )}
            >
              <TrackThumb track={track} />
              <div className={cn("mt-2 truncate", TYPE.rowTitle)}>
                {track.title}
              </div>
              {track.subtitle && (
                <div className={cn("mt-0.5 truncate", TYPE.label)}>
                  {track.subtitle}
                </div>
              )}
            </button>
          ))}
          <div className="w-(--widget-pad) shrink-0" aria-hidden />
        </div>

        <PagerDots
          count={album.tracks.length}
          index={activeCard}
          onSelect={scrollTo}
          // A pointer's way to page the strip (a wheel cannot scroll it
          // sideways), shown with the card; a finger swipes, and the peek
          // of the next cover already says it can.
          className={cn("pt-3 pointer-coarse:hidden", WIDGET_REVEAL)}
        />
      </div>
    </WidgetShell>
  );
}
