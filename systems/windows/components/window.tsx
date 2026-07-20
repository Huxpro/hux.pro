"use client";

import { cn } from "@/lib/utils";
import { animate, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindows } from "../provider";
import {
  MIN_SIZE,
  clampDrag,
  clampRect,
  getViewport,
  workingArea,
} from "../lib/geometry";
import type { Rect, WindowInstance } from "../lib/types";
import { AppFrame } from "./app-frame";
import { WindowChrome } from "./window-chrome";

// =============================================================================
// Window — one draggable / resizable app window
//
// Edge-to-edge content with a floating chrome pill on top (see WindowChrome).
// Gestures write geometry straight to the DOM node for the duration of the
// drag/resize (no per-frame React churn — iframes/Workers hate re-rendering),
// then commit once on pointer-up. A transparent "shield" over the body during a
// gesture stops the iframe from swallowing the pointer stream.
//
// Drag is intentionally *free* — you can pull a window mostly off-screen — and
// on release it springs back just far enough to keep the chrome grabbable, with
// a small overshoot as a friendly "edge" hint (we never force the whole app to
// stay on-screen, unlike some implementations).
// =============================================================================

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface GestureState {
  kind: "drag" | ResizeDir;
  startX: number;
  startY: number;
  rect: Rect;
}

const HANDLES: { dir: ResizeDir; className: string }[] = [
  { dir: "n", className: "top-0 inset-x-4 h-1.5 cursor-ns-resize" },
  { dir: "s", className: "bottom-0 inset-x-4 h-1.5 cursor-ns-resize" },
  { dir: "e", className: "right-0 inset-y-4 w-1.5 cursor-ew-resize" },
  { dir: "w", className: "left-0 inset-y-4 w-1.5 cursor-ew-resize" },
  { dir: "nw", className: "top-0 left-0 h-3.5 w-3.5 cursor-nwse-resize" },
  { dir: "ne", className: "top-0 right-0 h-3.5 w-3.5 cursor-nesw-resize" },
  { dir: "sw", className: "bottom-0 left-0 h-3.5 w-3.5 cursor-nesw-resize" },
  { dir: "se", className: "bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize" },
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
  const { focus, setRect, focusedId } = useWindows();
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<GestureState | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const focused = focusedId === win.id;
  const maximized = win.sizePreset === "max";
  const minimized = win.mode === "minimized";
  const isLynx = win.app.runtime === "lynx";

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

  useEffect(() => {
    if (!gesturing) return;
    const vp = getViewport();
    const area = workingArea(vp);

    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (g.kind === "drag") {
        // Free horizontally + downward; only pin the top so the chrome can't
        // slide above the reachable area. Release springs the rest back.
        paint({
          ...g.rect,
          x: g.rect.x + dx,
          y: Math.max(area.y, g.rect.y + dy),
        });
      } else {
        paint(clampRect(resizeRect(g.kind, g.rect, dx, dy), vp));
      }
    };

    const onUp = () => {
      const el = ref.current;
      const g = gesture.current;
      gesture.current = null;
      if (!el || !g) {
        setGesturing(false);
        return;
      }
      const painted: Rect = {
        x: el.offsetLeft,
        y: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
      };
      if (g.kind === "drag") {
        const { rect: target, clamped } = clampDrag(painted, vp);
        if (clamped) {
          // Spring back with a little overshoot — the "edge" hint. Keep
          // `gesturing` true so the CSS transition stays off and the shield
          // stays up until the bounce settles.
          animate(painted.x, target.x, {
            type: "spring",
            stiffness: 700,
            damping: 20,
            onUpdate: (v) => ref.current && (ref.current.style.left = `${v}px`),
          });
          animate(painted.y, target.y, {
            type: "spring",
            stiffness: 700,
            damping: 20,
            onUpdate: (v) => ref.current && (ref.current.style.top = `${v}px`),
            onComplete: () => {
              setGesturing(false);
              setRect(win.id, target);
            },
          });
          return;
        }
      }
      setGesturing(false);
      setRect(win.id, painted);
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
      inert={minimized || undefined}
      initial={{ opacity: 0, scale: 0.94 }}
      // Minimize/restore keeps the window MOUNTED (state preserved) — it genies
      // toward the dock band and springs back, never unmounts.
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
        transition: gesturing
          ? "none"
          : "left .28s cubic-bezier(.22,1,.36,1), top .28s cubic-bezier(.22,1,.36,1), width .28s cubic-bezier(.22,1,.36,1), height .28s cubic-bezier(.22,1,.36,1)",
      }}
      className={cn(
        "overflow-hidden",
        maximized ? "rounded-2xl" : "rounded-[22px]",
        "border border-black/10 dark:border-white/14",
        isLynx ? "bg-black" : "bg-background",
        focused ? "shadow-overlay ring-1 ring-black/5 dark:ring-white/10" : "shadow-raised",
      )}
    >
      {/* Edge-to-edge content */}
      <div className="absolute inset-0">
        <AppFrame app={win.app} />
      </div>

      {/* Floating chrome pill */}
      <WindowChrome
        win={win}
        focused={focused}
        onDragPointerDown={(e) => beginGesture("drag", e)}
      />

      {/* Gesture shield — stops the iframe/lynx-view eating the pointer stream. */}
      {gesturing && <div className="absolute inset-0 z-20" style={{ cursor: "inherit" }} />}

      {/* Resize edges — hidden while maximized. */}
      {!maximized &&
        HANDLES.map((h) => (
          <div
            key={h.dir}
            onPointerDown={(e) => beginGesture(h.dir, e)}
            style={{ touchAction: "none" }}
            className={cn("absolute z-30", h.className)}
          />
        ))}
    </motion.div>
  );
}
