"use client";

import { appTitle } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
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
import { armPointer } from "../lib/pointer";
import type { Rect, WindowInstance } from "../lib/types";
import { AppFrame, appGround } from "./app-frame";
import { WindowChrome } from "./window-chrome";
import { WindowSheet } from "./window-sheet";
import { useSurfaceMode, type SurfacePresentation } from "@/systems/surface";

// =============================================================================
// Window — one app window, in the shape the viewport asks for
//
// Below `sm` a window is a sheet (window-sheet.tsx): a phone has no room for a
// box you move around, and a sheet is what that size of screen already speaks.
// From `sm` up it is the draggable, resizable window below. The decision is the
// surface system's breakpoint map, the same one that turns the palette into a
// sheet at the same width — where a surface lives is a property of the
// viewport, not of the feature (docs/system-surface.md).
//
// Crossing the breakpoint remounts the app (the two shapes are different
// components, so the iframe reloads). Resizing a phone into a desktop mid-app
// is not a gesture anyone makes; keeping one tree for both shapes would cost
// far more than it saves.
// =============================================================================

/** A window is a sheet on a phone, a window from `sm` up. */
const WINDOW_PRESENTATION: SurfacePresentation = { base: "sheet", sm: "window" };

export function Window({ win }: { win: WindowInstance }) {
  // Resolved on the first render, not in an effect: a window only ever appears
  // because somebody opened one, so there is no server render to agree with —
  // and starting in the phone shape would commit this app's iframe, fetch it,
  // and throw it away a frame later.
  return useSurfaceMode(WINDOW_PRESENTATION, { immediate: true }) === "sheet" ? (
    <WindowSheet win={win} />
  ) : (
    <DesktopWindow win={win} />
  );
}

// =============================================================================
// DesktopWindow — one draggable / resizable app window
//
// Edge-to-edge content with a floating dots pill on top (WindowChrome). You can
// also grab a thin band along the top edge to drag (a tolerance around the
// chrome). Gestures write geometry straight to the DOM node for the gesture's
// duration (no per-frame React churn — iframes/Workers hate re-rendering), then
// commit once on pointer-up. A "shield" over the body during a gesture stops the
// iframe from swallowing the pointer stream.
//
// Drag is *free* — you can tuck a window mostly off-screen — and on release it
// springs back just enough to keep the chrome grabbable, with a small overshoot
// as a friendly edge hint. Hovering the drag band or a resize edge (and any
// active gesture) softly lights the window's border as feedback.
// =============================================================================

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface GestureState {
  kind: "drag" | ResizeDir;
  startX: number;
  startY: number;
  rect: Rect;
}

// No `n` edge handle: the top edge is the drag-tolerance band (below), so
// top-height resize lives on the nw/ne corners instead.
const HANDLES: { dir: ResizeDir; className: string }[] = [
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

function DesktopWindow({ win }: { win: WindowInstance }) {
  const { focus, setRect, focusedId, toggleMaximize } = useWindows();
  const { locale } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<GestureState | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const focused = focusedId === win.id;
  const maximized = win.sizePreset === "max";
  const minimized = win.mode === "minimized";

  const paint = useCallback((rect: Rect) => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }, []);

  // Seed a drag from an explicit point (the pill / top band arm it after a
  // small threshold so a tap doesn't jerk the window).
  const beginDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (maximized) return;
      focus(win.id);
      gesture.current = { kind: "drag", startX: clientX, startY: clientY, rect: win.rect };
      setGesturing(true);
    },
    [maximized, focus, win.id, win.rect],
  );

  // Resize handles start their gesture immediately on pointer-down.
  const beginResize = useCallback(
    (dir: ResizeDir, e: React.PointerEvent) => {
      if (maximized) return;
      e.preventDefault();
      focus(win.id);
      gesture.current = { kind: dir, startX: e.clientX, startY: e.clientY, rect: win.rect };
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
        paint({ ...g.rect, x: g.rect.x + dx, y: Math.max(area.y, g.rect.y + dy) });
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
      aria-label={appTitle(win.app, locale)}
      aria-hidden={minimized || undefined}
      inert={minimized || undefined}
      initial={{ opacity: 0, scale: 0.94 }}
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
        appGround(win.app),
        focused ? "shadow-overlay ring-1 ring-black/5 dark:ring-white/10" : "shadow-raised",
      )}
    >
      {/* Edge-to-edge content. Keyed by generation: the menu's Reload is a
          remount (see `reload` in the provider). */}
      <div className="absolute inset-0">
        <AppFrame key={win.generation} app={win.app} />
      </div>

      {/* Top-edge drag tolerance — grab near the top border to move. Sits below
          the resize handles (so the very top edge still resizes) and the pill. */}
      {!maximized && (
        <div
          onPointerDown={(e) => e.button === 0 && armPointer(e, { onDragStart: beginDrag })}
          onDoubleClick={() => toggleMaximize(win.id)}
          style={{ touchAction: "none" }}
          className="absolute inset-x-0 top-0 z-20 h-4 cursor-grab"
        />
      )}

      {/* Floating chrome pill */}
      <WindowChrome win={win} focused={focused} gesturing={gesturing} beginDrag={beginDrag} />

      {/* Gesture shield — stops the iframe/lynx-view eating the pointer stream. */}
      {gesturing && <div className="absolute inset-0 z-30" style={{ cursor: "inherit" }} />}

      {/* Resize edges — hidden while maximized. */}
      {!maximized &&
        HANDLES.map((h) => (
          <div
            key={h.dir}
            onPointerDown={(e) => beginResize(h.dir, e)}
            style={{ touchAction: "none" }}
            className={cn("absolute z-30", h.className)}
          />
        ))}
    </motion.div>
  );
}
