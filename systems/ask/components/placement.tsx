"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand, type AskPlacement } from "@/systems/command";
import { ASK_SIDE_MIN_WIDTH } from "@/systems/command/ask-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppWindow, Minus, MoreHorizontal, PanelRight, PanelTop, type LucideIcon } from "lucide-react";
import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useAskConfig } from "../lib/config";
import { askStrings } from "../strings";

// =============================================================================
// Where Ask sits, and how it gets somewhere else.
//
// Ask is one conversation in one of three places (the command provider's
// `AskPlacement`): the center (the palette, widened), the side (a panel
// beside the page), the top (the Dock's panel). Where it opens follows the
// moment (the provider's `askOpenTarget`). Moving it by hand is a drag:
//
//   - the header is a handle (useAskDragHandle). The side panel and the
//     dock panel follow the pointer, the way the center window does. Let go
//     over the middle and Ask is the center chat; let go up in the top band
//     and it is the dock; let go in the trailing column and it is the side.
//     A drag does not stick: the next open follows the moment again.
//   - the place buttons (AskPlacementControls) are off on the desk's preset.
//     Minimize, which puts Ask away into the Dock as a pill, stays.
//
// The center window is the palette's own drag; only leaving the middle
// changes its place. Whether each is there is a setting (../lib/config.ts:
// `placeButtons`, `drag`, `minimize`). The desk's preset drags and minimizes,
// with no place buttons. A phone's has none of them, because there Ask is a
// bottom drawer and nothing else. Wherever they are on, the side is left out
// on a screen with no room beside the page. Touch starts after a deliberate
// long press, so ordinary scrolling and Dock swipes remain ordinary gestures.
// =============================================================================

const PLACES: { placement: AskPlacement; icon: LucideIcon }[] = [
  { placement: "center", icon: AppWindow },
  { placement: "side", icon: PanelRight },
  { placement: "top", icon: PanelTop },
];

const BUTTON =
  "pressable flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground";

function subscribeSideCapacity(notify: () => void) {
  window.addEventListener("resize", notify);
  return () => window.removeEventListener("resize", notify);
}

