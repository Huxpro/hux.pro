"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import type { WidgetSize } from "@/components/ui/widget-size";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  FastForward,
  ListMusic,
  Music,
  Pause,
  Play,
  Rewind,
} from "lucide-react";
import type { ReactNode } from "react";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { EQBars, NowPlaying } from "./now-playing";

// ---------------------------------------------------------------------------
// Music Widget — homepage grid card, in two sizes.
//
//   small   the cover: one play / pause, the title and artist at the foot —
//           the card's tap opens the playlist, where everything else lives.
//   medium  the player: art beside the title and artist, with the full
//           transport under them.
//
// Two skins (docs/system-widget-skin.md):
//
//   Classic  small: the art full bleed under a scrim. Medium: the shared
//            <NowPlaying /> body the Live Activity also renders.
//   Apple    Apple Music's own widget. The tile is the artwork, blurred and
//            dimmed into a field of its colour (`.widget-backdrop`), with the
//            cover itself set on it sharp and rounded — small: top-left, with
//            play / pause beside it; medium: a square the height of the card,
//            with the transport beside it in white glyphs, no chrome. Under
//            Glass: Clear the field goes and the tile is glass, but the cover
//            keeps its colour: the HIG reserves full colour for media, "such
//            as album art for a music app's widget".
//
// The YouTube player itself lives in MusicProvider (always mounted) so audio
// survives navigation. This widget is purely a control surface bound to the
// global player state.
// ---------------------------------------------------------------------------

export const MUSIC_WIDGET_SIZES: readonly WidgetSize[] = ["small", "medium"];

/** Apple Music's own red, for a widget with nothing playing to borrow from. */
const MUSIC_IDLE_FIELD = "linear-gradient(180deg, #fb5c74 0%, #fa233b 100%)";

