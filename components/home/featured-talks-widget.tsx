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

import { APPLE } from "@/lib/apple-type";
import { TYPE } from "@/lib/typography";
import type { Album, Track } from "@/systems/theater/lib/types";
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

/** A track and where it lives, so a press can open the theater on it. */
interface Pick {
  track: Track;
  albumIndex: number;
  trackIndex: number;
}

/**
 * The albums interleaved — each album's first talk, then each one's second —
 * so a card with no tabs still shows all of them, newest-curated first. A
 * talk curated into two albums shows once, from the first that has it.
 */
function interleave(albums: Album[]): Pick[] {
  const out: Pick[] = [];
  const seen = new Set<string>();
  const depth = Math.max(0, ...albums.map((a) => a.tracks.length));
  for (let ti = 0; ti < depth; ti++) {
    albums.forEach((album, albumIndex) => {
      const track = album.tracks[ti];
      if (!track || seen.has(track.id)) return;
      seen.add(track.id);
      out.push({ track, albumIndex, trackIndex: ti });
    });
  }
  return out;
}

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

  // Apple skin: no tabs and no strip. A widget has no scroll gesture and
  // no segmented control — "avoid creating app-like layouts" — so the card
  // shows a choice across the albums instead of a browser of one.
  const picks = interleave(albums);
  const openPick = (p: Pick) =>
    open({ albums, albumIndex: p.albumIndex, trackIndex: p.trackIndex });

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

        <div className="px-(--widget-pad) pb-3 skin-apple:hidden">
          <AlbumTabs
            albums={albums}
            activeIndex={activeAlbum}
            onSelect={setActiveAlbum}
            raised={false}
          />
        </div>

        {/* Apple skin: covers across the albums, two rows of four once the
            cell is past ~130px (Apple's 16px margins leave the room Classic's
            tabs took), each with its title and where it was given. */}
        <WidgetBody fill className="hidden justify-center skin-apple:flex">
          <div className="grid grid-cols-4 gap-x-3 gap-y-3 overflow-hidden [&>*:nth-child(n+5)]:hidden @min-[560px]:[&>*:nth-child(n+5)]:block">
            {picks.slice(0, GALLERY_MAX).map((p) => (
              <button
                key={p.track.id}
                type="button"
                onClick={() => openPick(p)}
                className={cn(THUMB_PRESS, "min-w-0")}
              >
                <TrackThumb track={p.track} />
                <div className={cn("mt-2 truncate text-foreground", APPLE.footnoteEmph)}>
                  {p.track.title}
                </div>
                <div className={cn("truncate text-muted-foreground", APPLE.footnote)}>
                  {p.track.subtitle ?? albums[p.albumIndex].title}
                </div>
              </button>
            ))}
          </div>
        </WidgetBody>

        <WidgetBody fill className="justify-center skin-apple:hidden">
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
      <div className="px-(--widget-pad) pb-3 skin-apple:hidden">
        <AlbumTabs
          albums={albums}
          activeIndex={activeAlbum}
          onSelect={setActiveAlbum}
          raised={false}
        />
      </div>

      {/* Apple skin: Up Next. The lead talk as a cover with its title under
          it, then the next across the other albums as rows — the TV app's
          large widget, which is the same problem: a shelf of video and no
          room to browse it. Titles sit under the art, never on it: talk
          covers carry their own lettering. The rows wrap into a clipped
          second column rather than show half a row when the cell is short. */}
      <WidgetBody fill className="hidden skin-apple:flex">
        {picks[0] && (
          <button
            type="button"
            onClick={() => openPick(picks[0])}
            className={cn(THUMB_PRESS, "block shrink-0")}
          >
            <TrackThumb track={picks[0].track} className="rounded-[10px] border-0" />
            <div className={cn("mt-2 truncate text-foreground", APPLE.subheadlineEmph)}>
              {picks[0].track.title}
            </div>
            <div className={cn("truncate text-muted-foreground", APPLE.footnote)}>
              {picks[0].track.subtitle ?? albums[picks[0].albumIndex].title}
            </div>
          </button>
        )}
        <div className="mt-1.5 flex min-h-0 flex-1 flex-col flex-wrap content-start overflow-hidden">
          {picks.slice(1, 4).map((p) => (
            <button
              key={p.track.id}
              type="button"
              onClick={() => openPick(p)}
              className={cn(
                THUMB_PRESS,
                "relative flex w-full items-center gap-3 rounded-lg py-1.5",
                "after:absolute after:inset-x-0 after:top-0 after:h-px after:origin-top after:scale-y-50 after:bg-(--apple-separator)",
              )}
            >
              <TrackThumb track={p.track} className="w-16 shrink-0 rounded-md border-0" />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-foreground", APPLE.footnoteEmph)}>
                  {p.track.title}
                </div>
                <div className={cn("truncate text-muted-foreground", APPLE.footnote)}>
                  {p.track.subtitle ?? albums[p.albumIndex].title}
                </div>
              </div>
            </button>
          ))}
        </div>
      </WidgetBody>

      <div className="flex min-h-0 flex-1 flex-col justify-center pb-5 skin-apple:hidden">
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
                // Apple skin: a cover the card is built around, as Podcasts'
                // large widget sets its episode art — not a thumbnail in a
                // field of white.
                "skin-apple:max-w-[260px]",
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
