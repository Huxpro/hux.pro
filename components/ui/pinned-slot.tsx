"use client";

import { cn } from "@/lib/utils";
import { setBandShared, useBand } from "@/systems/dock";
import { useEffect, useRef, type ReactNode } from "react";
import { onPageScroll } from "vitre";

/**
 * The slot a pinned bar rides in (PageLayout `pinnedActions`), and its half
 * of the shared band (systems/dock/band.ts).
 *
 * The bar pins in the Dock's own band — its glass (`--pin-outset` past its
 * row) level with the pills' top — never under them. So when there are pills
 * and the bar rises to meet them, it says so, at the point where it would
 * otherwise have had to stop under them (`--dock-clear` + the pills' gap);
 * the Dock turns them into circles at the column's end, and the slot gives up
 * their width (`--dock-minimal-w`) so the bar ends a gap before the first.
 * The bar's chip group already scrolls inside itself when squeezed.
 *
 * Measured, not assumed: the slot's own top against that line, on scroll and
 * resize, and when the pills come or go (the Dock rewrites `--dock-clear` on
 * the root). A few pixels of hysteresis so a scroll resting on the line does
 * not flicker the pills between their two forms.
 */
const MEET_GAP_PX = 8;
const HYSTERESIS_PX = 4;

export function PinnedSlot({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { shared } = useBand();

  useEffect(() => {
    const root = document.documentElement;
    let met = false;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      const clear = parseFloat(getComputedStyle(root).getPropertyValue("--dock-clear")) || 0;
      if (clear === 0) {
        met = false;
      } else {
        const line = clear + MEET_GAP_PX;
        const top = el.getBoundingClientRect().top;
        met = met ? top < line + HYSTERESIS_PX : top <= line;
      }
      setBandShared(met);
    };
    check();
    const off = onPageScroll(check);
    window.addEventListener("resize", check);
    const mo = new MutationObserver(check);
    mo.observe(root, { attributes: true, attributeFilter: ["style"] });
    return () => {
      off();
      window.removeEventListener("resize", check);
      mo.disconnect();
      setBandShared(false);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(className, "transition-[padding] duration-200")}
      // The circles' width, plus the glass the capsule draws past its row.
      style={
        shared
          ? { paddingRight: "calc(var(--dock-minimal-w, 0px) + var(--pin-outset-x))" }
          : undefined
      }
    >
      {children}
    </div>
  );
}
