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
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GLASS_BTN, GLASS_ON_DARK_BTN } from "../lib/chrome";
import { trackFling } from "../lib/fling";
import {
  PIP_CARD_FOOTER,
  PIP_CARD_GRABBER,
  PIP_CARD_PAD,
  PIP_STASH_PEEK,
  pipCardBox,
  pipSettle,
} from "../lib/geometry";
import { formatTime } from "../lib/player";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// PipOverlay: the Picture-in-Picture player's controls and gestures.
//
// PiP takes one of two shapes, both drawn around the shared <Stage />:
//
//   The tile (tablet and desk). The video is the whole thing; controls are
//   drawn over it when asked for, and the gestures are the ones the system
//   PiP on iOS and Android already taught:
//     tap         controls in (a finger), play / pause (a mouse)
//     double-tap  the other size (small ⇄ large)
//     drag        the tile follows; released, it is thrown to the nearest
//                 corner, judged by where the throw was headed
//     throw off   a side edge stashes it there, a handle's width left on
//                 screen; the sound keeps playing, a tap brings it back
//
//   The card (a phone). The player is one object with the dock: a card
//   hanging under the dock's pill row, which grows when pulled down (the
//   playlist takes the screen under it) and shrinks when pushed up (into the
//   Live Activity's pill, sound only). A tap on that pill brings the card
//   back (theater-activity.tsx). No corners, no stash: a phone is too narrow
//   for a tile to be anywhere but in the way, and its top is where the
//   playlist needs the video to be.
//
// What the overlay on the video can do depends on what is playing. A YouTube
// video is ours to drive (the IFrame API), so a transparent layer takes the
// whole picture for the gestures and the overlay carries the transport and a
// scrubber. Anything else (a Bilibili or Vimeo embed, a reveal.js deck) can
// only be driven from inside its own frame, so the frame keeps the picture.
// The tile is then held by a strip along its top edge; the card by its row.
// Neither can be revealed by a tap or hover on the picture: a pointer over a
// cross-origin frame tells this document nothing.
//
// Escape does not close the player from here (see the provider): neither
// shape is modal.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;
/** A finger's controls go away this long after the last touch, while playing. */
const TOUCH_HIDE_MS = 2500;
/** A mouse's controls go away this long after it leaves the player. */
const POINTER_HIDE_MS = 300;
/** Two taps closer than this are a double-tap. */
const DOUBLE_TAP_MS = 280;
/** Below this width the overlay drops the title line to keep the transport clear. */
const ROOM_FOR_TITLE = 260;
/** How far the card must be pulled (px) or how fast (px/ms) to change size. */
const CARD_PULL = 48;
const CARD_FLICK = 0.4;

