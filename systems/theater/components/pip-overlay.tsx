"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  ListVideo,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GLASS_ON_DARK_BTN } from "../lib/chrome";
import { trackFling } from "../lib/fling";
import { PIP_STASH_PEEK, pipSettle } from "../lib/geometry";
import { formatTime } from "../lib/player";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// PipOverlay: the Picture-in-Picture tile's controls and gestures.
//
// The tile is all picture. The video is the shared <Stage />; nothing sits
// under or beside it. Controls are drawn over it when asked for, and the
// gestures are the ones the system PiP on iOS and Android already taught:
//
//   tap         controls in (a finger), play / pause (a mouse)
//   double-tap  the other size (small ⇄ large)
//   drag        the tile follows; released, it is thrown to the nearest
//               corner, judged by where the throw was headed
//   throw off   a side edge stashes it there, a handle's width left on
//               screen; the sound keeps playing, a tap brings it back
//
// What the overlay can do depends on what is playing. A YouTube video is
// ours to drive (the IFrame API), so a transparent layer takes the whole
// picture for the gestures and the overlay carries the transport and a
// scrubber. Anything else (a Bilibili or Vimeo embed, a reveal.js deck) can
// only be driven from inside its own frame, so the frame keeps the picture
// and the tile is held by a strip along its top edge instead. The strip is
// always there, because a pointer over a cross-origin frame tells this
// document nothing: there is no hover or tap to reveal it with.
//
// Escape no longer closes the player from here (see the provider): the tile
// is not modal.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;
/** A finger's controls go away this long after the last touch, while playing. */
const TOUCH_HIDE_MS = 2500;
/** A mouse's controls go away this long after it leaves the tile. */
const POINTER_HIDE_MS = 300;
/** Two taps closer than this are a double-tap. */
const DOUBLE_TAP_MS = 280;
/** Below this width the tile drops the title line to keep the transport clear. */
const ROOM_FOR_TITLE = 260;

