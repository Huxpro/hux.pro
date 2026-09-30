"use client";

import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { TrackThumb, useTheater, type Track } from "@/systems/theater";
import { buildLibraryAlbums, yearOf } from "@/systems/theater/lib/albums";
import { featuredTracks } from "@/systems/theater/lib/library";
import { useMemo } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the theater's front on the home grid.
//
// A marquee and a short bill: the first featured piece large, the next few as
// rows, and a last row that opens everything. No tabs and no sideways strip —
// the library is one reel in time order, and the card reads like the top of
// it. Featured media come from content/theater.json, the ones the viewer can
// hear in their own language first.
// ---------------------------------------------------------------------------

/** Where the card's surface and its arrow go. */
const TALKS_HREF = "/works?type=talk";

/** Rows under the marquee. */
const ROWS = 3;

/** Where, and when — unless the venue's name already says the year. */
function metaOf(track: Track): string {
  const year = /\b(19|20)\d{2}\b/.test(track.subtitle ?? "")
    ? null
    : yearOf(track);
  return [track.subtitle, year].filter(Boolean).join(" · ");
}

export function FeaturedTalksWidget() {
  const { locale } = useLocale();
  const { open } = useTheater();
  const albums = useMemo(() => buildLibraryAlbums(locale), [locale]);
  const library = albums[0] ?? null;
  const featured = useMemo(
    () => (library ? featuredTracks(library.tracks, locale) : []),
    [library, locale],
  );

  if (!library || featured.length === 0) return null;

  const [marquee, ...bill] = featured;
  const play = (track: Track) =>
    open({ albums, albumIndex: 0, trackIndex: library.tracks.indexOf(track) });

  return (
    <WidgetShell href={TALKS_HREF}>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href={TALKS_HREF} />
      </WidgetHeader>

      <div className="px-5 pb-3">
        <button
          type="button"
          onClick={() => play(marquee)}
          className={cn(
            "group/thumb pressable block w-full rounded-xl text-left",
            "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
          )}
        >
          <TrackThumb track={marquee} />
          <div className={cn("mt-2 truncate", TYPE.rowTitle)}>
            {marquee.title}
          </div>
          <div className={cn("mt-0.5 truncate", TYPE.rowMeta)}>
            {metaOf(marquee)}
          </div>
        </button>
      </div>

      <div className="flex flex-col px-5 pb-3">
        {bill.slice(0, ROWS).map((track) => (
          <button
            key={track.id}
            type="button"
            onClick={() => play(track)}
            className={cn(
              "group/thumb pressable -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-left",
              "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
              "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
            )}
          >
            <span className="w-16 shrink-0">
              <TrackThumb track={track} className="rounded-md" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate", TYPE.rowTitle)}>
                {track.title}
              </span>
              <span className={cn("block truncate", TYPE.rowMeta)}>
                {metaOf(track)}
              </span>
            </span>
          </button>
        ))}

        {/* Everything else: the theater at the newest piece, the whole reel
            in its rail. */}
        <button
          type="button"
          onClick={() => open({ albums })}
          className={cn(
            "pressable -mx-2 mt-1 flex items-baseline justify-between rounded-lg px-2 py-2 text-left",
            "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
            "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
          )}
        >
          <span className={TYPE.rowTitle}>{t(locale, "theaterSeeAll")}</span>
          <span className={cn("tabular-nums", TYPE.rowMeta)}>
            {library.tracks.length}
          </span>
        </button>
      </div>
    </WidgetShell>
  );
}
