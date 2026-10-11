"use client";

import { GLASS_CAPSULE } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { DockProvider } from "../provider";
import { DockNotice } from "./dock-notice";
import { CAPSULE, setBandDock, setBandOpen, strip, useBand, useBandGeometry } from "../band";
import { AnimatePresence, motion } from "motion/react";

// ---------------------------------------------------------------------------
// Dock: the top-of-screen home for Live Activities.
//
// Layout model (per product spec):
//   • Collapsed: pills sit side by side in a horizontal, centered row that
//     becomes horizontally scrollable once it gets crowded.
//   • Expanded: the open activity's panel takes over the same top-center anchor
//     while every pill goes invisible and stops taking pointers.
//   • A notice (../notice.ts) takes the anchor the same way, for as long as it
//     is up (see dock-notice.tsx).
//
// The row holds pills and nothing else. The panels are Base UI drawers,
// portalled into the shared surface viewport (see live-activity.tsx), so the
// row is free to lay itself out however it likes. The old rule that it must
// carry no transform (so the `fixed` panels inside it stayed anchored to the
// viewport) went away with the portal.
//
// With a page's pinned bar in the band (../band.ts) the row takes the place
// the band's composition gives it: a window at the column's end (a row or a
// tray), the strip the bar rides in, a count's ball, the count opened. Its
// box is `bandGeometry`'s window, which is also where it clips. Moving
// between places is that box's edges transitioning, with each pill's width
// animating into or out of its ball, so nothing jumps.
//
// There is no scrim. A press outside an open panel is the drawer's own outside
// press now, which is what the transparent scrim was standing in for.
// ---------------------------------------------------------------------------

const MOVE = { duration: 0.32, ease: [0.32, 0.72, 0, 1] } as const;
/** The row's shadow room above and below its pills (`py-3`). */
const ROOM = 12;

/**
 * The window's clip. Where it ends in mid-air (against the bar, the folded
 * ball, the column), the end is a capsule's. An occupant sliding out of it
 * goes under a curve of its own radius instead of being cut by a straight
 * line, and one resting flush against it is exactly its own shape. At the
 * screen's edge the end stays square: the phone cuts it there. Between the
 * ends the clip keeps the row's full height, so the pills keep their
 * shadows. A path rather than a mask: a clip leaves the pills' blur alone,
 * a mask would not.
 */
function windowClip(width: number, roundStart: boolean, roundEnd: boolean) {
  const r = CAPSULE / 2;
  const h = CAPSULE + ROOM * 2;
  const top = ROOM;
  const bottom = ROOM + CAPSULE;
  const l = roundStart ? r : 0;
  const e = roundEnd ? width - r : width;
  const end = roundEnd ? `V ${top} A ${r} ${r} 0 0 1 ${e} ${bottom} V ${h}` : `V ${h}`;
  const start = roundStart ? `V ${bottom} A ${r} ${r} 0 0 1 ${l} ${top} V 0` : "V 0";
  return `path("M ${l} 0 H ${e} ${end} H ${l} ${start} Z")`;
}

/** How much of an occupant a round end may leave before it fades: gone
 *  under 6px, whole from two thirds of a ball. By the time what is left is
 *  half a ball or less, it is already fading. */
function sliver(seen: number) {
  const t = Math.min(1, Math.max(0, (seen - 6) / ((CAPSULE * 2) / 3 - 6)));
  return t * t * (3 - 2 * t);
}

const MOVE_CSS = ["left", "width", "padding-left", "padding-right", "clip-path"]
  .map((p) => `${p} ${MOVE.duration}s cubic-bezier(${MOVE.ease.join(",")})`)
  .join(", ");

