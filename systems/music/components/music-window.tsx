"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useSurfaceContext } from "@/systems/surface";
import { FastForward, Music, Pause, Play, Rewind } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { NowPlaying } from "./now-playing";
import { TrackList } from "./playlist-sheet";

// =============================================================================
// MusicWindow — the Music app
//
// On a phone the window is a sheet, and a sheet should stay what it was: the
// now-playing card over the list (`SheetLayout`). A phone is not a desktop,
// and the card is what every other music surface there already is.
//
// On a desktop it is an app, and it gets to be one (`DesktopPlayer`): the
// artwork lit up behind the whole window, a real scrubber, a transport sized
// for a pointer, and a layout that follows the window rather than the
// viewport — Music.app's three sizes, chosen by the room the window has:
//
//   wide     the now-playing pane beside the playlist (the size it opens at)
//   compact  a portrait window: the player on top, the list under it
//   mini     a small window: just the artwork and the transport over it
// =============================================================================

type Layout = "wide" | "compact" | "mini";

/** Pick the layout from the window's own box. */
function layoutFor(width: number, height: number): Layout {
  if (height < 300 || width < 340) return "mini";
  if (width >= 620 && height >= 380) return "wide";
  return "compact";
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicWindow() {
  const { mode } = useSurfaceContext();
  return mode === "sheet" ? <SheetLayout /> : <DesktopPlayer />;
}

// -----------------------------------------------------------------------------
// Phone: the card and the list
// -----------------------------------------------------------------------------

function SheetLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-3 pt-12">
        <NowPlaying raised={false} />
      </div>
      <PlaylistPane className="border-t border-border/50" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Desktop: the app
// -----------------------------------------------------------------------------

function DesktopPlayer() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>("wide");
  const { track } = useMusic();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setLayout(layoutFor(width, height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative h-full overflow-hidden">
      <Ambience src={track?.thumbnailUrl} strong={layout === "mini"} />
      {layout === "wide" ? (
        <div className="relative grid h-full grid-cols-[minmax(250px,40%)_1fr]">
          <div className="flex min-h-0 flex-col items-center justify-center gap-5 px-8 pb-8 pt-14">
            <Artwork className="aspect-square w-full max-w-[272px] rounded-2xl shadow-overlay" />
            <TrackTitle centered className="w-full max-w-[272px]" />
            <Scrubber className="w-full max-w-[272px]" />
            <Transport />
          </div>
          <PlaylistPane className="border-l border-border/40 pt-12" header />
        </div>
      ) : layout === "compact" ? (
        <div className="relative flex h-full flex-col">
          <div className="shrink-0 space-y-4 px-5 pb-4 pt-12">
            <div className="flex items-center gap-4">
              <Artwork className="size-24 shrink-0 rounded-xl shadow-raised" />
              <TrackTitle className="min-w-0 flex-1" />
            </div>
            <Scrubber />
            <Transport />
          </div>
          <PlaylistPane className="border-t border-border/40" header />
        </div>
      ) : (
        <MiniPlayer />
      )}
    </div>
  );
}

/**
 * The artwork, blown up and blurred behind the whole window under a veil of
 * the page ground — the colour of what is playing, with every word still on a
 * ground the legibility tokens were drawn for.
 */
function Ambience({ src, strong }: { src?: string; strong?: boolean }) {
  if (!src) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote art */}
      <img
        key={src}
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-3xl saturate-150 transition-opacity duration-700"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className={cn("absolute inset-0 bg-background", strong ? "opacity-40" : "opacity-70")} />
    </div>
  );
}

