"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand, type AskPlacement } from "@/systems/command";
import { AppWindow, Minus, PanelRight, PanelTop, type LucideIcon } from "lucide-react";
import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useAskConfig } from "../lib/config";
import { askStrings } from "../strings";

// =============================================================================
// Where Ask sits, and how it gets somewhere else.
//
// Ask is one conversation in one of three places (the command provider's
// `AskPlacement`): the center (the palette, widened), the side (a panel
// beside the page), the top (the Dock's panel). Every surface's header
// carries the same two ways to move it:
//
//   - the placement buttons (AskPlacementControls), and minimize, which puts
//     it away into the Dock as a pill;
//   - its header as a handle (useAskDragHandle): drag it, and the three
//     places light up where they would put it; let go over one and Ask moves
//     there. A drag shows a stand-in, not the surface itself: each surface is
//     a different kind of thing (a cmdk card, a drawer, the Dock's own
//     drawer, which has its own swipe), and what moves is the conversation.
//
// The center is a window and drags freely; only its edges are places (see
// useAskDragHandle). Whether each is there is a setting (../lib/config.ts:
// `placeButtons`, `drag`, `minimize`). The desk's preset has them all; a phone's has none of
// them, because there Ask is a bottom drawer and nothing else. Wherever they
// are on, the side is left out on a screen with no room beside the page, and
// dragging takes a mouse.
// =============================================================================

const PLACES: { placement: AskPlacement; icon: LucideIcon }[] = [
  { placement: "center", icon: AppWindow },
  { placement: "side", icon: PanelRight },
  { placement: "top", icon: PanelTop },
];

const BUTTON =
  "pressable flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground";

