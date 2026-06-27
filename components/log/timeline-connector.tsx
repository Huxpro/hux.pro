"use client";

/**
 * TimelineConnector — Persistent back-point line for explicit
 * `attachedTo` attachments.
 *
 * Uses the same visual language as the tenure rail: a thin vertical
 * line running through the icon column, dimmed by default, brightening
 * when EITHER endpoint (source commit or target role) is hovered,
 * focused, or expanded. Endpoint icons get a small gap so the line
 * meets them as nodes rather than slicing through.
 *
 *   ●  ← source commit (icon)
 *   │
 *   │  (passes behind intermediate commits' icons)
 *   │
 *   ◯  ← target role (ring)
 *
 * Geometry is measured from each row's `data-rail-icon` span via the
 * row's hash id. Re-measures on container/icon resize via ResizeObserver.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TimelineConnectorProps {
  fromHash: string;
  toHash: string;
  /** Gap (px) from source icon center where the line should start.
   *  Match the row's iconGapPx — 7 for regular icons, 10 for role
   *  rings, 3 for event dots. */
  fromGap: number;
  /** Gap (px) from target icon center where the line should end. */
  toGap: number;
  isActive: boolean;
}

interface Geom {
  /** SVG box top, relative to the commits container. */
  top: number;
  /** Center x (matches the icon column's center) relative to container. */
  x: number;
  /** SVG height = distance between the two endpoint icon centers. */
  height: number;
  /** Gap (px) at the start so the line meets the top endpoint as a node. */
  gapStart: number;
  /** Gap (px) at the end so the line meets the bottom endpoint. */
  gapEnd: number;
}

export function TimelineConnector({
  fromHash,
  toHash,
  fromGap,
  toGap,
  isActive,
}: TimelineConnectorProps) {
  const selfRef = useRef<HTMLDivElement | null>(null);
  const [geom, setGeom] = useState<Geom | null>(null);

  useLayoutEffect(() => {
    const self = selfRef.current;
    const container = self?.parentElement;
    if (!container) return;
    const fromRow = document.getElementById(fromHash);
    const toRow = document.getElementById(toHash);
    if (!fromRow || !toRow) return;
    const fromIcon = fromRow.querySelector<HTMLElement>("[data-rail-icon]");
    const toIcon = toRow.querySelector<HTMLElement>("[data-rail-icon]");
    if (!fromIcon || !toIcon) return;

    const measure = () => {
      const cRect = container.getBoundingClientRect();
      const fRect = fromIcon.getBoundingClientRect();
      const tRect = toIcon.getBoundingClientRect();
      const fy = Math.round(fRect.top + fRect.height / 2 - cRect.top);
      const ty = Math.round(tRect.top + tRect.height / 2 - cRect.top);
      const fx = Math.round(fRect.left + fRect.width / 2 - cRect.left);
      if (fy === ty) {
        setGeom(null);
        return;
      }
      const top = Math.min(fy, ty);
      const height = Math.abs(fy - ty);
      // gapStart/gapEnd correspond to the TOP and BOTTOM of the SVG
      // box, so swap based on which endpoint is on top.
      const sourceOnTop = fy < ty;
      setGeom({
        top,
        x: fx,
        height,
        gapStart: sourceOnTop ? fromGap : toGap,
        gapEnd: sourceOnTop ? toGap : fromGap,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(fromIcon);
    ro.observe(toIcon);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fromHash, toHash, fromGap, toGap]);

  return (
    <div
      ref={selfRef}
      aria-hidden
      className="pointer-events-none absolute"
      style={
        geom
          ? {
              top: geom.top + geom.gapStart,
              left: geom.x,
              width: 1,
              height: Math.max(0, geom.height - geom.gapStart - geom.gapEnd),
              transform: "translateX(-0.5px)",
            }
          : { top: 0, left: 0, width: 0, height: 0, visibility: "hidden" }
      }
    >
      <span
        className={cn(
          "block w-full h-full transition-colors duration-200",
          // Dim by default, bright when either endpoint is active —
          // matches the tenure rail's `/10` → `/30` palette so the
          // back-point reads as the same vocabulary, just spanning
          // non-contiguous rows.
          isActive ? "bg-muted-foreground/30" : "bg-muted-foreground/10",
        )}
      />
    </div>
  );
}
