"use client";

import { cn } from "@/lib/utils";
import { Drawer } from "vaul";
import { useLivePage } from "./live-page";
import { SURFACE_EASING, useSurfaceStack } from "./stack";

// =============================================================================
// SurfaceSheet — the bottom sheet every phone surface is made of.
//
// The one vaul drawer on the site. <AdaptiveSurface> composes it for the
// wallpaper picker and the playlist (adding its title bar and scroll area);
// the command palette composes it directly, because a palette's header is its
// search field, not a title. Both get the same glass shell, the same grabber,
// the same edge gaps, and the same stacking behaviour — so a sheet is a sheet
// whatever it holds.
//
// Two things a phone sheet does that the other shapes never need:
//
//   Snap points.  `snapPoints={[0.7, 1]}` opens the sheet at seven tenths of
//   the screen and lets a drag carry it to the top — the iOS medium / large
//   detents. vaul moves the whole drawer by translating it, which would push
//   the sheet's bottom edge off screen at the lower detent; the shell inside
//   lifts by the same amount (`--snap-point-height`, which vaul maintains) so
//   the sheet floats above the bottom edge at every detent, the way it does
//   without snap points.
//
//   Stacking.  A sheet opened over another one sends the one underneath back a
//   step — smaller, dimmer, a little higher, inert — and brings it forward
//   again when the top one goes. That is what iOS does when a sheet presents a
//   sheet, and it is decided by the shared stack (stack.ts), not by the sheet.
//
// `modal` is off by default (see AdaptiveSurface for why: these surfaces are
// about the page behind them, which stays live). A launcher like the command
// palette turns it on: a transparent scrim takes the page away and a tap on it
// dismisses, the same click-away its desktop popover has. The scrim is ours,
// not vaul's: a modal Radix dialog locks scroll by forcing `position:
// relative` on <body>, which collapses the bezel's container-scroll layout
// (@hux/bezel keeps <body> fixed at inset 0 on an iPhone). So the drawer is
// always non-modal to Radix, and the scrim alone decides what the page gets.
// =============================================================================

/** Ring of padding between a floating surface and the screen edges. */
export const EDGE_GAP = "0.75rem";

/** Room a full-height sheet leaves above itself: the status bar, or the gap. */
const TOP_INSET = `max(env(safe-area-inset-top), ${EDGE_GAP})`;

/** The glass shell every shape shares. */
export const SHELL = [
  "flex flex-col overflow-hidden outline-none",
  "rounded-3xl bg-glass-sheet backdrop-blur-xl",
  "border border-border/50 shadow-overlay",
].join(" ");

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
  useLivePage(open);
  const hasSnapPoints = !!snapPoints && snapPoints.length > 0;

  const contentStyle: React.CSSProperties & { "--initial-transform": string } = {
    // vaul's enter/exit transform must clear the edge gap too, otherwise the
    // sheet "pops" for the last few pixels.
    "--initial-transform": `calc(100% + ${EDGE_GAP})`,
    ...(hasSnapPoints
      ? {
          // Flush with the bottom and as tall as the top detent; the shell
          // inside carries the gap. vaul moves `bottom` and `height` itself
          // while the keyboard is up, and can only do that against a box
          // that owns them.
          bottom: 0,
          height: `calc(100dvh - ${TOP_INSET})`,
        }
      : {
          bottom: `max(env(safe-area-inset-bottom), ${EDGE_GAP})`,
          height: height ?? "80dvh",
        }),
  };

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      // Always non-modal to Radix (see above); `modal` is the scrim below.
      modal={false}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={onActiveSnapPointChange}
    >
      <Drawer.Portal>
        {modal && (
          // Invisible: the page stays in view, it just stops answering, and a
          // press on it dismisses. touch-action keeps a drag on the scrim from
          // scrolling the page. A sheet opened over this one lands above it
          // (later in the DOM, one z step up) and stays reachable.
          <div
            aria-hidden
            className="fixed inset-0 z-[60] bg-transparent"
            style={{ touchAction: "none" }}
            onPointerDown={() => onOpenChange(false)}
          />
        )}
        <Drawer.Content
          aria-describedby={undefined}
          // Radix still dismisses a non-modal dialog on an outside press. With
          // the page interactive that would close the surface on every touch;
          // with the scrim, the scrim decides.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          style={contentStyle}
          // The positioning box only. It is transparent so vaul's own
          // background extension below the drawer paints nothing.
          className="fixed inset-x-3 z-[61] bg-transparent outline-none"
        >
          {label && <Drawer.Title className="sr-only">{label}</Drawer.Title>}
          <div
            data-surface-shell
            data-behind={behind ? "" : undefined}
            // React 19 renders `inert` as the boolean attribute.
            inert={behind}
            style={
              {
                bottom: hasSnapPoints
                  ? `calc(var(--snap-point-height, 0px) + max(env(safe-area-inset-bottom), ${EDGE_GAP}))`
                  : 0,
                // Back a step: iOS's receded presenter.
                transform: behind ? "translate3d(0, -8px, 0) scale(0.95)" : "none",
                // The lift and the step back both ride vaul's curve, so a snap
                // and a recede read as one motion with the drawer's own.
                transition: `bottom 0.5s ${SURFACE_EASING}, transform 0.5s ${SURFACE_EASING}`,
              } as React.CSSProperties
            }
            className={cn(
              SHELL,
              "absolute inset-x-0 top-0 origin-top",
              // The dim on a receded sheet is a wash over the shell rather
              // than an opacity, so the glass stays glass.
              "after:pointer-events-none after:absolute after:inset-0 after:bg-black/0 after:transition-colors after:duration-500",
              behind && "after:bg-black/15 dark:after:bg-black/30",
              className
            )}
          >
            {/* Grabber — the affordance for drag-to-dismiss and for the detents */}
            <div className="flex shrink-0 justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
            </div>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