/** The placement buttons and minimize, for a surface's header. */
export function AskPlacementControls({
  current,
  minimize = true,
  className,
}: {
  current: AskPlacement;
  /** Show minimize (off where the surface has its own, the Dock's chevron). */
  minimize?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { moveAsk, minimizeAsk } = useCommand();
  const config = useAskConfig();
  const minimizes = minimize && config.minimize === "dock";
  if (!config.placeButtons && !minimizes) return null;
  return (
    <div role="group" aria-label={s.placement} className={cn("flex items-center gap-0.5", className)}>
      {config.placeButtons && PLACES.map(({ placement, icon: Icon }) => (
        <button
          key={placement}
          type="button"
          onClick={() => placement !== current && moveAsk(placement, "direct", true)}
          aria-pressed={placement === current}
          aria-label={s.placements[placement]}
          title={s.placements[placement]}
          // No room beside the page on a phone: no side.
          className={cn(BUTTON, placement === "side" && "max-sm:hidden")}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
      {minimizes && (
        <button type="button" onClick={minimizeAsk} aria-label={s.minimize} title={s.minimize} className={BUTTON}>
          <Minus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ---- Dragging between places --------------------------------------------------

interface DragState {
  from: AskPlacement;
  x: number;
  y: number;
  /**
   * The center's drag: the window itself moves (the palette's own drag), and
   * only an edge is a place. Off the edges nothing is drawn, and letting go
   * leaves the window where it is.
   */
  free?: boolean;
}

let drag: DragState | null = null;
const listeners = new Set<() => void>();

function setDrag(next: DragState | null) {
  drag = next;
  // The surface being carried fades while its stand-in moves (globals.css,
  // "Ask: a drag between places"); a window dragged freely fades only over
  // an edge, where letting go would put it somewhere else.
  const fading = next !== null && (!next.free || edgeAt(next.x, next.y) !== null);
  document.documentElement.toggleAttribute("data-ask-dragging", fading);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The place a pointer at (x, y) would put Ask: the top band, the side
 *  panel's own box (as drawn, TARGET_BOX), or the middle. */
function placementAt(x: number, y: number): AskPlacement {
  if (y < window.innerHeight * 0.18) return "top";
  const panel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--surface-panel-w")) || 440;
  if (x > window.innerWidth - panel - 12) return "side";
  return "center";
}

/** Within this of the trailing edge, a dragged window is going to the side. */
const EDGE_SIDE_PX = 96;
/** Within this of the top, to the Dock. */
const EDGE_TOP_PX = 64;

/** The place an edge would put a freely dragged window, or none. */
function edgeAt(x: number, y: number): AskPlacement | null {
  if (y < EDGE_TOP_PX) return "top";
  if (x > window.innerWidth - EDGE_SIDE_PX) return "side";
  return null;
}

/** Past this, a press on the handle is a drag, not a click. */
const DRAG_THRESHOLD = 6;

const CONTROL = "button, a, input, textarea, select, [role='combobox']";

/**
 * Props for the element that is a surface's handle (its header). A press on
 * a control inside it (a button, a field, a picker) is left alone.
 *
 * The center is a window: its header drags the window itself, anywhere
 * (`data-drag-handle`, which the palette's own drag starts from), and only
 * the edges are places: the trailing edge for the side, the top for the
 * Dock. They light up as the pointer reaches them, and letting go there
 * moves Ask; anywhere else the window stays where it was put. The side
 * panel and the Dock's panel are fixed in place, so their header carries a
 * stand-in instead, with the three places drawn to aim at.
 */
export function useAskDragHandle(from: AskPlacement) {
  const { moveAsk } = useCommand();
  const { drag: enabled } = useAskConfig();
  const free = from === "center";
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0 || e.pointerType === "touch") return;
      if ((e.target as HTMLElement).closest(CONTROL)) {
        // A control is pressed, not the window: the card's drag must not
        // start from it either.
        if (free) e.stopPropagation();
        return;
      }
      // The center lets the press through to the card's drag; elsewhere a
      // mouse press on the handle is ours, not the start of a drawer's swipe
      // (the Dock's panel, which a finger still swipes away).
      if (!free) e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      const onMove = (ev: PointerEvent) => {
        if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        if (!free) ev.preventDefault();
        setDrag({ from, x: ev.clientX, y: ev.clientY, free });
      };
      const finish = (ev: PointerEvent, drop: boolean) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        setDrag(null);
        if (!dragging || !drop) return;
        const target = free ? edgeAt(ev.clientX, ev.clientY) : placementAt(ev.clientX, ev.clientY);
        if (target && target !== from) moveAsk(target, "direct", true);
      };
      const onUp = (ev: PointerEvent) => finish(ev, true);
      const onCancel = (ev: PointerEvent) => finish(ev, false);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    /** On the handle element: the palette's drag starts from it (center). */
    dataAttrs: free && enabled ? { "data-drag-handle": "" } : {},
    // A handle, to the eye and to the hand.
    className: cn(enabled && "sm:cursor-grab sm:active:cursor-grabbing", "select-none"),
  };
}

// The three places, drawn where they would stand. Rough boxes of the real
// surfaces: enough to aim at, not a preview of their contents.
const TARGET_BOX: Record<AskPlacement, string> = {
  center: "left-1/2 top-[min(12vh,7rem)] h-[min(44rem,70vh)] w-[min(960px,calc(100vw-2rem))] -translate-x-1/2",
  side: "right-3 top-3 bottom-3 w-[var(--surface-panel-w,440px)]",
  top: "left-1/2 top-2 h-[min(36rem,60vh)] w-[min(440px,92vw)] -translate-x-1/2",
};

/**
 * The drag's overlay: the three places, the one under the pointer lit, and
 * a stand-in following the pointer. Mounted once (../surfaces.tsx); draws
 * nothing until a drag starts.
 */
export function AskDragOverlay() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  // Client-only (loaded with `ssr: false`), so the portal has its body.
  const state = useSyncExternalStore(subscribe, () => drag, () => null);
  if (!state) return null;

  // A window dragged freely: nothing until an edge, then that place alone.
  if (state.free) {
    const edge = edgeAt(state.x, state.y);
    if (!edge) return null;
    const Icon = PLACES.find((p) => p.placement === edge)!.icon;
    return createPortal(
      <div className="system-chrome pointer-events-none fixed inset-0 z-[10070]">
        <div
          className={cn(
            "absolute flex items-center justify-center rounded-2xl border-2 border-dashed",
            "border-foreground/40 bg-glass-popover shadow-overlay backdrop-blur-xl",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            TARGET_BOX[edge],
          )}
        >
          <span className="flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-sm text-foreground">
            <Icon className="h-4 w-4" />
            {s.dragHint}
          </span>
        </div>
      </div>,
      document.body,
    );
  }

  const target = placementAt(state.x, state.y);

  return createPortal(
    <div className="system-chrome pointer-events-none fixed inset-0 z-[10070] cursor-grabbing">
      {PLACES.map(({ placement, icon: Icon }) => {
        const lit = placement === target;
        return (
          <div
            key={placement}
            className={cn(
              "absolute flex items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200",
              TARGET_BOX[placement],
              lit
                ? "border-foreground/40 bg-glass-popover backdrop-blur-xl shadow-overlay"
                : "border-foreground/15 bg-foreground/[0.03]",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-opacity",
                lit ? "bg-background/70 text-foreground opacity-100" : "text-muted-foreground opacity-70",
              )}
            >
              <Icon className="h-4 w-4" />
              {lit ? s.dragHint : s.placements[placement]}
            </span>
          </div>
        );
      })}
      <div
        className="absolute flex items-center gap-2 rounded-full border border-border/60 bg-glass-popover px-3 py-1.5 text-sm shadow-overlay backdrop-blur-xl"
        style={{ left: state.x + 12, top: state.y + 12 }}
      >
        {s.ask} · {s.placements[target]}
      </div>
    </div>,
    document.body,
  );
}
