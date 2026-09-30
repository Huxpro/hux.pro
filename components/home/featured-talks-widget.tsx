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
import { buildLibraryAlbums } from "@/systems/theater/lib/albums";
import { featuredTracks } from "@/systems/theater/lib/library";
import { useEffect, useMemo, useState } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the theater's front on the home grid.
//
// Tabs by language, the viewer's first (中文 / EN): each shows the featured
// media from content/theater.json that can be heard in that language, in its
// telling in that language, and ends in a card that opens the rest of that
// shelf. A talk given in both languages is on both tabs, once on each. What
// the card shows is chosen in theater.json — never by what kind of commit
// lists the media.
// ---------------------------------------------------------------------------

/** Where the card's surface and its arrow go. */
const TALKS_HREF = "/works?type=talk";

export function FeaturedTalksWidget() {
  const { locale } = useLocale();
  const { open } = useTheater();
  const albums = useMemo(() => buildLibraryAlbums(locale), [locale]);
  const [activeAlbum, setActiveAlbum] = useState(0);
  const album = albums[activeAlbum] ?? albums[0] ?? null;
  const featured = useMemo(
    () => (album ? featuredTracks(album.tracks, locale) : []),
    [album, locale],
  );
  const rest = useMemo(
    () => (album?.tracks ?? []).filter((tk) => !featured.includes(tk)),
    [album, featured],
  );

  // The featured covers, then the way into the rest.
  const cards = featured.length + (rest.length > 0 ? 1 : 0);
  const { scrollRef, index: activeCard, scrollTo } = useSnapPager(cards);

  // Back to the start whenever the tab changes.
  useEffect(() => {
    scrollTo(0, "instant");
  }, [activeAlbum, scrollTo]);

  if (!album) return null;

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
          {featured.map((track) => (
            <button
              key={track.id}
              type="button"
              data-pager-card
              onClick={() =>
                open({
                  albums,
                  albumIndex: activeAlbum,
                  trackIndex: album.tracks.indexOf(track),
                })
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

          {/* The rest of this shelf: the theater at the first piece not
              featured. Its cover is the rest's covers. */}
          {rest.length > 0 && (
            <button
              type="button"
              data-pager-card
              onClick={() =>
                open({
                  albums,
                  albumIndex: activeAlbum,
                  trackIndex: album.tracks.indexOf(rest[0]),
                })
              }
              className={cn(
                "group/thumb pressable w-[86%] max-w-[200px] shrink-0 snap-start rounded-xl text-left",
                "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
          )}
          >
            <div className="relative grid aspect-video grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-lg border border-border/40">
              {rest.slice(0, 4).map((track) => (
                <TrackThumb
                  key={track.id}
                  track={track}
                  className="rounded-none border-0"
                />
              ))}
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 font-mono text-lg tabular-nums text-white transition-colors group-hover/thumb:bg-black/55">
                +{rest.length}
              </span>
            </div>
            <div className={cn("mt-2 truncate", TYPE.rowTitle)}>
              {t(locale, "theaterSeeAll")}
            </div>
            <div className={cn("mt-0.5 truncate", TYPE.label)}>
              {album.title} · {album.tracks.length}
            </div>
          </button>
          )}
          <div className="w-5 shrink-0" aria-hidden />
        </div>

        <PagerDots
          count={cards}
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