export function MusicWidget({ size = "medium" }: { size?: WidgetSize }) {
  const { locale } = useLocale();
  const { track, playerState, openPlaylist, play, pause, next, previous } =
    useMusic();

  if (!PLAYLIST_ID) return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";

  // EQ bars visible when actively playing or buffering (stable across transitions)
  const showEQ = !!track && (isPlaying || isLoading);
  const title = t(locale, isPlaying || isLoading ? "widgetMusic" : "widgetMusicIdle");
  const small = size === "small";

  // The field behind an Apple tile: the artwork, blurred past recognition
  // and dimmed so white text reads on any cover; Music's red when idle.
  const backdrop = (
    <div
      aria-hidden
      className="widget-backdrop pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={track ? undefined : { backgroundImage: MUSIC_IDLE_FIELD }}
    >
      {track && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote cover art, same as NowPlaying */}
          <img
            src={track.thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full scale-150 object-cover blur-2xl saturate-150"
          />
          <div className="absolute inset-0 bg-black/30" />
        </>
      )}
    </div>
  );

  const cover = (className: string) =>
    track ? (
      // eslint-disable-next-line @next/next/no-img-element -- remote cover art, same as NowPlaying
      <img
        src={track.thumbnailUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-[10px] object-cover shadow-[0_4px_14px_rgb(0_0_0/0.28)]",
          className,
        )}
      />
    ) : (
      <div
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[10px] bg-white/20",
          className,
        )}
      >
        <Music className="h-1/3 w-1/3 text-foreground" />
      </div>
    );

  const playLabel = isPlaying ? "Pause" : "Play";
  const onPlayPause = isPlaying ? pause : play;

  const appleSmall = (
    <div className="hidden h-full flex-col justify-between p-(--widget-pad) skin-apple:flex">
      <div className="flex items-start justify-between gap-2">
        {cover("aspect-square w-[58%]")}
        <GlyphButton
          label={playLabel}
          onClick={onPlayPause}
          className="size-8 bg-white/90 text-black hover:bg-white active:bg-white/80 [html.glass-clear_&]:bg-foreground [html.glass-clear_&]:text-background"
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
          )}
        </GlyphButton>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {showEQ && <EQBars className="shrink-0 text-foreground" />}
          <div className="truncate text-[13px] font-semibold leading-4 text-foreground">
            {track?.title ?? t(locale, "musicNotPlaying")}
          </div>
        </div>
        <div className="mt-0.5 truncate text-[13px] leading-4 text-muted-foreground capitalize">
          {track?.artist ?? title}
        </div>
      </div>
    </div>
  );

  const appleMedium = (
    <div className="hidden h-full gap-3.5 p-(--widget-pad) skin-apple:flex">
      {cover("aspect-square h-full")}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold leading-4 text-muted-foreground">
            {showEQ && <EQBars className="shrink-0 text-foreground" />}
            <span className="truncate capitalize">{title}</span>
          </div>
          <div className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">
            {track?.title ?? t(locale, "musicNotPlaying")}
          </div>
          {track?.artist && (
            <div className="mt-0.5 truncate text-[13px] leading-4 text-muted-foreground">
              {track.artist}
            </div>
          )}
        </div>
        <div className="-ml-2 flex items-center gap-1">
          {track && (
            <GlyphButton label="Previous track" onClick={previous}>
              <Rewind className="h-4 w-4" fill="currentColor" />
            </GlyphButton>
          )}
          <GlyphButton label={playLabel} onClick={onPlayPause}>
            {isPlaying ? (
              <Pause className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play className="h-5 w-5 translate-x-px" fill="currentColor" />
            )}
          </GlyphButton>
          {track && (
            <GlyphButton label="Next track" onClick={next}>
              <FastForward className="h-4 w-4" fill="currentColor" />
            </GlyphButton>
          )}
          <GlyphButton
            label={t(locale, "musicOpenPlaylist")}
            onClick={openPlaylist}
            className="ml-auto"
          >
            <ListMusic className="h-4 w-4" />
          </GlyphButton>
        </div>
      </div>
    </div>
  );

  if (small) {
    return (
      <WidgetShell accent="pink" ink="light" onOpen={openPlaylist}>
        {backdrop}
        {appleSmall}
        {track && (
          <>
            {/* Classic: the art is the surface — full bleed, under a scrim
                that keeps the text on it legible whatever the cover is. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- remote cover art, same as NowPlaying */}
            <img
              src={track.thumbnailUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover skin-apple:hidden"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/70 skin-apple:hidden"
            />
          </>
        )}
        {/* Everything on the art is drawn in white ink, not the theme's:
            it reads off the cover, which has no theme. */}
        <div
          className={cn(
            "relative flex h-full flex-col skin-apple:hidden",
            track && "text-white",
          )}
        >
          <WidgetHeader className="pb-0">
            <div className="flex items-center gap-2 min-w-0">
              {showEQ && <EQBars className={track ? "text-white" : "text-green-500"} />}
              <WidgetTitle
                className={cn("truncate", track && "text-white/85")}
              >
                {title}
              </WidgetTitle>
            </div>
          </WidgetHeader>

          <WidgetBody fill className="justify-end">
            {track ? (
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className={cn("truncate", TYPE.mediaTitle, "text-white")}>
                    {track.title}
                  </div>
                  {track.artist && (
                    <div className={cn("mt-0.5 truncate", TYPE.meta, "text-white/70")}>
                      {track.artist}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onPlayPause}
                  aria-label={playLabel}
                  className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-black shadow-raised transition-transform hover:scale-105 active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" fill="currentColor" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-3">
                <div className={cn("min-w-0 truncate", TYPE.meta)}>
                  {t(locale, "musicNotPlaying")}
                </div>
                <button
                  type="button"
                  onClick={play}
                  aria-label="Play"
                  className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-foreground transition-colors hover:bg-muted/60 active:bg-muted/70"
                >
                  {isLoading ? (
                    <Music className="h-3.5 w-3.5 text-quaternary-foreground" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                  )}
                </button>
              </div>
            )}
          </WidgetBody>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell accent="pink" ink="light" onOpen={openPlaylist}>
      {backdrop}
      {appleMedium}
      <WidgetHeader className="pb-3 skin-apple:hidden">
        <div className="flex items-center gap-2 min-w-0">
          {showEQ && <EQBars className="text-green-500" />}
          <WidgetTitle className="truncate">{title}</WidgetTitle>
        </div>
      </WidgetHeader>

      <WidgetBody fill className="justify-center pb-6 skin-apple:hidden">
        <NowPlaying raised={false} />
      </WidgetBody>
    </WidgetShell>
  );
}

/** A bare glyph control on an Apple music tile: white ink, a round press
 *  wash, no chrome — the transport Apple draws on its own media widgets. */
function GlyphButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pressable flex size-9 shrink-0 items-center justify-center rounded-full text-foreground",
        "transition-colors hover:bg-foreground/10 active:bg-foreground/20",
        className,
      )}
    >
      {children}
    </button>
  );
}
