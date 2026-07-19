"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindows } from "../provider";
import {
  MIN_SIZE,
  TITLE_BAR_H,
  clampDrag,
  clampRect,
  getViewport,
} from "../lib/geometry";
import type { Rect, WindowInstance } from "../lib/types";
import { AppFrame } from "./app-frame";
import { AppBadgeFor } from "./app-badge";
import { TrafficLights } from "./traffic-lights";

// =============================================================================
// Window — one draggable / resizable "chrome" around an app
//
// The macOS/iPadOS window: a title bar with traffic-light controls that you
// grab to drag, eight resize edges, and a body that hosts the app frame
// (iframe for web apps, the Lynx Player for Lynx apps).
//
// Gestures write geometry straight to the DOM node for the duration of the
// drag/resize (no per-frame React churn — iframes/Workers hate re-rendering),
// then commit the final rect to the provider once on pointer-up. A transparent
// "shield" over the body during a gesture stops the iframe from swallowing the
// pointer stream (an iframe eats pointermove, which would freeze the drag the
// instant the cursor crossed into it).
// =============================================================================

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface GestureState {
  kind: "drag" | ResizeDir;
  startX: number;
  startY: number;
  rect: Rect;
}

/** Resize handle definitions: direction → positioning + cursor classes. */
const HANDLES: { dir: ResizeDir; className: string }[] = [
  { dir: "n", className: "top-0 inset-x-3 h-1.5 cursor-ns-resize" },
  { dir: "s", className: "bottom-0 inset-x-3 h-1.5 cursor-ns-resize" },
  { dir: "e", className: "right-0 inset-y-3 w-1.5 cursor-ew-resize" },
  { dir: "w", className: "left-0 inset-y-3 w-1.5 cursor-ew-resize" },
  { dir: "nw", className: "top-0 left-0 h-3 w-3 cursor-nwse-resize" },
  { dir: "ne", className: "top-0 right-0 h-3 w-3 cursor-nesw-resize" },
  { dir: "sw", className: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize" },
  { dir: "se", className: "bottom-0 right-0 h-3 w-3 cursor-nwse-resize" },
];

/** Apply a resize delta to a rect, honouring the minimum size + anchor edges. */
function resizeRect(dir: ResizeDir, base: Rect, dx: number, dy: number): Rect {
  let { x, y, width, height } = base;
  if (dir.includes("e")) width = Math.max(MIN_SIZE.width, base.width + dx);
  if (dir.includes("s")) height = Math.max(MIN_SIZE.height, base.height + dy);
  if (dir.includes("w")) {
    const w = Math.max(MIN_SIZE.width, base.width - dx);
    x = base.x + (base.width - w);
    width = w;
  }
  if (dir.includes("n")) {
    const h = Math.max(MIN_SIZE.height, base.height - dy);
    y = base.y + (base.height - h);
    height = h;
  }
  return { x, y, width, height };
}

export function Window({ win }: { win: WindowInstance }) {
  const { focus, close, minimize, toggleMaximize, setRect, focusedId } =
    useWindows();
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<GestureState | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const focused = focusedId === win.id;
  const maximized = win.mode === "maximized";
  const minimized = win.mode === "minimized";

  // Write geometry to the node directly — the fast path during a gesture.
  const paint = useCallback((rect: Rect) => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }, []);

  const beginGesture = useCallback(
    (kind: GestureState["kind"], e: React.PointerEvent) => {
      if (maximized) return; // maximized windows don't drag/resize
      e.preventDefault();
      focus(win.id);
      gesture.current = {
        kind,
        startX: e.clientX,
        startY: e.clientY,
        rect: win.rect,
      };
      setGesturing(true);
    },
    [maximized, focus, win.id, win.rect],
  );

  // Global pointer listeners live for the duration of a gesture only.
  useEffect(() => {
    if (!gesturing) return;
    const vp = getViewport();

    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (g.kind === "drag") {
        paint(clampDrag({ ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy }, vp));
      } else {
        paint(clampRect(resizeRect(g.kind, g.rect, dx, dy), vp));
      }
    };

    const onUp = () => {
      const el = ref.current;
      const g = gesture.current;
      gesture.current = null;
      setGesturing(false);
      if (el && g) {
        // Read back what we painted and commit it as the new committed rect.
        setRect(win.id, {
          x: el.offsetLeft,
          y: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gesturing, paint, setRect, win.id]);

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={win.app.title}
      aria-hidden={minimized || undefined}
      // `inert` while minimized: hidden windows keep running (state preserved)
      // but shouldn't be focusable or take pointer/tab input.
      inert={minimized || undefined}
      initial={{ opacity: 0, scale: 0.94 }}
      // Minimize/restore is NOT a mount/unmount — the window stays mounted (so
      // its iframe / <lynx-view> and state survive) and just animates: it
      // genies down toward the dock's live-activity band (scale → 0, up to the
      // top-center) and springs back on restore.
      animate={
        minimized
          ? {
              opacity: 0,
              scale: 0.08,
              x: getViewport().width / 2 - (win.rect.x + win.rect.width / 2),
              y: 16 - win.rect.y,
            }
          : { opacity: 1, scale: 1, x: 0, y: 0 }
      }
      // Exit is only for close (a genuine unmount): shrink in place.
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={
        minimized
          ? { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
          : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 }
      }
      onPointerDownCapture={() => focus(win.id)}
      style={{
        position: "absolute",
        left: win.rect.x,
        top: win.rect.y,
        width: win.rect.width,
        height: win.rect.height,
        zIndex: win.z,
        pointerEvents: minimized ? "none" : "auto",
        // Instant during gestures; a soft ease when the manager moves us
        // (maximize / restore / resize-clamp).
        transition: gesturing
          ? "none"
          : "left .28s cubic-bezier(.22,1,.36,1), top .28s cubic-bezier(.22,1,.36,1), width .28s cubic-bezier(.22,1,.36,1), height .28s cubic-bezier(.22,1,.36,1)",
      }}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl",
        "border border-black/10 bg-card/95 backdrop-blur-xl dark:border-white/12",
        focused ? "shadow-overlay" : "shadow-raised",
        maximized && "rounded-lg",
      )}
    >
      {/* Title bar — grab surface. Double-click zooms, like macOS. */}
      <div
        onPointerDown={(e) => beginGesture("drag", e)}
        onDoubleClick={() => toggleMaximize(win.id)}
        style={{ height: TITLE_BAR_H, touchAction: "none" }}
        className={cn(
          "relative flex shrink-0 items-center gap-3 px-3 select-none",
          "border-b border-black/6 dark:border-white/8",
          focused ? "bg-black/[0.03] dark:bg-white/[0.04]" : "bg-transparent",
        )}
      >
        <TrafficLights
          onClose={() => close(win.id)}
          onMinimize={() => minimize(win.id)}
          onZoom={() => toggleMaximize(win.id)}
        />
        {/* Centered title + runtime badge. */}
        <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center gap-1.5">
          <AppBadgeFor app={win.app} size={13} />
          <span className="max-w-[60%] truncate text-[12px] font-medium text-foreground/70">
            {win.app.title}
          </span>
        </div>
      </div>

      {/* Body — the app frame, plus a gesture shield. */}
      <div className="relative flex-1 overflow-hidden bg-background">
        <AppFrame app={win.app} />
        {gesturing && (
          // Swallows pointer events so the iframe/lynx-view can't hijack the
          // in-flight drag/resize.
          <div className="absolute inset-0 z-10" style={{ cursor: "inherit" }} />
        )}
      </div>

      {/* Resize edges — hidden while maximized. */}
      {!maximized &&
        HANDLES.map((h) => (
          <div
            key={h.dir}
            onPointerDown={(e) => beginGesture(h.dir, e)}
            style={{ touchAction: "none" }}
            className={cn("absolute z-20", h.className)}
          />
        ))}
    </motion.div>
  );
}