export function PipOverlay() {
  const { mode, minimized, pipCard } = useTheater();
  const open = mode === "pip" && !minimized;
  return (
    <AnimatePresence>
      {open && (pipCard ? <PipCard key="pip-card" /> : <PipTile key="pip-tile" />)}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Shared: what is on the stage, the reveal, the controls over the video
// ---------------------------------------------------------------------------

function useStageFacts() {
  const { track, phase, albumIndex, trackIndex, album, albums } = useTheater();
  return {
    deck: track?.kind === "slides",
    // Ours to drive: the gesture layer takes the picture.
    drivable: track?.kind === "video" && track.platform === "youtube" && !!track.videoId,
    isPlaying: phase === "playing",
    hasPrev: albumIndex > 0 || trackIndex > 0,
    hasNext:
      trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1,
  };
}

/**
 * When the controls over the video are showing. A mouse brings them with
 * movement and takes them away by leaving; a finger toggles them with a tap,
 * and they leave on their own while the video plays. Focus inside the player
 * holds them, so a keyboard never tabs into something invisible.
 */
function useReveal() {
  const { isCoarse, dragging } = useTheater();
  const { isPlaying } = useStageFacts();
  // Each shape mounts when it opens, so a fresh start is a fresh mount. On a
  // touch screen the controls show once on arrival, so the first look says
  // what the player can do; they leave on the timer below once it plays.
  const [revealed, setRevealed] = useState(isCoarse);
  // Bumped by every touch on the player, so the auto-hide restarts from it.
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
  useEffect(() => clearLeave, []);

  // Paused, they stay: a paused player with nothing on it reads as a frozen
  // frame.
  useEffect(() => {
    if (!revealed || !isPlaying || lastInput.current !== "touch") return;
    const id = window.setTimeout(() => {
      if (!focusWithin.current) setRevealed(false);
    }, TOUCH_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [revealed, isPlaying, touchedAt]);

  const handlers = {
    // On movement rather than on entry: a player that has just been dragged
    // is still under the pointer, and no entry would come.
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse" || dragging) return;
      lastInput.current = "mouse";
      clearLeave();
      if (!revealed) setRevealed(true);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      clearLeave();
      leaveTimer.current = window.setTimeout(() => {
        if (!focusWithin.current) setRevealed(false);
      }, POINTER_HIDE_MS);
    },
    onPointerDownCapture: (e: React.PointerEvent) => {
      lastInput.current = e.pointerType === "mouse" ? "mouse" : "touch";
      if (e.pointerType !== "mouse") setTouchedAt(e.timeStamp);
    },
    onFocusCapture: () => {
      focusWithin.current = true;
      setRevealed(true);
    },
    onBlurCapture: (e: React.FocusEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      focusWithin.current = false;
      if (lastInput.current === "touch") setTouchedAt(performance.now());
      else setRevealed(false);
    },
  };

  return { revealed, setRevealed, handlers };
}

/**
 * The controls over a drivable video: corner buttons, the transport in the
 * middle, the title and a scrubber along the bottom. Pointer-transparent
 * while hidden, so the gesture layer under it gets every press.
 */
function VideoControlsOverlay({
  shown,
  width,
  topLeft,
  topRight,
}: {
  shown: boolean;
  width: number;
  topLeft?: ReactNode;
  topRight?: ReactNode;
}) {
  const { locale } = useLocale();
  const { track, currentTime, duration, togglePlay, next, previous, seek } = useTheater();
  const { isPlaying, hasPrev, hasNext } = useStageFacts();

  return (
    <div
      className={cn(
        "absolute inset-0 text-white transition-opacity duration-200",
        "bg-gradient-to-b from-black/50 via-black/10 to-black/60",
        shown
          ? "opacity-100 [&_button]:pointer-events-auto [&_[role=slider]]:pointer-events-auto"
          : "opacity-0",
      )}
    >
      <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">{topLeft}</div>
        <div className="flex items-center gap-0.5">{topRight}</div>
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
        {width >= ROOM_FOR_TITLE && track && (
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
  );
}

/** The player's own moves: playlist, Audio, Theater (where it fits). */
function useViewButtons({ onDark, audio = true }: { onDark: boolean; audio?: boolean }) {
  const { locale } = useLocale();
  const { theaterAvailable, isPlaylistOpen, toTheater, minimize, openPlaylist, closePlaylist } =
    useTheater();
  const { deck } = useStageFacts();
  const btn = onDark ? cn(GLASS_ON_DARK_BTN, "h-7 w-7") : cn(GLASS_BTN, "h-8 w-8");
  const lit = onDark ? "bg-white/15 text-white" : "bg-foreground/[0.08] text-foreground";

  const playlistLabel = t(
    locale,
    isPlaylistOpen ? "theaterClosePlaylist" : "theaterOpenPlaylist",
  );
  const minimizeLabel = t(
    locale,
    deck ? "theaterSurfaceMinimizeHint" : "theaterSurfaceMiniHint",
  );
  const expandLabel = t(locale, "theaterSurfaceGo").replace(
    "{surface}",
    t(locale, "theaterSurfaceTheater"),
  );

  return {
    playlist: (
      <button
        type="button"
        onClick={isPlaylistOpen ? closePlaylist : openPlaylist}
        aria-pressed={isPlaylistOpen}
        aria-label={playlistLabel}
        title={playlistLabel}
        className={cn(btn, isPlaylistOpen && lit)}
      >
        <ListVideo className="h-3.5 w-3.5" />
      </button>
    ),
    audio: audio ? (
      <button
        type="button"
        onClick={minimize}
        aria-label={minimizeLabel}
        title={minimizeLabel}
        className={btn}
      >
        <Minimize2 className="h-3.5 w-3.5" />
      </button>
    ) : null,
    theater: theaterAvailable ? (
      <button
        type="button"
        onClick={toTheater}
        aria-label={expandLabel}
        title={expandLabel}
        className={btn}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    ) : null,
  };
}

function CloseButton({ onDark }: { onDark: boolean }) {
  const { locale } = useLocale();
  const { close } = useTheater();
  return (
    <button
      type="button"
      onClick={close}
      aria-label={t(locale, "theaterClose")}
      title={t(locale, "theaterClose")}
      className={onDark ? cn(GLASS_ON_DARK_BTN, "h-7 w-7") : cn(GLASS_BTN, "h-8 w-8")}
    >
      <X className={onDark ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}

function useBoxTransition() {
  const { dragging } = useTheater();
  const reduceMotion = useReducedMotion();
  return dragging || reduceMotion ? { duration: 0 } : { duration: 0.34, ease: EASE };
}

// ---------------------------------------------------------------------------
// The tile: tablet and desk
// ---------------------------------------------------------------------------

function PipTile() {
  const { locale } = useLocale();
  const {
    rect,
    viewport,
    dragging,
    pipPlacement,
    togglePlay,
    setPipPlacement,
    setPipDrag,
  } = useTheater();
  const { drivable } = useStageFacts();
  const { revealed, setRevealed, handlers } = useReveal();
  const views = useViewButtons({ onDark: true });
  const transition = useBoxTransition();
  const stash = pipPlacement.stash;

  const tapTimer = useRef<number | null>(null);
  const lastTapAt = useRef(0);
  // A drag that ends over the stash handle must not also press it.
  const justDragged = useRef(false);
  useEffect(
    () => () => {
      if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
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

  return (
    <motion.div
      role="group"
      aria-label={t(locale, "theaterPipGroup")}
      // OS chrome: nothing here is text to select or a link to preview. The
      // box itself lets the page through; only what it holds takes pointers.
      className="system-chrome pointer-events-none fixed z-[10004] overflow-hidden rounded-2xl"
      initial={{ opacity: 0, ...rect }}
      animate={{ opacity: 1, ...rect }}
      exit={{ opacity: 0 }}
      transition={{ ...transition, opacity: { duration: 0.18 } }}
      {...handlers}
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
          <VideoControlsOverlay
            shown={revealed && !stash && !dragging}
            width={rect.width}
            topLeft={<CloseButton onDark />}
            topRight={
              <>
                {views.playlist}
                {views.audio}
                {views.theater}
              </>
            }
          />
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
          <CloseButton onDark />
          <span aria-hidden className="flex flex-1 justify-center text-white/45">
            <GripHorizontal className="h-4 w-4" />
          </span>
          {views.playlist}
          {views.audio}
          {views.theater}
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
  );
}

// ---------------------------------------------------------------------------
// The card: a phone
// ---------------------------------------------------------------------------

/**
 * How far the card moves for a pull. Down is damped (it is a pull on
 * something anchored), and once the playlist is up there is nowhere further
 * down to go, so it barely gives. Up follows the finger: that is the way to
 * the dock.
 */
function cardTravel(dy: number, listOpen: boolean): number {
  if (dy >= 0) return dy * (listOpen ? 0.2 : 0.5);
  return dy * 0.9;
}

function PipCard() {
  const { locale } = useLocale();
  const {
    rect,
    track,
    dragging,
    isPlaylistOpen,
    togglePlay,
    next,
    minimize,
    openPlaylist,
    closePlaylist,
    setPipDrag,
  } = useTheater();
  const { drivable, isPlaying, hasNext, deck } = useStageFacts();
  const { revealed, setRevealed, handlers } = useReveal();
  const views = useViewButtons({ onDark: true, audio: false });
  const transition = useBoxTransition();
  const box = pipCardBox(rect);

  /**
   * Arm a press on anything that holds the card: the gesture layer on a
   * drivable video, the row under it, the grabber. Pulled down past the
   * threshold it opens the playlist under itself; pushed up, it closes the
   * playlist, or with none open goes into the dock. A tap does `onTap`.
   */
  const hold = (e: React.PointerEvent, onTap: (pointerType: string) => void) => {
    if (e.button !== 0) return;
    const top = rect.top;
    const listOpen = isPlaylistOpen;
    trackFling(e, {
      onDragStart: () => setRevealed(false),
      onDrag: (_dx, dy) => setPipDrag({ x: rect.left, y: top + cardTravel(dy, listOpen) }),
      onRelease: (_dx, dy, velocity) => {
        setPipDrag(null);
        const up = dy < -CARD_PULL || velocity.y < -CARD_FLICK;
        const down = dy > CARD_PULL || velocity.y > CARD_FLICK;
        if (listOpen) {
          if (up) closePlaylist();
        } else if (up) minimize();
        else if (down) openPlaylist();
      },
      onTap,
    });
  };

  const minimizeLabel = t(
    locale,
    deck ? "theaterSurfaceMinimizeHint" : "theaterSurfaceMiniHint",
  );

  return (
    <>
      {/* The card's glass, under the stage: the video sits in it. */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed z-[10001] rounded-[22px] border border-border/50 bg-glass shadow-overlay backdrop-blur-xl"
        initial={{ opacity: 0, ...box }}
        animate={{ opacity: 1, ...box }}
        exit={{ opacity: 0 }}
        transition={{ ...transition, opacity: { duration: 0.18 } }}
      />

      {/* Everything that takes a press, over the stage. */}
      <motion.div
        role="group"
        aria-label={t(locale, "theaterPipGroup")}
        className="system-chrome pointer-events-none fixed z-[10004]"
        initial={{ opacity: 0, ...box }}
        animate={{ opacity: 1, ...box }}
        exit={{ opacity: 0 }}
        transition={{ ...transition, opacity: { duration: 0.18 } }}
        {...handlers}
      >
        {drivable && (
          <div
            className="absolute overflow-hidden rounded-2xl"
            style={{ left: PIP_CARD_PAD, top: PIP_CARD_PAD, width: rect.width, height: rect.height }}
          >
            <div
              aria-hidden
              className="pointer-events-auto absolute inset-0 touch-none"
              onPointerDown={(e) =>
                hold(e, (pointerType) => {
                  if (pointerType === "mouse") togglePlay();
                  else setRevealed((r) => !r);
                })
              }
            />
            <VideoControlsOverlay
              shown={revealed && !dragging}
              width={rect.width}
              topRight={views.playlist}
            />
          </div>
        )}

        {/* The row: what is playing, and the moves a thumb wants without
            opening anything. A press on the title opens the list, which is
            also where a pull down goes. */}
        <div
          className="pointer-events-auto absolute flex touch-none items-center gap-0.5 pl-1"
          style={{
            left: PIP_CARD_PAD,
            right: PIP_CARD_PAD,
            top: PIP_CARD_PAD + rect.height,
            height: PIP_CARD_FOOTER,
          }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            hold(e, () => (isPlaylistOpen ? closePlaylist() : openPlaylist()));
          }}
        >
          <div className="min-w-0 flex-1 px-1.5">
            <div className="truncate text-[13px] font-medium leading-snug text-foreground">
              {track?.title}
            </div>
            {track?.subtitle && (
              <div className="truncate font-mono text-[10px] leading-snug text-muted-foreground">
                {track.subtitle}
              </div>
            )}
          </div>
          {drivable && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={t(locale, isPlaying ? "theaterPause" : "theaterPlay")}
              className={cn(GLASS_BTN, "h-8 w-8 text-foreground")}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4 translate-x-px" fill="currentColor" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={!hasNext}
            aria-label={t(locale, "theaterNext")}
            className={cn(GLASS_BTN, "h-8 w-8")}
          >
            <SkipForward className="h-4 w-4" fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={minimize}
            aria-label={minimizeLabel}
            title={minimizeLabel}
            className={cn(GLASS_BTN, "h-8 w-8")}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <CloseButton onDark={false} />
        </div>

        {/* The grabber: the card pulls. */}
        <div
          aria-hidden
          className="pointer-events-auto absolute inset-x-0 bottom-0 flex touch-none items-start justify-center"
          style={{ height: PIP_CARD_GRABBER }}
          onPointerDown={(e) =>
            hold(e, () => (isPlaylistOpen ? closePlaylist() : openPlaylist()))
          }
        >
          <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
        </div>
      </motion.div>
    </>
  );
}

/**
 * The scrubber: press anywhere on it to jump, drag to scrub. Arrow keys step
 * five seconds when it has focus.
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
