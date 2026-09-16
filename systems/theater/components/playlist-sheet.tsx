"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { EQBars } from "@/systems/music/components/now-playing";
import {
  ADAPTIVE_PRESENTATION,
  AdaptiveSurface,
  SURFACE_TRANSITION_MS,
  useSurfaceMode,
} from "@/systems/surface";
import { useEffect, useRef, useState } from "react";
import {
  PIP_CONTROLS_H,
  PIP_GAP,
  THEATER_PLAYLIST_DETENTS,
} from "../lib/geometry";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { TrackThumb } from "./track-thumb";

// ---------------------------------------------------------------------------
// TheaterPlaylistSheet — the video system's playlist browser.
//
// The theater modal browses itself: album tabs across the top, a rail of
// thumbnails under the stage. PiP has none of that — a phone, where PiP is the
// *only* shape the player has, was left pressing Next blind. This is that
// missing browser, and it is the same object the Music system already has
// (`MusicPlaylistSheet`): one surface mounted in the root layout that any entry
// point summons with `openPlaylist()`.
//
// Shape is <AdaptiveSurface>'s call: sheet on a phone, panel on a tablet,
// window on a desktop. None of them takes the page — or the video — away. The
// PiP window floats above the sheet (z-10004 against the surface viewport's
// z-60) and the provider parks it clear of the sheet's opening detent, so the
// talk you are browsing keeps playing in view while you browse it.
//
// Dragged to the top, the sheet grows *under* that parked window rather than
// pushing it anywhere: the video holds still while the list rises past it, and
// the list starts below it (`PipAware`). The alternative — moving the window
// as the sheet moves — animates the one thing on screen that should not move.
// ---------------------------------------------------------------------------

/** Room for a column of 16:9 thumbnails without the drawer feel. */
const WINDOW_WIDTH = "min(92vw, 520px)";
const WINDOW_HEIGHT = "min(78vh, 620px)";

