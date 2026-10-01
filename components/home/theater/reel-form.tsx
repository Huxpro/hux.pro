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
import { TrackThumb, useTheater, type Album, type Track } from "@/systems/theater";
import { buildLibraryAlbums } from "@/systems/theater/lib/albums";
import { featuredTracks } from "@/systems/theater/lib/library";
import { useMemo } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// TheaterReelForm — the theater widget's "featured" form (widgets.ts) — the theater's front on the home grid.
//
// One strip, no tabs: the featured media from content/theater.json, the ones
// the viewer can hear in their own language first. Tap a cover and the
// theater opens on it with the whole library around it; the last card opens
// the library itself. What the card shows is chosen in theater.json — never
// by what kind of commit lists the media.
// ---------------------------------------------------------------------------

/** Where the card's surface and its arrow go. */
const TALKS_HREF = "/works?type=talk";

/** Where a track sits in the library's shelves. */
function locate(albums: Album[], track: Track) {
  for (let a = 0; a < albums.length; a++) {
    const i = albums[a].tracks.indexOf(track);
    if (i >= 0) return { albumIndex: a, trackIndex: i };
  }
  return { albumIndex: 0, trackIndex: 0 };
}

export function TheaterReelForm() {
  const { locale } = useLocale();
  const { open } = useTheater();
  const albums = useMemo(() => buildLibraryAlbums(locale), [locale]);
  const featured = useMemo(
    () =>
      featuredTracks(
        albums.flatMap((a) => a.tracks),
        locale,
      ),
    [albums, locale],
  );
  const rest = useMemo(
    () => albums.flatMap((a) => a.tracks).filter((tk) => !featured.includes(tk)),
    [albums, featured],
  );

  // The featured covers, then the way into the rest.
  const { scrollRef, index: activeCard, scrollTo } = useSnapPager(
    featured.length + 1,
  );

  if (featured.length === 0) return null;

  return (
    <WidgetShell href={TALKS_HREF}>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href={TALKS_HREF} />
      </WidgetHeader>

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
              onClick={() => open({ albums, ...locate(albums, track) })}
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

          {/* The rest of the library: the theater at its newest piece, with
              every shelf a tab away. Its cover is the rest's covers. */}
          <button
            type="button"
            data-pager-card
            onClick={() => open({ albums })}
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
              {albums.map((a) => `${a.title} ${a.tracks.length}`).join(" · ")}
            </div>
          </button>
          <div className="w-5 shrink-0" aria-hidden />
        </div>

        <PagerDots
          count={featured.length + 1}
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
