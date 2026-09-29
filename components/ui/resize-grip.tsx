"use client";

import { cn } from "@/lib/utils";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

// =============================================================================
// Resize affordances — how a widget is resized, per skin.
//
//   Glass     `ResizeGrip`: the corner. iOS 17 puts a single rounded corner
//             at a widget's bottom-right in jiggle mode; this is that
//             corner — a stroke riding just outside the card's own rounded
//             corner, on every resizable widget while editing.
//   Material  `ResizeFrame`: Android's resize frame. On a Pixel, a held
//             widget is outlined and grows round handles on the edges it can
//             be dragged along; each handle moves one axis. Only the widget
//             being worked on wears it (the grid's selection), so a whole
//             screen of frames never competes with the wallpaper.
//
// Both exist only in edit mode — there is no resize outside it, which is the
// whole arbitration with pickup: a press on the card body is a pickup, a
// press on a grip or a handle is a resize, and neither is there to be
// pressed by accident. Every handle swallows its own press (stopPropagation
// on every activator the sortable listens to) and sets `touch-action: none`,
// so a finger dragging it never scrolls the page; pointer capture keeps the
// move / up events flowing however far the drag goes.
//
// Which one shows is the stylesheet's call (`material:`), not React's: both
// are in the tree, so a returning visitor in either skin gets the right one
// without a second render.
// =============================================================================

export type ResizeAxes = "both" | "x" | "y";

const CURSOR: Record<ResizeAxes, string> = {
  both: "nwse-resize",
  x: "ew-resize",
  y: "ns-resize",
};

export interface ResizeHandlers {
  /** `lock`: the axis this handle moves (an edge handle moves one). */
  onPointerDown: (e: PointerEvent<HTMLDivElement>, lock: ResizeAxes) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

/** The press plumbing every handle shares; `children` is what it looks like. */
function Handle({
  axes,
  label,
  handlers,
  className,
  children,
}: {
  axes: ResizeAxes;
  label: string;
  handlers: ResizeHandlers;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-resize-grip={axes}
      onPointerDown={(e) => {
        // Primary button / first finger only; a right-click is the context
        // menu the wrapper already suppresses.
        if (e.button !== 0) return;
        e.stopPropagation();
        handlers.onPointerDown(e, axes);
      }}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerUp}
      // dnd-kit's activators are separate synthetic listeners on the item
      // wrapper; keep the press from ever reaching them.
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handlers.onKeyDown}
      className={cn("system-chrome absolute z-20 outline-none", className)}
      style={{ cursor: CURSOR[axes], touchAction: "none" }}
    >
      {children}
    </div>
  );
}

/** Glass: the iOS corner. Hidden in the Material skin. */
export function ResizeGrip({
  axes,
  label,
  handlers,
}: {
  axes: ResizeAxes;
  label: string;
  handlers: ResizeHandlers;
}) {
  return (
    <Handle
      axes={axes}
      label={label}
      handlers={handlers}
      className="-bottom-3 -right-3 flex h-11 w-11 items-end justify-end focus-visible:[&>svg]:stroke-foreground material:hidden"
    >
      {/* The card corner is `rounded-2xl` (16px); this arc is centred on that
          corner's centre with a radius two pixels larger, so it hugs the
          curve from outside. */}
      <svg
        aria-hidden
        width="28"
        height="28"
        viewBox="0 0 28 28"
        className="mb-[3px] mr-[3px] stroke-foreground/55 transition-[stroke] duration-150 hover:stroke-foreground"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M 10 28 A 18 18 0 0 0 28 10" />
      </svg>
    </Handle>
  );
}

/**
 * Material: Android's resize frame — the card outlined in `primary`, and a
 * round handle on each edge it can be dragged along. The frame sits 6px
 * outside the card with its corner opened by the same 6px, so it stays
 * concentric with the 28px widget corner.
 *
 * Android puts a handle on all four edges; here there are two, right and
 * bottom. A widget's cell is derived from the order (docs/system-widget-
 * grid.md), so a left or top handle could change its size but never move
 * its edge where the finger is — a handle that lies about where the edge
 * will land is worse than no handle.
 */
export function ResizeFrame({
  axes,
  label,
  handlers,
}: {
  axes: ResizeAxes;
  label: string;
  handlers: ResizeHandlers;
}) {
  const x = axes === "both" || axes === "x";
  const y = axes === "both" || axes === "y";
  return (
    <div data-resize-frame="" className="hidden material:contents">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1.5 z-20 rounded-[calc(var(--md-widget-radius)+6px)] border-2 border-(--md-primary)"
      />
      {x && (
        <Handle
          axes="x"
          label={label}
          handlers={handlers}
          className="-right-1.5 top-1/2 flex size-11 -translate-y-1/2 translate-x-1/2 items-center justify-center"
        >
          <FrameDot />
        </Handle>
      )}
      {y && (
        <Handle
          axes="y"
          label={label}
          handlers={handlers}
          className="-bottom-1.5 left-1/2 flex size-11 -translate-x-1/2 translate-y-1/2 items-center justify-center"
        >
          <FrameDot />
        </Handle>
      )}
    </div>
  );
}

function FrameDot() {
  return (
    <span
      aria-hidden
      className={cn(
        "block size-4 rounded-full bg-(--md-primary) ring-[3px] ring-(--md-surface)",
        "transition-transform duration-(--md-spring-fast-spatial-duration) ease-(--md-spring-fast-spatial)",
        "[[data-resize-grip]:hover>&]:scale-125 [[data-resize-grip]:active>&]:scale-125 [[data-resize-grip]:focus-visible>&]:scale-125",
      )}
    />
  );
}