export function TheaterPlaylistSheet() {
  const { locale } = useLocale();
  const {
    albums,
    album,
    albumIndex,
    trackIndex,
    phase,
    mode,
    minimized,
    rect,
    isPlaylistOpen,
    openPlaylist,
    closePlaylist,
    selectAlbum,
    selectTrack,
  } = useTheater();

  // Center the playing track when the surface opens — not on every track
  // change, so browsing ahead isn't yanked back to "now playing".
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // The drawer shapes are pinned to their edge and the PiP window floats over
  // them, so the list holds open the band the window covers — the top of a
  // sheet it has been parked above, the bottom of a panel it rests against. A
  // desktop window is the user's to move, so it is left alone.
  const surfaceMode = useSurfaceMode(ADAPTIVE_PRESENTATION);
  const sharesScreenWithPip =
    surfaceMode !== "window" && mode === "pip" && !minimized;
  const pipBox = {
    top: rect.top,
    bottom: rect.top + rect.height + PIP_CONTROLS_H,
    left: rect.left,
    right: rect.left + rect.width,
  };
  useEffect(() => {
    if (!isPlaylistOpen) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const active = activeRef.current;
      if (!list || !active) return;
      list.scrollTop =
        active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [isPlaylistOpen]);

  if (albums.length === 0) return null;

  const isPlaying = phase === "playing";
  const tracks = album?.tracks ?? [];

  return (
    <AdaptiveSurface
      id="surface-theater-playlist"
      open={isPlaylistOpen}
      onOpenChange={(open) => (open ? openPlaylist() : closePlaylist())}
      presentation={ADAPTIVE_PRESENTATION}
      closeLabel={t(locale, "theaterClosePlaylist")}
      windowWidth={WINDOW_WIDTH}
      maxHeight={WINDOW_HEIGHT}
      // Half the screen, so the PiP window has the other half. See
      // THEATER_PLAYLIST_DETENTS.
      snapPoints={THEATER_PLAYLIST_DETENTS}
      scrollRef={listRef}
      title={
        <span className="flex items-center gap-2">
          {isPlaying && <EQBars className="text-red-500" />}
          <span className="truncate">{t(locale, "theaterPlaylist")}</span>
          {tracks.length > 0 && (
            <span className="shrink-0 font-mono text-xs tabular-nums text-tertiary-foreground">
              {tracks.length}
            </span>
          )}
        </span>
      }
    >
      <PipAware enabled={sharesScreenWithPip} pip={pipBox}>
        {/* Albums first — the switch the PiP bar has no room for. The tabs
            scroll sideways rather than wrap: an ad-hoc album is named after the
            video that opened it, and those titles are long. */}
        {albums.length > 1 && (
          <div className="-mx-1 flex overflow-x-auto no-scrollbar px-1 pb-3 pt-1">
            <AlbumTabs
              albums={albums}
              activeIndex={albumIndex}
              onSelect={selectAlbum}
              raised={false}
              className="shrink-0"
            />
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {tracks.map((track, i) => {
            const active = i === trackIndex;
            return (
              <button
                key={track.id}
                ref={active ? activeRef : undefined}
                onClick={() => selectTrack(i)}
                className={cn(
                  "group/thumb flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
                  active ? "bg-accent/60" : "hover:bg-accent/40 active:bg-accent/60",
                )}
              >
                <span className="w-24 shrink-0">
                  <TrackThumb track={track} active={active} showBadge={!active} />
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-sm leading-snug",
                      active ? "text-foreground font-medium" : "text-foreground/90",
                    )}
                  >
                    {active && isPlaying && (
                      <EQBars className="shrink-0 text-red-500" />
                    )}
                    <span className="truncate">{track.title}</span>
                  </span>
                  {track.subtitle && (
                    <span className="mt-0.5 block truncate text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                      {track.subtitle}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </PipAware>
    </AdaptiveSurface>
  );
}

/**
 * Holds open the band of the list that the floating PiP window covers.
 *
 * Which band depends on where the window came in from: a sheet is parked
 * beneath it, so the list starts below the window; a panel runs to the bottom
 * edge the window rests on, so the list ends above it. Zero when the two do
 * not overlap at all — the sheet at its opening detent, a short list, a window
 * dragged aside.
 *
 * Measured rather than derived from the detent: the scroll box resizes as a
 * sheet moves, so one ResizeObserver covers the drag, the release, a rotation
 * and the keyboard alike. And measured from in here, because the scroll box
 * does not exist until Base UI mounts the popup, a render after the surface is
 * told to open — and then means nothing until the surface has finished
 * travelling in from its edge, which is what the opening frames are for: a
 * panel still off the right edge overlaps nothing.
 */
function PipAware({
  enabled,
  pip,
  children,
}: {
  enabled: boolean;
  /** The PiP window's box — video *and* control bar — in viewport pixels. */
  pip: { top: number; bottom: number; left: number; right: number };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    // The scroll box: its rect is where the list stands, where this wrapper's
    // own rect rides up with the scroll.
    const list = ref.current?.parentElement;
    if (!list || !enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInset({ top: 0, bottom: 0 });
      return;
    }
    const measure = () => {
      const box = list.getBoundingClientRect();
      const clears =
        pip.right <= box.left ||
        pip.left >= box.right ||
        pip.bottom <= box.top ||
        pip.top >= box.bottom;
      if (clears) {
        setInset({ top: 0, bottom: 0 });
        return;
      }
      // Whichever edge it came in from: the nearer one wins.
      const fromTop = pip.bottom - box.top < box.bottom - pip.top;
      setInset({
        top: fromTop ? Math.max(0, pip.bottom + PIP_GAP - box.top) : 0,
        bottom: fromTop ? 0 : Math.max(0, box.bottom - pip.top + PIP_GAP),
      });
    };
    measure();
    // The arrival: a surface travels to its edge over one transition, and only
    // a resize (a sheet changing detent) would wake the observer on its own.
    let frame = 0;
    const until = performance.now() + SURFACE_TRANSITION_MS;
    const tick = () => {
      measure();
      if (performance.now() < until) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled, pip.top, pip.bottom, pip.left, pip.right]);

  return (
    <div
      ref={ref}
      style={{ paddingTop: inset.top, paddingBottom: inset.bottom }}
    >
      {children}
    </div>
  );
}