function DockSurface({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const band = useBand();
  const geometry = useBandGeometry();
  const { vw } = band;
  const rides = geometry.rides;

  // The strip the bar rides in hands its scroll to the pinned slot to
  // follow. The offset is set on the slot itself, so a scroll restyles the
  // slot, not the document. When it stops riding in the strip, the row
  // scrolls back home.
  useEffect(() => {
    const row = scrollRef.current;
    if (!row || !rides) return;
    const slot = () => document.querySelector<HTMLElement>("[data-pinned-slot]");
    const onScroll = () => slot()?.style.setProperty("--band-scroll-x", `${row.scrollLeft}px`);
    row.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      row.removeEventListener("scroll", onScroll);
      row.scrollLeft = 0;
      slot()?.style.removeProperty("--band-scroll-x");
    };
  }, [rides]);

  // Mouse drag-to-scroll (touch scrolls natively). `moved` gates the click
  // suppression so a drag never also fires a pill's onClick.
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  // What the pills cover, published as `--dock-clear` on <html>: the
  // distance from the top of the viewport to their bottom edge, 0 when there
  // are none. Anything that pins itself to the top of the page (the /works
  // bar) clears the dock by it instead of guessing whether a Live Activity
  // is up here right now.
  useEffect(() => {
    const row = scrollRef.current;
    const bar = row?.parentElement;
    if (!row || !bar) return;
    const root = document.documentElement;
    const publish = () => {
      // Layout boxes, not rects: a pill arrives scaled (`dock-pop-in`), and
      // its rect would report the frame of the animation it was caught in.
      // The pills' offsets are from the fixed bar; the row's own `py-3` is
      // shadow room, not something to clear.
      let bottom = 0;
      for (const pill of Array.from(row.children) as HTMLElement[]) {
        if (pill.offsetHeight > 0) {
          // The row is positioned, so a pill's offset is from the row, which
          // itself sits 12px up (its `-my-3` shadow room).
          bottom = Math.max(bottom, row.offsetTop + pill.offsetTop + pill.offsetHeight);
        }
      }
      const clear = bottom > 0 ? Math.ceil(bar.getBoundingClientRect().top + bottom) : 0;
      root.style.setProperty("--dock-clear", `${clear}px`);
      // Each occupant's width as a pill, in row order, for the band's
      // geometry (band.ts), measured by the occupant itself.
      setBandDock(
        (Array.from(row.children) as HTMLElement[])
          .map((pill) => Number(pill.dataset.natural))
          .filter((w) => w > 0),
        clear,
      );
    };
    publish();
    // A pill arriving or leaving, a pill changing size (a panel collapsing
    // back into it), and an occupant's width as a pill changing. What goes
    // on inside a pill (EQ bars coming and going) is not the row's business.
    const ro = new ResizeObserver(publish);
    ro.observe(row);
    const mo = new MutationObserver((records) => {
      let relevant = false;
      for (const r of records) {
        if (r.type === "attributes") relevant = true;
        else if (r.target === row) {
          relevant = true;
          r.addedNodes.forEach((n) => n instanceof Element && ro.observe(n));
          r.removedNodes.forEach((n) => n instanceof Element && ro.unobserve(n));
        }
      }
      if (relevant) publish();
    });
    mo.observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-natural"] });
    for (const pill of Array.from(row.children)) ro.observe(pill);
    window.addEventListener("resize", publish);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--dock-clear");
    };
  }, []);

  // Where the row stands. One box in every mode, placed by its left edge and
  // width, so moving from one mode to another is those two numbers
  // animating, not the row reappearing somewhere else. In stack it is the
  // pills centred (the screen less its 16px margins, scrolling once they
  // outgrow it); sharing the band, it is exactly the occupants' window
  // (band.ts), which is also where it clips: nothing in it can slide under
  // the bar, the folded ball or the gutter.
  const stackWidth = Math.min(strip(band.naturals) + 32, vw);
  const box = geometry.window ?? { left: (vw - stackWidth) / 2, width: stackWidth, padStart: 16, padEnd: 16 };
  const measured = band.naturals.length > 0;
  const roundStart = !!geometry.window && box.left > 0.5;
  const roundEnd = !!geometry.window && box.left + box.width < vw - 0.5;
  const clip = geometry.window ? windowClip(box.width, roundStart, roundEnd) : undefined;

  // A sliver fades. When a round end leaves less than half a ball of an
  // occupant, what remains does not read as a shape, so it fades out over its
  // last few pixels. On the glass itself, as `filter:
  // opacity()`: an opacity on anything holding the glass would take its blur
  // with it, and a parked pill's own opacity is motion's. Followed on every
  // scroll, and through the window's own move. With no round end there is
  // nothing to fade, and nothing to follow.
  useEffect(() => {
    const row = scrollRef.current;
    if (!row || (!roundStart && !roundEnd)) return;
    // Every occupant marks its glass (use-band-occupant.ts).
    const glassOf = (el: Element) =>
      el.matches("[data-band-glass]") ? (el as HTMLElement) : el.querySelector<HTMLElement>("[data-band-glass]");
    const apply = () => {
      // Every rect first, then every write: one layout, not one per pill.
      const r = row.getBoundingClientRect();
      const fades = Array.from(row.children).map((el) => {
        const b = el.getBoundingClientRect();
        let f = 1;
        if (roundStart && b.left < r.left) f = Math.min(f, sliver(b.right - r.left));
        if (roundEnd && b.right > r.right) f = Math.min(f, sliver(r.right - b.left));
        return [glassOf(el), f] as const;
      });
      for (const [glass, f] of fades) if (glass) glass.style.filter = f < 1 ? `opacity(${f.toFixed(3)})` : "";
    };
    let raf = 0;
    const until = performance.now() + MOVE.duration * 1000 + 120;
    const follow = () => {
      apply();
      if (performance.now() < until) raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      row.removeEventListener("scroll", onScroll);
      for (const el of Array.from(row.children)) {
        const glass = glassOf(el);
        if (glass) glass.style.filter = "";
      }
    };
  }, [roundStart, roundEnd, box.left, box.width, band.naturals.length]);

  return (
    <div
      className="system-chrome pointer-events-none fixed left-0 right-0 z-50"
      style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
    >
      <div
        ref={scrollRef}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = {
            active: true,
            startX: e.clientX,
            startLeft: scrollRef.current?.scrollLeft ?? 0,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d.active || !scrollRef.current) return;
          const dx = e.clientX - d.startX;
          if (Math.abs(dx) > 4) d.moved = true;
          if (d.moved) scrollRef.current.scrollLeft = d.startLeft - dx;
        }}
        onPointerUp={() => (drag.current.active = false)}
        onPointerLeave={() => (drag.current.active = false)}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
        // `py-3 -my-3` gives the pills' shadow room *inside* the overflow clip
        // (overflow-x forces overflow-y to clip too) without shifting the row;
        // sideways there is none, so the clip is the window's edge.
        className={cn(
          "absolute top-0 flex items-center gap-2 py-3 -my-3",
          "overflow-x-auto no-scrollbar overscroll-x-contain",
          // Each occupant lands whole at the window's start.
          "snap-x snap-mandatory [&>*]:snap-start",
          // The strip the bar rides in lies over the bar: the strip takes no
          // pointer, its occupants do.
          rides ? "pointer-events-none" : "pointer-events-auto",
          !measured && "justify-center",
        )}
        style={
          measured
            ? {
                left: box.left,
                width: box.width,
                paddingLeft: box.padStart,
                paddingRight: box.padEnd,
                scrollPaddingLeft: box.padStart,
                clipPath: clip,
                transition: MOVE_CSS,
              }
            : { left: 0, width: "100%", paddingLeft: 16, paddingRight: 16 }
        }
      >
        {children}
      </div>
      {/* A count, closed: everything in the Dock is one ball with how many. */}
      <AnimatePresence>
        {geometry.mode === "count" && geometry.window && (
          <motion.button
            key="count"
            type="button"
            data-band-count=""
            aria-label={String(band.naturals.length)}
            title={String(band.naturals.length)}
            onClick={() => setBandOpen(true)}
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ duration: 0.22, ease: MOVE.ease }}
            className={cn(
              GLASS_CAPSULE,
              "pointer-events-auto absolute top-0 flex h-9 w-9 items-center justify-center",
              "font-mono text-sm font-semibold text-foreground hover:bg-glass-hover",
              // 36px drawn, 48px to a finger; the press lands on touch-down.
              "pressable hit-area active:border-border active:bg-glass-hover active:scale-95",
            )}
            style={{ left: geometry.window.left, transformOrigin: "top center" }}
          >
            {band.naturals.length}
          </motion.button>
        )}
      </AnimatePresence>
      <DockNotice />
    </div>
  );
}

export function Dock({ children }: { children: React.ReactNode }) {
  return (
    <DockProvider>
      <DockSurface>{children}</DockSurface>
    </DockProvider>
  );
}
