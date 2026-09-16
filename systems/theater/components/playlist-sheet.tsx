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
import { useEffect, useMemo, useRef, useState } from "react";
import { PIP_CONTROLS_H, PIP_GAP, playlistDetents } from "../lib/geometry";
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
// window on a desktop. None of them takes the page — or the video — away.
//
// On a phone the sheet and the player split the screen rather than stacking:
// the provider parks the PiP window at the top of the screen, and the sheet's
// top detent is that window's bottom edge, so the list never runs under the
// video and the video never covers a row. Summoned from the Live Activity
// instead, the same rule points at the dock card the player collapsed into —
// the sheet stops under whatever shape the player is currently wearing, which
// is why the detents are measured rather than declared.
// ---------------------------------------------------------------------------

/** Room for a column of 16:9 thumbnails without the drawer feel. */
const WINDOW_WIDTH = "min(92vw, 520px)";
const WINDOW_HEIGHT = "min(78vh, 620px)";

/** Before the dock is measured: half the screen, the site's lower detent. */
const FALLBACK_DETENTS = [0.5];

/** The lowest edge of the dock — its pill row, or an expanded panel. */
function dockBottom(): number {
  let bottom = 0;
  for (const el of document.querySelectorAll("[data-dock-anchor]")) {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

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
    viewport,
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

  const surfaceMode = useSurfaceMode(ADAPTIVE_PRESENTATION);
  const pipShowing = mode === "pip" && !minimized;

  // The PiP window's bottom edge. The provider has already parked the window
  // by the time the surface is open, so this is plain arithmetic on the rect
  // the stage is drawn from: the sheet and the video cannot disagree about
  // where the line between them runs.
  const pipCeiling = rect.top + rect.height + PIP_CONTROLS_H;

  // The dock's, when the player is a Live Activity instead. Measured, because
  // the pill and the expanded panel are different heights and only the DOM
  // knows which one is up — and it can change under the open sheet, when the
  // panel is collapsed back to its pill. The panel is a drawer portalled into
  // the shared surface viewport rather than a child of the dock row, so the
  // watch is on the document: a measure is a few rects, and an unchanged
  // number is a no-op render.
  const [dockCeiling, setDockCeiling] = useState(0);
  useEffect(() => {
    if (!isPlaylistOpen || pipShowing) return;
    let settle = 0;
    const measure = () => {
      setDockCeiling(dockBottom());
      // The dock morphs pill ⇄ panel over its own animation; read it again
      // once that has landed rather than mid-flight.
      clearTimeout(settle);
      settle = window.setTimeout(() => setDockCeiling(dockBottom()), SURFACE_TRANSITION_MS);
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [isPlaylistOpen, pipShowing]);

  const ceiling = pipShowing ? pipCeiling : dockCeiling;
  const detents = useMemo(
    () => (ceiling > 0 ? playlistDetents(viewport.height, ceiling) : FALLBACK_DETENTS),
    [viewport.height, ceiling],
  );

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
      // Everything below the player, plus a half-height stop when that leaves
      // somewhere to drag to. See `playlistDetents`.
      snapPoints={detents}
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

      <PanelPipInset enabled={surfaceMode === "panel" && pipShowing} pip={rect} />
    </AdaptiveSurface>
  );
}

/**
 * The tablet panel's way of sharing the screen.
 *
 * A phone sheet resizes to stand under the player; a panel cannot — it is
 * pinned to three edges of its side of the screen, and the PiP window rests
 * over its bottom corner. So the list ends above the window instead: a spacer
 * as tall as the overlap, so the last rows can be scrolled clear of it.
 *
 * Zero when the two do not overlap — a window dragged aside, a narrow panel.
 * Measured from in here, because the scroll box does not exist until Base UI
 * mounts the popup, and says nothing until the panel has finished travelling
 * in from its edge: a panel still off the right edge overlaps nothing.
 */
function PanelPipInset({
  enabled,
  pip,
}: {
  enabled: boolean;
  /** The video's rect; the control bar hangs PIP_CONTROLS_H below it. */
  pip: { top: number; left: number; width: number; height: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const { top, left, width } = pip;

  useEffect(() => {
    const list = ref.current?.parentElement;
    if (!list || !enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeight(0);
      return;
    }
    const measure = () => {
      const box = list.getBoundingClientRect();
      const clears = left + width <= box.left || left >= box.right;
      setHeight(clears ? 0 : Math.max(0, box.bottom - top + PIP_GAP));
    };
    measure();
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
  }, [enabled, top, left, width]);

  return <div ref={ref} aria-hidden style={{ height }} />;
}
