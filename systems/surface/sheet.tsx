"use client";

import { cn } from "@/lib/utils";
import { Drawer } from "@base-ui/react/drawer";
import { BEZEL_LAYER_ATTRIBUTE } from "@hux/bezel";
import { SURFACE_EASING, SURFACE_TRANSITION_MS, useSurfaceStack } from "./stack";

// =============================================================================
// SurfaceSheet — the bottom sheet every phone surface is made of.
//
// One Base UI Drawer. <AdaptiveSurface> composes it for the wallpaper picker
// and the playlist (adding its title bar and scroll area); the command palette
// composes it directly, because a palette's header is its search field, not a
// title. Both get the same glass shell, the same grabber, the same edge gaps,
// and the same stacking behaviour — so a sheet is a sheet whatever it holds.
//
// Two boxes, not one. `Drawer.Popup` is a transparent positioning box the full
// height of the sheet's travel; the glass shell is the flex child inside it.
// The split is what lets a *floating* sheet have detents: Base UI moves the
// popup by translating it, so at a lower detent the popup's bottom — and the
// shell's rounded corners with it — would sit below the screen. The popup
// carries the same offset as bottom padding, so the shell it holds stays
// planted a gap above the bottom edge at every detent, and grows and shrinks
// from the top as a floating sheet should. Past the lowest detent the padding
// stops (`--surface-detent-floor`) and the sheet slides away whole, because
// that drag is a dismissal, not a resize. The motion is in globals.css, under
// "Secondary surface motion"; everything it reads comes from Base UI on the
// popup, so nothing here has to measure anything.
//
// Two things a phone sheet does that the other shapes never need:
//
//   Snap points.  `snapPoints={[0.7, 1]}` opens the sheet at seven tenths of
//   the screen and lets a drag carry it to the top — the iOS medium / large
//   detents.
//
//   Stacking.  A sheet opened over another one sends the one underneath back a
//   step — smaller, dimmer, a little higher, inert — and brings it forward
//   again when the top one goes. That is what iOS does when a sheet presents a
//   sheet, and it is decided by the shared stack (stack.ts), not by the sheet.
//   Base UI has its own nested-drawer stacking, but it only sees drawers that
//   are React children of another drawer; ours mount in sibling subtrees of the
//   root layout, so the store stays.
//
// `modal` is off by default (see AdaptiveSurface for why: these surfaces are
// about the page behind them, which stays live). A launcher like the command
// palette turns it on, and then the viewport — a transparent, full-screen box
// that already contains the popup — takes the page away and dismisses on a
// press, the same click-away its desktop popover has. Base UI's scroll lock is
// safe here in a way Radix's was not: on iOS it only sets `overflow: hidden` on
// whichever element scrolls the viewport, and it stands down entirely when that
// element is already locked — which is exactly the state @hux/bezel leaves the
// page in during container scroll.
// =============================================================================

/** Ring of padding between a floating surface and the screen edges. */
export const EDGE_GAP = "0.75rem";

/** Room a full-height sheet leaves above itself: the status bar, or the gap. */
const TOP_INSET = `max(env(safe-area-inset-top), ${EDGE_GAP})`;

/** Room below a sheet without detents: the home indicator, or the gap. */
const BOTTOM_INSET = `max(env(safe-area-inset-bottom), ${EDGE_GAP})`;

/** A detent as a CSS length: a fraction of the viewport, pixels, or as given. */
function detentLength(point: number | string): string {
  if (typeof point === "string") return point;
  return point <= 1 ? `${point * 100}dvh` : `${point}px`;
}

/** The glass shell every shape shares. */
export const SHELL = [
  "flex flex-col overflow-hidden outline-none",
  "rounded-3xl bg-glass-sheet backdrop-blur-xl",
  "border border-border/50 shadow-overlay",
].join(" ");

/**
 * What the CSS in globals.css needs from here: the site's surface curve, and
 * how far past the edge a surface has to travel to be gone. Set on the popup so
 * the timing lives in one place (stack.ts) for the CSS and the hand-off alike.
 */
export const surfaceMotionVars = (exitClearance: string) =>
  ({
    "--surface-gap": EDGE_GAP,
    "--surface-exit": exitClearance,
    "--surface-duration": `${SURFACE_TRANSITION_MS}ms`,
    "--surface-easing": SURFACE_EASING,
  }) as React.CSSProperties;