export function PipOverlay() {
  const { locale } = useLocale();
  const {
    mode,
    minimized,
    track,
    phase,
    rect,
    viewport,
    isCoarse,
    dragging,
    theaterAvailable,
    pipPlacement,
    currentTime,
    duration,
    albumIndex,
    trackIndex,
    album,
    albums,
    isPlaylistOpen,
    togglePlay,
    next,
    previous,
    seek,
    toTheater,
    minimize,
    close,
    openPlaylist,
    closePlaylist,
    setPipPlacement,
    setPipDrag,
  } = useTheater();
  const reduceMotion = useReducedMotion();

  const open = mode === "pip" && !minimized;
  const deck = track?.kind === "slides";
  // Ours to drive: the gesture layer takes the picture. Otherwise the frame
  // keeps it and the tile is held by its top strip.
  const drivable = track?.kind === "video" && track.platform === "youtube" && !!track.videoId;
  const isPlaying = phase === "playing";
  const stash = pipPlacement.stash;

  const hasPrev = albumIndex > 0 || trackIndex > 0;
  const hasNext =
    trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1;

  // --- Reveal ---------------------------------------------------------------
  const [revealed, setRevealed] = useState(false);
  // Bumped by every touch on the tile, so the auto-hide restarts from it.
  const [touchedAt, setTouchedAt] = useState(0);
  const lastInput = useRef<"touch" | "mouse">(isCoarse ? "touch" : "mouse");
  const focusWithin = useRef(false);
  const leaveTimer = useRef<number | null>(null);

  const clearLeave = () => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  // A finger's controls go away on their own while the video plays. Paused,
  // they stay: a paused tile with nothing on it reads as a frozen frame.
  useEffect(() => {
    if (!revealed || !isPlaying || lastInput.current !== "touch") return;
    const id = window.setTimeout(() => {
      if (!focusWithin.current) setRevealed(false);
    }, TOUCH_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [revealed, isPlaying, touchedAt]);

  // Each session starts clean. On a touch screen the controls show once on
  // arrival, so the first look says what the tile can do; they then leave
  // on the timer above once the video is playing.
  useEffect(() => {
    // An intentional reset when the tile opens or closes, like the theater's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealed(open && isCoarse);
    if (open && isCoarse) lastInput.current = "touch";
  }, [open, isCoarse]);

  // --- Gestures -------------------------------------------------------------
  const tapTimer = useRef<number | null>(null);
  const lastTapAt = useRef(0);
  // A drag that ends over the stash handle must not also press it.
  const justDragged = useRef(false);

  useEffect(
    () => () => {
      if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  const toggleSize = useCallback(() => {
    setPipPlacement({
      ...pipPlacement,
      size: pipPlacement.size === "large" ? "small" : "large",
    });
  }, [pipPlacement, setPipPlacement]);

  /**
   * Arm a press on anything that holds the tile: the gesture layer, the top
   * strip, the stash handle. A drag moves the tile and throws it; a single
   * tap does `onTap` (after the double-tap window, so a double-tap is never
   * also a tap); a double-tap changes the size.
   */
  const hold = (
    e: React.PointerEvent,
    onTap: (pointerType: string) => void,
    { doubleTap = true } = {},
  ) => {
    if (e.button !== 0) return;
    lastInput.current = e.pointerType === "mouse" ? "mouse" : "touch";
    const origin = { x: rect.left, y: rect.top };
    const size = pipPlacement.size;
    trackFling(e, {
      onDragStart: () => {
        if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
        lastTapAt.current = 0;
        setRevealed(false);
      },
      onDrag: (dx, dy) => setPipDrag({ x: origin.x + dx, y: origin.y + dy }),
      onRelease: (dx, dy, velocity) => {
        justDragged.current = true;
        window.setTimeout(() => (justDragged.current = false), 0);
        setPipPlacement(
          pipSettle(viewport, size, { x: origin.x + dx, y: origin.y + dy }, velocity),
        );
        setPipDrag(null);
      },
      onTap: (pointerType, now) => {
        if (!doubleTap) return onTap(pointerType);
        if (now - lastTapAt.current < DOUBLE_TAP_MS) {
          if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
          lastTapAt.current = 0;
          toggleSize();
          return;
        }
        lastTapAt.current = now;
        tapTimer.current = window.setTimeout(() => onTap(pointerType), DOUBLE_TAP_MS);
      },
    });
  };

  const unstash = () => setPipPlacement({ ...pipPlacement, stash: null });

  const transition =
    dragging || reduceMotion ? { duration: 0 } : { duration: 0.34, ease: EASE };
  const roomy = rect.width >= ROOM_FOR_TITLE;

  const expandLabel = t(locale, "theaterSurfaceGo").replace(
    "{surface}",
    t(locale, "theaterSurfaceTheater"),
  );
  const minimizeLabel = t(
    locale,
    deck ? "theaterSurfaceMinimizeHint" : "theaterSurfaceMiniHint",
  );
  const playlistLabel = t(
    locale,
    isPlaylistOpen ? "theaterClosePlaylist" : "theaterOpenPlaylist",
  );

  // The tile's own moves, shared by the overlay's top row and the strip.
  const viewButtons = (
    <>
      <button
        type="button"
        onClick={isPlaylistOpen ? closePlaylist : openPlaylist}
        aria-pressed={isPlaylistOpen}
        aria-label={playlistLabel}
        title={playlistLabel}
        className={cn(GLASS_ON_DARK_BTN, "h-7 w-7", isPlaylistOpen && "bg-white/15 text-white")}
      >
        <ListVideo className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={minimize}
        aria-label={minimizeLabel}
        title={minimizeLabel}
        className={cn(GLASS_ON_DARK_BTN, "h-7 w-7")}
      >
        <Minimize2 className="h-3.5 w-3.5" />
      </button>
      {theaterAvailable && (
        <button
          type="button"
          onClick={toTheater}
          aria-label={expandLabel}
          title={expandLabel}
          className={cn(GLASS_ON_DARK_BTN, "h-7 w-7")}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );

  const closeButton = (
    <button
      type="button"
      onClick={close}
      aria-label={t(locale, "theaterClose")}
      title={t(locale, "theaterClose")}
      className={cn(GLASS_ON_DARK_BTN, "h-7 w-7")}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="pip-tile"
          role="group"
          aria-label={t(locale, "theaterPipGroup")}
          // OS chrome: nothing here is text to select or a link to preview.
          // The box itself lets the page through; only what it holds takes
          // pointers.
          className="system-chrome pointer-events-none fixed z-[10004] overflow-hidden rounded-2xl"
          initial={{ opacity: 0, top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          animate={{ opacity: 1, top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          exit={{ opacity: 0 }}
          transition={{ ...transition, opacity: { duration: 0.18 } }}
          // On movement rather than on entry: a tile that has just been
          // dragged is still under the pointer, and no entry would come.
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse" || dragging) return;
            lastInput.current = "mouse";
            clearLeave();
            if (!revealed) setRevealed(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            clearLeave();
            leaveTimer.current = window.setTimeout(() => {
              if (!focusWithin.current) setRevealed(false);
            }, POINTER_HIDE_MS);
          }}
          onPointerDownCapture={(e) => {
            if (e.pointerType !== "mouse") setTouchedAt(e.timeStamp);
          }}
          onFocusCapture={() => {
            focusWithin.current = true;
            setRevealed(true);
          }}
          onBlurCapture={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            focusWithin.current = false;
            if (lastInput.current === "touch") setTouchedAt(performance.now());
            else setRevealed(false);
          }}
        >
          {drivable ? (
            <>
              {/* The gesture layer: the whole picture. A mouse click plays or
                  pauses, as it does on the video itself everywhere else. */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-auto absolute inset-0 touch-none",
                  dragging ? "cursor-grabbing" : "cursor-grab",
                )}
                onPointerDown={(e) =>
                  hold(e, (pointerType) => {
                    if (pointerType === "mouse") togglePlay();
                    else setRevealed((r) => !r);
                  })
                }
              />

              <div
                className={cn(
                  "absolute inset-0 text-white transition-opacity duration-200",
                  "bg-gradient-to-b from-black/50 via-black/10 to-black/60",
                  revealed && !stash && !dragging
                    ? "opacity-100 [&_button]:pointer-events-auto [&_[role=slider]]:pointer-events-auto"
                    : "opacity-0",
                )}
              >
                <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between">
                  {closeButton}
                  <div className="flex items-center gap-0.5">{viewButtons}</div>
                </div>

                <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
                  <button
                    type="button"
                    onClick={previous}
                    disabled={!hasPrev}
                    aria-label={t(locale, "theaterPrevious")}
                    className={cn(GLASS_ON_DARK_BTN, "h-8 w-8 disabled:opacity-30")}
                  >
                    <SkipBack className="h-4 w-4" fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={t(locale, isPlaying ? "theaterPause" : "theaterPlay")}
                    className={cn(GLASS_ON_DARK_BTN, "h-11 w-11 bg-white/15 text-white")}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" fill="currentColor" />
                    ) : (
                      <Play className="h-5 w-5 translate-x-px" fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    disabled={!hasNext}
                    aria-label={t(locale, "theaterNext")}
                    className={cn(GLASS_ON_DARK_BTN, "h-8 w-8 disabled:opacity-30")}
                  >
                    <SkipForward className="h-4 w-4" fill="currentColor" />
                  </button>
                </div>

                <div className="absolute inset-x-2.5 bottom-1.5">
                  {roomy && track && (
                    <div className="mb-0.5 truncate text-[11px] leading-tight text-white/85">
                      {track.title}
                    </div>
                  )}
                  <Scrubber
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={seek}
                    label={t(locale, "theaterSeek")}
                  />
                </div>
              </div>
            </>
          ) : (
            // The strip: what holds a tile whose picture is its own.
            <div
              className={cn(
                "pointer-events-auto absolute inset-x-0 top-0 flex h-9 touch-none items-center gap-0.5 px-1 text-white",
                "bg-gradient-to-b from-black/65 to-black/0",
                dragging ? "cursor-grabbing" : "cursor-grab",
                stash && "invisible",
              )}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                hold(e, () => {});
              }}
            >
              {closeButton}
              <span aria-hidden className="flex flex-1 justify-center text-white/45">
                <GripHorizontal className="h-4 w-4" />
              </span>
              {viewButtons}
            </div>
          )}

          {/* Stashed: a handle on the strip still on screen, pointing back in. */}
          {stash && (
            <button
              type="button"
              aria-label={t(locale, "theaterPipShow")}
              title={t(locale, "theaterPipShow")}
              onClick={() => {
                if (!justDragged.current) unstash();
              }}
              onPointerDown={(e) => hold(e, unstash, { doubleTap: false })}
              className={cn(
                "pointer-events-auto absolute inset-y-0 flex touch-none items-center justify-center",
                "border-border/50 bg-glass-strong-hover text-foreground backdrop-blur-xl",
                stash === "left" ? "right-0 border-l" : "left-0 border-r",
              )}
              style={{ width: PIP_STASH_PEEK }}
            >
              {stash === "left" ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The tile's scrubber: press anywhere on it to jump, drag to scrub. Arrow
 * keys step five seconds when it has focus.
 */
function Scrubber({
  currentTime,
  duration,
  onSeek,
  label,
}: {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  label: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const seekAt = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || duration <= 0) return;
    const box = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    onSeek(ratio * duration);
  };

  return (
    <div className="flex items-center gap-2 font-mono text-[9.5px] tabular-nums text-white/75">
      <span>{formatTime(currentTime)}</span>
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        className="group/scrub relative h-4 flex-1 cursor-pointer touch-none outline-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          seekAt(e.clientX);
          const move = (ev: PointerEvent) => seekAt(ev.clientX);
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel", up);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onSeek(Math.min(currentTime + 5, duration));
          else if (e.key === "ArrowLeft") onSeek(Math.max(currentTime - 5, 0));
          else return;
          e.preventDefault();
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/30 transition-[height] group-hover/scrub:h-1 group-focus-visible/scrub:h-1" />
        <div
          className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white transition-[height] group-hover/scrub:h-1 group-focus-visible/scrub:h-1"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span>{formatTime(duration)}</span>
    </div>
  );
}