function Artwork({ className }: { className?: string }) {
  const { track } = useMusic();
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <div className="absolute inset-0 flex items-center justify-center">
        <Music className="h-1/4 w-1/4 text-quaternary-foreground" />
      </div>
      {track && (
        // eslint-disable-next-line @next/next/no-img-element -- remote art
        <img
          key={track.videoId}
          src={track.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}

function TrackTitle({ centered, className }: { centered?: boolean; className?: string }) {
  const { locale } = useLocale();
  const { track } = useMusic();
  return (
    <div className={cn(centered && "text-center", className)}>
      <div className="truncate text-base font-medium text-foreground">
        {track?.title ?? t(locale, "musicNotPlaying")}
      </div>
      {track?.artist && (
        <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {track.artist}
        </div>
      )}
    </div>
  );
}

/** A scrubber you can drag: the time follows the pointer, the seek lands on release. */
function Scrubber({ className, bare }: { className?: string; bare?: boolean }) {
  const { currentTime, duration, seek } = useMusic();
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? currentTime;
  const progress = duration > 0 ? Math.min(1, shown / duration) : 0;

  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * duration;
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="slider"
        aria-label="Position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        tabIndex={duration > 0 ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(Math.min(duration, currentTime + 5));
          if (e.key === "ArrowLeft") seek(Math.max(0, currentTime - 5));
        }}
        onPointerDown={(e) => {
          if (duration <= 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(at(e));
        }}
        onPointerMove={(e) => drag !== null && setDrag(at(e))}
        onPointerUp={(e) => {
          if (drag === null) return;
          seek(at(e));
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
        className="group/scrub relative h-3 cursor-pointer touch-none outline-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/15">
          <div
            className={cn(
              "h-full rounded-full bg-foreground/70",
              drag === null && "transition-[width] duration-500 ease-linear",
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground opacity-0 shadow-sm transition-opacity group-hover/scrub:opacity-100 group-focus-visible/scrub:opacity-100"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      {!bare && (
        <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
          <span>{formatTime(shown)}</span>
          <span>-{formatTime(Math.max(0, duration - shown))}</span>
        </div>
      )}
    </div>
  );
}

const TRANSPORT_BTN =
  "pressable inline-flex items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground outline-none focus-visible:bg-foreground/[0.08]";

function Transport({ small }: { small?: boolean }) {
  const { playerState, play, pause, next, previous } = useMusic();
  const playing = playerState === "playing";
  const icon = small ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={previous} aria-label="Previous track" className={cn(TRANSPORT_BTN, small ? "size-8" : "size-10")}>
        <Rewind className={icon} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={playing ? pause : play}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "pressable inline-flex items-center justify-center rounded-full bg-foreground text-background shadow-raised transition-transform hover:scale-105",
          small ? "size-9" : "size-12",
        )}
      >
        {playing ? (
          <Pause className={icon} fill="currentColor" />
        ) : (
          <Play className={cn(icon, "translate-x-px")} fill="currentColor" />
        )}
      </button>
      <button type="button" onClick={next} aria-label="Next track" className={cn(TRANSPORT_BTN, small ? "size-8" : "size-10")}>
        <FastForward className={icon} fill="currentColor" />
      </button>
    </div>
  );
}

/** Music.app's mini player: the artwork is the window, the controls ride on it. */
function MiniPlayer() {
  return (
    <div className="relative h-full">
      <Artwork className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-background/90 via-background/70 to-transparent px-4 pb-3 pt-10">
        <TrackTitle />
        <div className="flex items-center gap-3">
          <Scrubber bare className="min-w-0 flex-1" />
          <Transport small />
        </div>
      </div>
    </div>
  );
}

/** The playlist: a header, and the list scrolling under it. */
function PlaylistPane({ className, header }: { className?: string; header?: boolean }) {
  const { locale } = useLocale();
  const { playlist, playlistIndex, playAt, playerState } = useMusic();
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Arrive with the track that is playing in view, once — browsing is not
  // yanked back to it afterwards.
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current || playlist.length === 0) return;
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    centred.current = true;
    list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
  }, [playlist.length, playlistIndex]);

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div className={cn("flex shrink-0 items-baseline justify-between px-4 pb-1", header ? "pt-2" : "pt-3")}>
        <span className="text-xs font-medium text-muted-foreground">
          {t(locale, "musicPlaylist")}
        </span>
        <span className="flex items-baseline gap-3">
          {playlist.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-tertiary-foreground">
              {playlist.length}
            </span>
          )}
          {header && PLAYLIST_ID && (
            <a
              href={`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground transition-colors hover:text-foreground"
            >
              {t(locale, "musicOpenOnYouTube")}
            </a>
          )}
        </span>
      </div>
      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <TrackList
          playlist={playlist}
          playlistIndex={playlistIndex}
          playAt={playAt}
          isPlaying={playerState === "playing"}
          isError={playerState === "error"}
          activeRef={activeRef}
        />
      </div>
    </div>
  );
}