export interface SurfaceSheetProps {
  /** Stable id — the sheet's key in the surface stack. */
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Take the page away: a transparent scrim blocks it, and a tap on the scrim
   * dismisses. Off by default — secondary surfaces leave the page live.
   */
  modal?: boolean;
  /**
   * Detents as fractions of the viewport, lowest first; the sheet opens at the
   * first. Omit for a fixed-height sheet.
   */
  snapPoints?: number[];
  /** Controlled active detent, for a sheet that wants to move itself. */
  activeSnapPoint?: number | string | null;
  onActiveSnapPointChange?: (snapPoint: number | string | null) => void;
  /** Height without snap points. Default 80dvh. */
  height?: string;
  /**
   * Accessible name for the dialog, rendered visually hidden. Omit when the
   * content renders a visible `Drawer.Title` of its own.
   */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export function SurfaceSheet({
  id,
  open,
  onOpenChange,
  modal = false,
  snapPoints,
  activeSnapPoint,
  onActiveSnapPointChange,
  height,
  label,
  className,
  children,
}: SurfaceSheetProps) {
  const { behind } = useSurfaceStack(id, open);
  const hasSnapPoints = !!snapPoints && snapPoints.length > 0;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="down"
      modal={modal}
      // A non-modal surface leaves the page live, and a press on a live page
      // belongs to the page: the close button, Escape and a drag dismiss.
      disablePointerDismissal={!modal}
      snapPoints={snapPoints}
      snapPoint={activeSnapPoint}
      onSnapPointChange={onActiveSnapPointChange}
    >
      {/* iOS's keyboard, handled once for every sheet: the provider publishes
          `--drawer-keyboard-inset`, and the shell rests on top of the keyboard
          rather than behind it. A sheet with no fields never notices. */}
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Viewport
            // Base UI portals into a wrapper of its own, so this is not a
            // `body > .fixed` the bezel would catch by itself. Marked as a
            // fixed layer: in container scroll it becomes absolute inside the
            // fixed <body> (the identical box), and never spans the edge Safari
            // samples its chrome colour from.
            {...{ [BEZEL_LAYER_ATTRIBUTE]: "" }}
            className={cn(
              "fixed inset-0 z-[60]",
              // Modal: this box is the scrim. It is invisible — the page stays
              // in view, it just stops answering — and a press on it dismisses,
              // because Base UI reads a press on the popup's own container as
              // an outside press. Non-modal: it must not be a wall over the
              // page, so only the popup inside it takes pointers.
              !modal && "pointer-events-none"
            )}
          >
            <Drawer.Popup
              data-surface-popup=""
              data-surface-snap={hasSnapPoints ? "" : undefined}
              style={{
                ...surfaceMotionVars(hasSnapPoints ? EDGE_GAP : BOTTOM_INSET),
                ...(hasSnapPoints
                  ? {
                      // Flush with the bottom and as tall as the top detent.
                      // The gap below the shell is the popup's bottom padding,
                      // which also carries the snap offset (see above).
                      bottom: 0,
                      height: `calc(100dvh - ${TOP_INSET})`,
                      // How far the shell may be held back before a drag stops
                      // resizing it and starts throwing it away: the offset of
                      // the lowest detent.
                      "--surface-detent-floor": `calc(100dvh - ${TOP_INSET} - ${detentLength(
                        snapPoints[0]
                      )})`,
                    }
                  : { bottom: BOTTOM_INSET, height: height ?? "80dvh" }),
              }}
              // The positioning box only, so nothing paints outside the shell.
              className="pointer-events-auto absolute inset-x-3 z-[61] flex flex-col bg-transparent outline-none"
            >
              {label && <Drawer.Title className="sr-only">{label}</Drawer.Title>}
              <div
                data-surface-shell
                data-behind={behind ? "" : undefined}
                // React 19 renders `inert` as the boolean attribute.
                inert={behind}
                className={cn(
                  SHELL,
                  "min-h-0 flex-1 origin-top",
                  // The dim on a receded sheet is a wash over the shell rather
                  // than an opacity, so the glass stays glass.
                  "after:pointer-events-none after:absolute after:inset-0 after:bg-black/0 after:transition-colors after:duration-500",
                  behind && "after:bg-black/15 dark:after:bg-black/30",
                  className
                )}
              >
                {/* Grabber — the affordance for drag-to-dismiss and the detents */}
                <div className="flex shrink-0 justify-center pt-2">
                  <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
                </div>
                {/* Everything below the grabber is content, not a handle: a
                    mouse press inside it is a press on a row, never the start
                    of a drag. Without this, the drawer takes the pointer on
                    press and the click never reaches what was pressed. A touch
                    drag still works anywhere — Base UI reads the scroll
                    containers for that. Transparent to layout so the content
                    keeps the shell's flex column. */}
                <Drawer.Content className="flex min-h-0 flex-1 flex-col">
                  {children}
                </Drawer.Content>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
