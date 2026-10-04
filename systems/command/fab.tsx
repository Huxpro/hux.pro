"use client";

import { useLocale, t } from "@/services";
import { useCommand } from "./provider";
import { cn } from "@/lib/utils";
import { AnimatePresence, cancelFrame, frame, motion } from "framer-motion";
import { Command, Search, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useDraggable } from "@/systems/draggable";
import { useDevtool } from "@/systems/devtool";
import { HoldRing } from "@/components/ui/hold-ring";
import { askStrings } from "@/systems/ask/strings";
import { HANDOFF, useHomeEditing } from "@/components/ui/home-edit-store";
import { useCompactViewport } from "./use-compact-viewport";

/**
 * Hold the search button this long and the devtool opens. Undocumented on
 * purpose: a phone has no `D` key, and the palette's own Debug Panel row is the
 * way in that is meant to be found. This is the one for whoever already knows.
 */
const DEVTOOL_HOLD_MS = 1200;

/**
 * Nothing happens visibly before this. A tap is ~100ms and a hesitant one
 * rarely half that again, so no ordinary press ever sees the ring. That
 * keeps this hidden while still making the second half of the hold
 * legible. The feedback is also what makes a shorter hold safe: an accidental
 * one announces itself in time to let go.
 */
const DEVTOOL_HOLD_REVEAL_MS = 700;

/** A press that slides this far is a drag or a scroll, not a hold. */
const HOLD_SLOP_PX = 10;

/** Both shapes of this button (the bar and the round FAB) are this round. */
const FAB_RADIUS = 24;

/** The Ask ball: one size everywhere, so it only ever moves. */
const ASK_SIZE = 48;
/** Between the ball and the bar. */
const ASK_GAP = 8;

