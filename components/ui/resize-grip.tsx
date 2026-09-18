"use client";

import { cn } from "@/lib/utils";
import type { KeyboardEvent, PointerEvent } from "react";

// =============================================================================
// ResizeGrip — the corner a widget is resized by.
//
// Android puts drag handles on a widget's edges once it is held; iOS 17 puts
// a single rounded corner at the bottom-right in jiggle mode. This is the
// corner: a stroke that rides just outside the card's own rounded corner, so
// it reads as "this corner is grabbable" rather than as a control laid on
// top of the widget. It exists only in edit mode — there is no resize outside
// it, which is the whole arbitration with pickup: a press on the card body is
// a pickup, a press on the corner is a resize, and the corner is never there
// to be pressed by accident.
//
// The grip swallows its own press (`stopPropagation` on every activator the
// sortable listens to) so dnd-kit never sees it, and sets `touch-action:
// none` so a finger dragging it never scrolls the page. Pointer capture on
// the grip keeps the move / up events flowing however far the drag goes.
// =============================================================================

export type ResizeAxes = "both" | "x" | "y";

const CURSOR: Record<ResizeAxes, string> = {
  both: "nwse-resize",
  x: "ew-resize",
  y: "ns-resize",
};

export function ResizeGrip({
  axes,
  label,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  className,
}: {
  axes: ResizeAxes;
  label: string;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-resize-grip
      onPointerDown={(e) => {
        // Primary button / first finger only; a right-click is the context
        // menu the wrapper already suppresses.
        if (e.button !== 0) return;
        e.stopPropagation();
        onPointerDown(e);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // dnd-kit's activators are separate synthetic listeners on the item
      // wrapper; keep the press from ever reaching them.
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
      className={cn(
        "system-chrome absolute -bottom-3 -right-3 z-20 flex h-11 w-11 items-end justify-end",
        "outline-none focus-visible:[&>svg]:stroke-foreground",
        className,
      )}
      style={{ cursor: CURSOR[axes], touchAction: "none" }}
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
    </div>
  );
}
