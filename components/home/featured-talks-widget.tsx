"use client";

import { PagerDots, useSnapPager } from "@/components/ui/snap-pager";
import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
  WIDGET_REVEAL,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AlbumTabs, TrackThumb, useTheater } from "@/systems/theater";
import { buildTalkAlbums } from "@/systems/theater/lib/albums";
import { useEffect, useMemo, useState } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the combined "Featured Talks" home card.
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

export function FeaturedTalksWidget() {
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

  return (
    <WidgetShell href={TALKS_HREF}>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href={TALKS_HREF} />
      </WidgetHeader>

      {/* Tabs and thumbs are sibling press surfaces. The shell is
          `group/widget`; AlbumTabs is `group/glass`. A finger on a
          thumbnail must not deepen the segmented control. */}
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
          <div className="w-5 shrink-0" aria-hidden />
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