function sideCapacitySnapshot() {
  return window.innerWidth >= ASK_SIDE_MIN_WIDTH;
}

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
  const menu = !config.placeButtons && config.drag;
  const sideAvailable = useSyncExternalStore(
    subscribeSideCapacity,
    sideCapacitySnapshot,
    () => false,
  );
  if (!config.placeButtons && !menu && !minimizes) return null;
  return (
    <div
      role="group"
      aria-label={config.placeButtons ? s.placement : undefined}
      className={cn("flex items-center gap-0.5", className)}
    >
      {config.placeButtons && PLACES.map(({ placement, icon: Icon }) => (
        <button
          key={placement}
          type="button"
          onClick={() => placement !== current && moveAsk(placement, "direct", true)}
          aria-pressed={placement === current}
          aria-label={s.placements[placement]}
          title={s.placements[placement]}
          // Side is meaningful only where the page and panel both fit.
          disabled={placement === "side" && !sideAvailable}
          className={cn(BUTTON, placement === "side" && "max-sm:hidden disabled:opacity-40")}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
      {menu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={s.placement}
                title={s.placement}
                className={BUTTON}
              />
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-auto min-w-40 bg-glass-popover backdrop-blur-xl"
          >
            <DropdownMenuRadioGroup
              value={current}
              onValueChange={(value) => {
                if (value !== current && PLACES.some((place) => place.placement === value)) {
                  moveAsk(value as AskPlacement, "direct", true);
                }
              }}
            >
              {PLACES.map(({ placement, icon: Icon }) => (
                <DropdownMenuRadioItem
                  key={placement}
                  value={placement}
                  disabled={placement === "side" && !sideAvailable}
                >
                  <Icon className="size-4" />
                  {s.placements[placement]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
  /** Where the press started, so a carried panel follows by the same delta. */
  originX: number;
  originY: number;
  /**
   * The center's drag: the window itself moves (the palette's own drag).
   * Letting go in the middle leaves it where it is; the top band and the
   * trailing column are the other places.
   */
  free?: boolean;
  touch?: boolean;
  /** Sticky target: entering a place takes more intent than staying in it. */
  target: AskPlacement;
}

let drag: DragState | null = null;
const listeners = new Set<() => void>();

function setDrag(next: DragState | null) {
  drag = next;
  const root = document.documentElement;
  // The center window fades only once letting go would put it somewhere
  // else (globals.css). A carried panel does not: it is what follows the
  // pointer, offset by the press (`--ask-drag-x/y`).
  const fading = next !== null && !!next.free && next.target !== next.from;
  root.toggleAttribute("data-ask-dragging", fading);
  if (next && (!next.free || next.touch)) {
    root.dataset.askDragFrom = next.from;
    root.style.setProperty("--ask-drag-x", `${next.x - next.originX}px`);
    root.style.setProperty("--ask-drag-y", `${next.y - next.originY}px`);
  } else {
    delete root.dataset.askDragFrom;
    root.style.removeProperty("--ask-drag-x");
    root.style.removeProperty("--ask-drag-y");
  }
  root.toggleAttribute("data-ask-drag-touch", !!next?.touch);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A narrower edge admits the side than the panel eventually occupies. Once
 * admitted, the full panel-width lane keeps it there. This hysteresis stops a
 * diagonal Top → Center drag becoming Side only because its pointer brushed
 * the trailing edge. */
const SIDE_ENTER_PX = 184;
const DOCK_ENTER_PX = 76;
const DOCK_LEAVE_PX = 144;

/** The place a pointer at (x, y) would put Ask. The trailing column is the
 *  side, wherever it is vertically (its header sits in the top band, and
 *  dragging it sideways is a drag toward the center, not up into the dock).
 *  The top band everywhere else is the dock. The rest is the center. */
function placementAt(
  x: number,
  y: number,
  from: AskPlacement,
  current: AskPlacement = from,
): AskPlacement {
  const panel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--surface-panel-w")) || 440;
  const sideAvailable = window.innerWidth >= ASK_SIDE_MIN_WIDTH;
  if (
    sideAvailable &&
    (x > window.innerWidth - SIDE_ENTER_PX ||
      (current === "side" && x > window.innerWidth - panel - 32))
  ) return "side";
  if (y < (current === "top" ? DOCK_LEAVE_PX : DOCK_ENTER_PX)) return "top";
  return "center";
}

/** Past this, a press on the handle is a drag, not a click. */
const DRAG_THRESHOLD = 6;
const LONG_PRESS_MS = 360;

const CONTROL = "button, a, input, textarea, select, [role='combobox']";

/**
 * Props for the element that is a surface's handle (its header). A press on
 * a control inside it (a button, a field, a picker) is left alone.
 *
 * The center is a window: its header drags the window itself, anywhere
 * (`data-drag-handle`, which the palette's own drag starts from). Letting
 * go in the middle leaves the window where it was put. The side panel and
 * the dock follow the pointer by the same delta. Letting go in the middle
 * makes Ask the center chat; further up, in the top band, the dock; in the
 * trailing column, the side. The place it would land is drawn while the
 * pointer is over a different one.
 */
export function useAskDragHandle(from: AskPlacement) {
  const { moveAsk } = useCommand();
  const { drag: enabled } = useAskConfig();
  const free = from === "center";
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return;
      if ((e.target as HTMLElement).closest(CONTROL)) {
        // A control is pressed, not the window: the card's drag must not
        // start from it either.
        if (free) e.stopPropagation();
        return;
      }
      const touch = e.pointerType === "touch";
      // The center lets the press through to the card's drag; elsewhere a
      // mouse press on the handle is ours, not the start of a drawer's swipe
      // (the Dock's panel, which a finger still swipes away).
      if (!free || touch) e.stopPropagation();
      if (touch) e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let target: AskPlacement = from;
      let longPress: number | null = null;
      const start = () => {
        dragging = true;
        target = placementAt(startX, startY, from, target);
        if (touch) navigator.vibrate?.(8);
        setDrag({ from, x: startX, y: startY, originX: startX, originY: startY, free, touch, target });
      };
      if (touch) longPress = window.setTimeout(start, LONG_PRESS_MS);
      const onMove = (ev: PointerEvent) => {
        const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (!dragging) {
          if (touch) {
            // Moving before the hold cancels placement. A slight finger
            // wobble is tolerated so the long press remains attainable.
            if (distance < DRAG_THRESHOLD * 2) return;
            if (longPress !== null) window.clearTimeout(longPress);
            longPress = null;
            cleanup();
            return;
          }
          if (distance < DRAG_THRESHOLD) return;
          start();
        }
        ev.preventDefault();
        target = placementAt(ev.clientX, ev.clientY, from, target);
        setDrag({ from, x: ev.clientX, y: ev.clientY, originX: startX, originY: startY, free, touch, target });
      };
      const finish = (ev: PointerEvent, drop: boolean) => {
        if (longPress !== null) window.clearTimeout(longPress);
        longPress = null;
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onCancel, true);
        const landed = dragging && drop ? placementAt(ev.clientX, ev.clientY, from, target) : null;
        const moving = landed !== null && landed !== from;
        // The carried panel would snap home for a frame before the new
        // place mounts. Hide the one being left; the attribute names it, so
        // the place it lands in is not hidden with it.
        if (moving) {
          const root = document.documentElement;
          root.dataset.askDragCommit = from;
          window.setTimeout(() => {
            if (root.dataset.askDragCommit === from) delete root.dataset.askDragCommit;
          }, 500);
        }
        setDrag(null);
        if (moving && landed) moveAsk(landed, "direct", false);
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onCancel, true);
      };
      const onUp = (ev: PointerEvent) => finish(ev, true);
      const onCancel = (ev: PointerEvent) => finish(ev, false);
      // Capture before the underlying Drawer/Card drag sees the event. Both
      // libraries may stop propagation after taking a pointer, but placement
      // still needs its coordinates to decide where Ask lands.
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onCancel, true);
    },
    /** On the handle element: the palette's drag starts from it (center). */
    dataAttrs: enabled
      ? {
          "data-ask-placement-handle": "",
          ...(free ? { "data-drag-handle": "" } : {}),
        }
      : {},
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
 * The drag's overlay: the place letting go would land, and only when it is
 * a different one. The surface itself is what moves (the center window, or
 * the side and dock panels, translated). Mounted once (../surfaces.tsx);
 * draws nothing until a drag is over another place.
 */
export function AskDragOverlay() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  // Client-only (loaded with `ssr: false`), so the portal has its body.
  const state = useSyncExternalStore(subscribe, () => drag, () => null);
  if (!state) return null;

  const target = state.target;
  if (target === state.from) return null;
  const Icon = PLACES.find((p) => p.placement === target)!.icon;

  return createPortal(
    <div className="system-chrome pointer-events-none fixed inset-0 z-[10070]">
      <div
        className={cn(
          "absolute flex items-center justify-center rounded-2xl border-2 border-dashed",
          "border-foreground/40 bg-glass-popover shadow-overlay backdrop-blur-xl",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          TARGET_BOX[target],
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