export function FloatingActionButton() {
  const { toggle, askPlacement } = useCommand();
  const { summon: summonDevtool } = useDevtool();
  const pathname = usePathname();
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(false);
  const drag = useDraggable("command-fab");
  // While the home grid is in jiggle edit mode, the bar fades out on phones
  // so the grid's edit controls can take the bottom of the screen (on wider
  // screens they float above it and the bar stays put). The fade is
  // sequenced with the controls' entrance/exit (HANDOFF), so each direction
  // is a hand-off rather than a crossfade.
  const homeEditing = useHomeEditing();
  // Below `md` the bar and the grid's edit controls share the bottom of the
  // screen; above it the controls float over the bar.
  const compact = useCompactViewport();

  // The hold that opens the devtool. Timers and the press live in refs,
  // because a state update mid-press would only interfere with the drag below.
  // The ring is state, because it has to render.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  const heldRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Measured once when the ring appears: a finger covers the button, so the
  // feedback has to live outside it, and the button is not moving by then.
  const [holdRing, setHoldRing] = useState<DOMRect | null>(null);

  const cancelHold = useCallback(() => {
    // `clearTimeout` on an expired or absent id is a no-op, so nothing here
    // needs to track which timers are still live.
    clearTimeout(holdTimer.current ?? undefined);
    clearTimeout(revealTimer.current ?? undefined);
    holdOrigin.current = null;
    setHoldRing(null);
  }, []);

  const startHold = useCallback(
    (e: React.PointerEvent) => {
      heldRef.current = false;
      holdOrigin.current = { x: e.clientX, y: e.clientY };
      revealTimer.current = setTimeout(() => {
        // The live box, so the ring wraps the button as it is drawn, which
        // during a press includes its own `active:scale-95`.
        setHoldRing(buttonRef.current?.getBoundingClientRect() ?? null);
      }, DEVTOOL_HOLD_REVEAL_MS);
      holdTimer.current = setTimeout(() => {
        heldRef.current = true;
        setHoldRing(null);
        summonDevtool();
      }, DEVTOOL_HOLD_MS);
    },
    [summonDevtool]
  );

  const trackHold = useCallback(
    (e: React.PointerEvent) => {
      const origin = holdOrigin.current;
      if (!origin) return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > HOLD_SLOP_PX) {
        cancelHold();
      }
    },
    [cancelHold]
  );

  useEffect(() => cancelHold, [cancelHold]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isHomepage = pathname === "/";
  const isDraggable = drag.isEnabled && !isHomepage;
  const yielding = isHomepage && homeEditing && compact;
  // Away from the home on a phone the two round buttons stand in a column at
  // the trailing edge, Ask above search, the way a phone stacks its floating
  // buttons; a desk has the width to keep them side by side.
  const stacked = !isHomepage && compact;

  if (!mounted) return null;

  const bar = (
    <motion.button
      ref={buttonRef}
      layout
      // The hold has already done something by the time the finger lifts,
      // so the press that carried it must not also open the palette.
      onClick={() => {
        if (heldRef.current) {
          heldRef.current = false;
          return;
        }
        toggle();
      }}
      onPointerDown={startHold}
      onPointerMove={trackHold}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      className={cn(
        "pressable pointer-events-auto select-none",
        "transition-[background-color,border-color,color,transform] duration-200",
        yielding && "pointer-events-none",
        "flex items-center gap-2",
        "bg-glass backdrop-blur-xl",
        "border border-border/50",
        "shadow-raised",
        isHomepage ? "text-muted-foreground" : "text-foreground",
        "hover:bg-glass-hover hover:border-border",
        // Touch-down: the bar darkens on the same frame as the press, the
        // way an iOS search field does, and eases back on release.
        "active:bg-glass-strong-hover active:border-border active:text-foreground",
        "h-12",
        "overflow-hidden",
        isHomepage
          // No press scale on the homepage bar: it is a backdrop-blur
          // surface, and a transform makes the compositor re-blur every
          // frame of the press. The colour wash above is the feedback.
          ? "rounded-2xl pl-4 pr-6 md:px-4 w-auto md:w-full md:max-w-md focus:outline-none focus:ring-2 focus:ring-ring/20"
          : "rounded-[24px] w-12 md:w-auto md:px-4 justify-center active:scale-95"
      )}
      style={{ borderRadius: FAB_RADIUS }}
      animate={{ opacity: yielding ? 0 : 1 }}
      transition={{
        layout: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
        borderRadius: { duration: 0.4 },
        opacity: yielding
          ? { duration: HANDOFF.out }
          : { duration: HANDOFF.in, delay: HANDOFF.delay },
      }}
      aria-label="Open command palette"
    >
      <motion.div
        layout
        className="flex items-center justify-center shrink-0"
      >
        {isHomepage ? (
          <Search className="h-4 w-4" />
        ) : (
          <Command className="h-5 w-5 md:h-4 md:w-4" />
        )}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {isHomepage && (
          <motion.span
            key="prompt-text"
            initial={{ opacity: 0, x: -10 }}
            animate={{
              opacity: 1,
              x: 0,
              width: "auto",
              transition: { duration: 0.3, delay: 0.1 },
            }}
            exit={{
              opacity: 0,
              x: -10,
              transition: { duration: 0.2 },
            }}
            className="flex-1 text-left text-sm whitespace-nowrap overflow-hidden"
          >
            <span className="md:hidden">{t(locale, "searchMobile")}</span>
            <span className="hidden md:inline">
              {t(locale, "searchDesktop")}
            </span>
          </motion.span>
        )}

        {!isHomepage && (
          <motion.div
            key="fab-text"
            initial={{ opacity: 0, x: 10 }}
            animate={{
              opacity: 1,
              x: 0,
              width: "auto",
              transition: { duration: 0.3, delay: 0.1 },
            }}
            exit={{
              opacity: 0,
              x: 10,
              transition: { duration: 0.2 },
            }}
            className="hidden md:block overflow-hidden"
          >
            <span className="text-sm font-medium whitespace-nowrap">K</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHomepage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
            className="hidden sm:flex"
          >
            <kbd className="items-center gap-0.5 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded flex">
              <span>⌘</span>
              <span>K</span>
            </kbd>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );

  const fab = (
    <div
      // Leaves with the home for the sky window (globals.css, "The sky pull").
      data-sky-exits=""
      className={cn(
        "system-chrome fixed bottom-6 left-0 right-0 z-50 px-6",
        "flex pointer-events-none",
        isHomepage ? "justify-center" : "justify-end",
        // Ask at the side covers the trailing edge: away from the home the
        // buttons step aside to stand beside it (the bar's layout animation
        // carries it there, the ball follows).
        !isHomepage && askPlacement === "side" && "sm:pr-[calc(440px+1.5rem)]"
      )}
    >
      {bar}

      <AskBall barRef={buttonRef} isHomepage={isHomepage} stacked={stacked} yielding={yielding} />
    </div>
  );

  // The charge, drawn outside the button, because a finger is on it
  // (components/ui/hold-ring.tsx).
  const ring = (
    <AnimatePresence>
      {holdRing && (
        <HoldRing
          rect={holdRing}
          // Both shapes of this button share FAB_RADIUS.
          radius={FAB_RADIUS}
          durationMs={DEVTOOL_HOLD_MS - DEVTOOL_HOLD_REVEAL_MS}
        />
      )}
    </AnimatePresence>
  );

  if (!isDraggable)
    return (
      <>
        {fab}
        {ring}
      </>
    );

  return (
    <>
      <motion.div
      style={{
        ...drag.motionStyle,
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      drag
      dragControls={drag.dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
    >
      <div
        ref={drag.contentRef as React.RefObject<HTMLDivElement>}
        style={{ pointerEvents: "auto", touchAction: "none" }}
        onPointerDown={(e) => drag.startDrag(e)}
        onClickCapture={drag.preventClickAfterDrag}
      >
        {fab}
      </div>
    </motion.div>
    {ring}
    </>
  );
}

/**
 * The second way in, on every page: straight to Ask, where it was last put
 * (⌘J does the same), and again to close it. A ball the size of the corner's
 * button, lit while Ask is open.
 *
 * It stands beside the bar without touching it: outside the bar's flow
 * (absolute in the same fixed row), so the bar lays out and morphs exactly
 * as it does alone. Right of the prompt on the home, left of the button in a
 * desk's corner, above it on a phone.
 *
 * It has no timeline of its own; it rides the two the bar already has:
 *   - A navigation is a View Transition (next-view-transitions): the page,
 *     the bar with it, crossfades. The ball is a shared element of that
 *     transition (`view-transition-name: ask-ball`, globals.css), so the
 *     browser slides it straight from its old place to its new one, in the
 *     same window as the crossfade, the way λhux moves.
 *   - The bar's own layout animation (its settle into place after the
 *     crossfade, or a breakpoint, or the side panel): for every frame of it
 *     the ball stands beside the bar as drawn, so it moves exactly as the bar
 *     moves, in the same frame (read and written in framer's postRender,
 *     after the bar is drawn and before the paint). Moving it re-renders
 *     nothing.
 * It never changes shape.
 */
type Box = { left: number; top: number; width: number; height: number };

/** Longest a follow can run, in case the bar's morph never settles. */
const FOLLOW_MAX_MS = 2000;
/** The bar counts as still after this long without a transform. */
const STILL_MS = 300;

function AskBall({
  barRef,
  isHomepage,
  stacked,
  yielding,
}: {
  barRef: RefObject<HTMLButtonElement | null>;
  isHomepage: boolean;
  stacked: boolean;
  yielding: boolean;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { openAsk, closeAsk, askPlacement } = useCommand();
  // The ball's place is written straight to its style, in the same frame the
  // bar is drawn (a motion value would only be applied on framer's next
  // render, a frame behind the bar).
  const ball = useRef<HTMLButtonElement>(null);
  const [placed, setPlaced] = useState(false);
  // The bar's layout box when the ball last came to rest, and the follow
  // running now (a framer frame-loop callback), if any.
  const rest = useRef<Box | null>(null);
  const running = useRef<(() => void) | null>(null);

  /** Where the ball stands beside a bar with this box. */
  const beside = useCallback((b: Box) => ({
    x: isHomepage
      ? b.left + b.width + ASK_GAP
      : stacked
        ? b.left + b.width - ASK_SIZE
        : b.left - ASK_GAP - ASK_SIZE,
    y: stacked ? b.top - ASK_GAP - ASK_SIZE : b.top + (b.height - ASK_SIZE) / 2,
  }), [isHomepage, stacked]);

  /** Stand beside the bar as it is drawn right now. */
  const stand = useCallback((): { still: boolean; laid: Box } | null => {
    const bar = barRef.current;
    if (!bar) return null;
    // The bar as laid out (offsets ignore its morph's transforms) and as
    // drawn (its box on screen, transforms and all).
    const laid = { left: bar.offsetLeft, top: bar.offsetTop, width: bar.offsetWidth, height: bar.offsetHeight };
    const still = getComputedStyle(bar).transform === "none";
    let box = laid;
    if (!still) {
      const parent = bar.offsetParent as HTMLElement | null;
      const r = bar.getBoundingClientRect();
      const o = parent?.getBoundingClientRect() ?? { left: 0, top: 0 };
      box = { left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height };
    }
    const at = beside(box);
    if (ball.current) ball.current.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
    return { still, laid };
  }, [barRef, beside]);

  /**
   * Follow the bar until it is still. `now`: also place the ball at once.
   * Yes for a window resize, and for the bar's box changing size (the
   * ResizeObserver, which runs after layout and just before the paint, so
   * the bar as read is the bar as painted, even in the one frame its label's
   * exit lays it out before framer projects it). Not for a commit in the
   * middle of the bar's morph, which comes before framer's frame: there the
   * running follow places the ball after framer has drawn the bar.
   */
  const follow = useCallback((now = true) => {
    if (running.current) cancelFrame(running.current);
    const b = barRef.current;
    if (!b) return;
    const first = now
      ? stand()
      : { still: false, laid: { left: b.offsetLeft, top: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight } };
    if (!first) return;
    if (!rest.current) {
      rest.current = first.laid;
      setPlaced(true);
    }
    // Then in framer's own frame loop, after it has drawn the bar's morph
    // for the frame (postRender), until the bar has been still a while.
    const t0 = performance.now();
    let stillSince = first.still ? t0 : null;
    const step = () => {
      const now = performance.now();
      const at = stand();
      if (!at) return;
      stillSince = at.still ? (stillSince ?? now) : null;
      if ((stillSince !== null && now - stillSince >= STILL_MS) || now - t0 > FOLLOW_MAX_MS) {
        cancelFrame(step);
        running.current = null;
        rest.current = at.laid;
      }
    };
    running.current = step;
    frame.postRender(step, true);
  }, [barRef, stand]);

  // After every render of the row (a route, a breakpoint, the side panel),
  // and whenever the bar's own box or the window changes size: if the bar's
  // layout moved, follow it there.
  useLayoutEffect(() => {
    const b = barRef.current;
    if (!b) return;
    const last = rest.current;
    const moved =
      !last || last.left !== b.offsetLeft || last.top !== b.offsetTop || last.width !== b.offsetWidth;
    // At once if the bar was at rest; mid-morph (a commit inside framer's
    // frame, as when the bar's label finishes leaving) the running follow
    // places it after framer has drawn the bar, never beside a layout
    // framer has not projected yet.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first placement is read from layout, which exists only after commit
    if (moved) follow(!running.current);
  });
  useEffect(() => {
    const b = barRef.current;
    if (!b) return;
    const observer = new ResizeObserver(() => follow());
    observer.observe(b);
    // Every write to the bar's style (framer's projection, from its own frame
    // or from a React commit outside it, as when its label finishes leaving)
    // is answered before the paint: a mutation's callback is a microtask, so
    // the ball moves in the frame the bar does, whichever phase moved it.
    const writes = new MutationObserver(() => (running.current ? stand() : follow()));
    writes.observe(b, { attributes: true, attributeFilter: ["style"], childList: true });
    const onResize = () => follow();
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      writes.disconnect();
      window.removeEventListener("resize", onResize);
      if (running.current) cancelFrame(running.current);
    };
  }, [barRef, follow, stand]);

  return (
    <motion.button
      ref={ball}
      type="button"
      onClick={() => (askPlacement ? closeAsk() : openAsk())}
      aria-label={s.askRow}
      aria-pressed={askPlacement !== null}
      title={`${s.askRow} (⌘J)`}
      data-ask-ball=""
      initial={{ opacity: 0 }}
      animate={{ opacity: !placed || yielding ? 0 : 1 }}
      transition={{
        opacity: yielding
          ? { duration: HANDOFF.out }
          : { duration: HANDOFF.in, delay: HANDOFF.delay },
      }}
      style={{ width: ASK_SIZE, height: ASK_SIZE, borderRadius: FAB_RADIUS }}
      className={cn(
        "pressable pointer-events-auto absolute left-0 top-0 select-none",
        "flex items-center justify-center",
        "bg-glass backdrop-blur-xl",
        "border border-border/50 shadow-raised",
        "text-muted-foreground",
        "transition-[background-color,border-color,color] duration-200",
        "hover:bg-glass-hover hover:border-border hover:text-foreground",
        "active:bg-glass-strong-hover active:border-border active:text-foreground",
        "aria-pressed:border-border aria-pressed:bg-glass-strong aria-pressed:text-foreground",
        (yielding || !placed) && "pointer-events-none"
      )}
    >
      <Sparkles className="h-4 w-4" />
    </motion.button>
  );
}
