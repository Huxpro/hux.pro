"use client";

import { GLASS_CAPSULE } from "@/lib/glass";
import { cn } from "@/lib/utils";
import {
  OUTSET_X,
  readBand,
  setBandBar,
  setBandMet,
  setBandOpen,
  subscribeBand,
  useBandGeometry,
  useBandSelect,
} from "@/systems/dock";
import { SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { onPageScroll } from "vitre";

// =============================================================================
// PinnedSlot: where a pinned bar rides, and that bar's half of the top band
// (systems/dock/band.ts). Any bar can ride in one: /works and /prompt's
// toolbars (PageLayout `pinnedActions`), a lab's own bar.
//
// A bar composes with the band by declaration, not by the slot knowing it:
//
//   `data-bar-give`   the part of the bar that gives way when it is
//                     squeezed: a chip group that scrolls inside itself, a
//                     name that truncates. The bar's minimum is its fixed
//                     parts and one whole choice of that part (or 64px of
//                     text): less than one choice is no longer a filter.
//   `data-bar-keep`   for a bar whose rows wrap (a lab's bar: its name, then
//                     its tools under it when they do not fit beside it),
//                     the part that must stay whole on its row. The bar's
//                     minimum is that, and the bar's own padding.
//   `data-bar-min`    a minimum stated outright, when neither says it.
//   `--band-reserve`  set here, read by the bar: the width it gives up at
//                     its end for the Dock. A one-row toolbar narrows as a
//                     whole; a bar of several rows narrows the ones it
//                     chooses. The rows are the bar's business.
//
// What the slot does:
//
//   Pins in the band when a configuration shares it (level with the Dock),
//   and under the Dock's pills otherwise, as it always has.
//
//   Says when the bar has met the band. It says so a little early, so the
//   occupants are already making room as it arrives, and with hysteresis, so
//   a scroll resting on the line does not flicker them between forms.
//
//   Reports the bar's box and widths, and follows the strip it rides in when
//   the bar scrolls with the occupants (`--band-scroll-x`).
//
//   Folds the bar to a ball when a count is opened, and brings it back when
//   the ball is tapped.
// =============================================================================

const EARLY_PX = 24;
const HYSTERESIS_PX = 6;
const MEET_GAP_PX = 8;
const TEXT_MIN_PX = 64;

/** Where a pinned bar pins while the band is not shared: half a rem under
 *  the Dock's pills, its glass (`--pin-outset` past its row) a rem from the
 *  top when there are none. Sharing, the slot sets its own top. */
export const PINNED_TOP = "top-[max(1rem,calc(var(--dock-clear)+0.5rem+var(--pin-outset)))]";

/** What a bar in a slot puts on its root: it gives up `--band-reserve` at its
 *  end, easing as the occupants make room. */
export const BAND_RESERVE =
  "max-w-[calc(100%-var(--band-reserve,0px))] transition-[max-width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

export function PinnedSlot({
  className,
  outset = OUTSET_X,
  insetTop = "var(--pin-outset)",
  children,
}: {
  className?: string;
  /**
   * How far the bar's glass reaches past its row sideways: a toolbar's
   * capsule grows round its row (10px); a bar that is its own glass has 0.
   */
  outset?: number;
  /**
   * How far the bar's glass reaches above its row: sharing the band, the
   * slot pins that far under the Dock's top, so the glass is level with the
   * pills'. A bar that is its own glass has none.
   */
  insetTop?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const geometry = useBandGeometry();
  const shares = useBandSelect((_, band) => band.config.share);

  // Met or not: the slot's top against the Dock's line.
  useEffect(() => {
    let met = false;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      const { clear } = readBand();
      if (clear === 0) met = false;
      else {
        const line = clear + MEET_GAP_PX + EARLY_PX;
        const top = el.getBoundingClientRect().top;
        met = met ? top < line + HYSTERESIS_PX : top <= line;
      }
      setBandMet(met);
    };
    check();
    const off = onPageScroll(check);
    // The occupants coming or going move the Dock's line, and a resize the
    // slot: both are band changes.
    const unsubscribe = subscribeBand(check);
    return () => {
      off();
      unsubscribe();
      setBandMet(false);
    };
  }, []);

  // The bar's box and widths, for the band's geometry.
  useEffect(() => {
    const slot = ref.current;
    const bar = slot?.firstElementChild as HTMLElement | null;
    if (!slot || !bar) return;
    // A wrapping bar's one-line width depends on what it holds, not on the
    // box it is in: measured again only when what it holds changes.
    let line: number | null = null;
    const measure = () => {
      const box = slot.getBoundingClientRect();
      const cs = getComputedStyle(slot);
      // The slot's content box, less the reserve it is currently giving.
      // The reserve is padding-free (a variable), so this is the column.
      const left = box.left + parseFloat(cs.paddingLeft);
      const right = box.right - parseFloat(cs.paddingRight);
      const give = bar.querySelector<HTMLElement>("[data-bar-give]");
      const keep = bar.querySelector<HTMLElement>("[data-bar-keep]");
      const stated = Number(bar.dataset.barMin);
      let natural = bar.offsetWidth;
      let min = natural;
      if (stated > 0 || keep) {
        // A bar that wraps is as wide as its box lets it be; what it needs
        // is its kept part and its own padding and border.
        const bs = getComputedStyle(bar);
        const chrome =
          parseFloat(bs.paddingLeft) +
          parseFloat(bs.paddingRight) +
          parseFloat(bs.borderLeftWidth) +
          parseFloat(bs.borderRightWidth);
        min = stated > 0 ? stated : keep!.scrollWidth + chrome;
        // Its width on one line, measured off a hidden copy laid out at
        // max-content without wrapping: a part that scrolls inside itself
        // hides its width from its parent, but not from max-content. The
        // bar itself is never touched, so nothing it is easing jumps.
        if (line === null) {
          const ghost = bar.cloneNode(true) as HTMLElement;
          ghost.setAttribute("aria-hidden", "true");
          ghost.style.cssText +=
            ";position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;width:max-content;max-width:none;flex-wrap:nowrap;transform:none;transition:none";
          slot.appendChild(ghost);
          line = ghost.getBoundingClientRect().width;
          ghost.remove();
        }
        natural = line;
      } else if (give) {
        const fixed = bar.offsetWidth - give.clientWidth;
        natural = fixed + give.scrollWidth;
        const first = give.firstElementChild as HTMLElement | null;
        min = fixed + (first ? Math.min(give.scrollWidth, first.offsetWidth) : TEXT_MIN_PX);
      }
      setBandBar({ left, right, outset, natural: Math.ceil(natural), min: Math.round(min) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    ro.observe(bar);
    const give = bar.querySelector("[data-bar-give]");
    if (give) ro.observe(give);
    // A change in what the bar holds (a chip turning on, a label swapping,
    // its kept part resizing as a font arrives) is a new one-line width.
    const stale = () => {
      line = null;
      measure();
    };
    const content = new MutationObserver(stale);
    content.observe(bar, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    const keep = bar.querySelector("[data-bar-keep]");
    const kept = new ResizeObserver(stale);
    if (keep) kept.observe(keep);
    // A centred column moves without resizing.
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      content.disconnect();
      kept.disconnect();
      window.removeEventListener("resize", measure);
      setBandBar(null);
    };
  }, [outset]);

  const riding = geometry.rides;
  const folded = geometry.mode === "open";

  return (
    <div
      ref={ref}
      data-pinned-slot=""
      className={className}
      style={{
        // In the band: its glass level with the Dock's top.
        ...(shares ? { top: `calc(max(env(safe-area-inset-top), 0.5rem) + ${insetTop})` } : {}),
        // What the bar gives up at its end, eased by the bar's own transition.
        ["--band-reserve" as string]: `${geometry.reserve}px`,
        transform: riding ? "translateX(calc(var(--band-scroll-x, 0px) * -1))" : undefined,
      }}
      data-band-folded={folded ? "" : undefined}
    >
      {children}
      <AnimatePresence>
        {folded && (
          <motion.button
            key="folded"
            type="button"
            aria-label="Filters"
            onClick={() => setBandOpen(false)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              GLASS_CAPSULE,
              "absolute z-10 flex h-9 w-9 items-center justify-center text-foreground hover:bg-glass-hover",
              "pressable hit-area active:border-border active:bg-glass-hover active:scale-95",
            )}
            style={{
              left: -outset,
              top: `calc(${insetTop} * -1)`,
              transformOrigin: "left center",
            }}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
