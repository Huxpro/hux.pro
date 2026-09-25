"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Popover } from "@base-ui/react/popover";
import { SurfaceBody } from "./chrome";
import { useSurfaceMode, type SurfaceMode, type SurfacePresentation } from "./presentation";
import {
  EDGE_GAP,
  SHELL,
  SurfaceSheet,
  SurfaceViewport,
  surfaceMotionVars,
} from "./sheet";
import { SurfaceWindow } from "./window";

// =============================================================================
// AdaptiveSurface — the viewport's opinion about which shape a surface takes.
//
// The policy layer. Underneath it are three shells that know nothing about
// viewports — <SurfaceSheet> (sheet.tsx), <SurfaceWindow> (window.tsx) and the
// panel below — plus the chrome they share (<SurfaceBody>, chrome.tsx). This
// component is the rule that picks one:
//
//   <AdaptiveSurface id="wallpaper" open={…} presentation={ADAPTIVE_PRESENTATION}>
//
// A feature declares intent as a breakpoint map (see presentation.ts) and stops
// thinking about it. The three shapes share one glass shell, one header and one
// close affordance, so they read as the same object arriving from a different
// direction:
//
//   sheet   a Base UI drawer from the bottom, drag-to-dismiss, grabber,
//           stacks the iOS way.
//   panel   the same drawer from the trailing edge, drag-to-dismiss.
//   window  a floating window that morphs in the way an app window does when it
//           opens from its shelf icon, and is draggable by its header.
//   popover a card hanging off the button that opened it, for a surface that
//           belongs to that one control. Needs `anchor`.
//
// Not every surface wants this rule. Where the shape is something the person
// chose rather than something the viewport decided — the devtool, which is
// pulled off the bottom edge into a floating pill by hand — the feature
// composes the shells directly, the way the command palette already does for
// its search-field header. That is what the primitive layer is for.
//
// None of them takes the page away. There is no scrim, the page stays
// interactive, and touching it does not close the surface; its close button,
// Escape and a drag do. Every surface here is about the page behind it: a
// wallpaper picker under a scrim darkens the thing being picked, and a
// playlist stays open while the page goes on. Outside dismissal goes with the
// scrim on purpose: a surface that closes on every touch of a live page cannot
// be used.
//
// A popover is the exception, and for the same reason: it is not about the
// page, it is the extension of one button. That is how every menu on every
// platform behaves, so a press on the page puts it away.
//
// Content can adapt without knowing the rules by reading `useSurfaceContext()`.
// =============================================================================

interface SurfaceContextValue {
  mode: SurfaceMode;
  /** True when the surface floats free (a window) rather than hugging an edge. */
  isWindow: boolean;
  close: () => void;
}

const SurfaceContext = createContext<SurfaceContextValue | null>(null);

/** Lets content adapt to the shape it landed in — column counts, density. */
export function useSurfaceContext(): SurfaceContextValue {
  const ctx = useContext(SurfaceContext);
  if (!ctx) {
    throw new Error("useSurfaceContext must be used within an AdaptiveSurface");
  }
  return ctx;
}

/** Same shape, for a body that can also render inside a native app window. */
export function useOptionalSurfaceContext(): SurfaceContextValue | null {
  return useContext(SurfaceContext);
}

export interface AdaptiveSurfaceProps {
  /**
   * Stable id. Doubles as the draggable instance key in window mode, so a
   * surface remembers where it was dragged exactly like the command palette.
   */
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: SurfacePresentation;
  /** Shown in the header, left of the close button. */
  title: React.ReactNode;
  /** Extra controls in the header, between the title and close. */
  actions?: React.ReactNode;
  closeLabel: string;
  /** Width of the floating window; drawers use their own edge-relative sizing. */
  windowWidth?: string;
  /**
   * The popover shape's settings, grouped because `anchor` is not tuning like
   * `windowWidth` is — the shape cannot position itself without one. Keeping
   * them together makes that required where a sibling `anchor?` could only ask
   * for it in prose. A surface whose presentation can resolve to `popover`
   * passes this whatever the current viewport is, since the shape is chosen at
   * render; the other shapes ignore it.
   */
  popover?: {
    /** What the card hangs off — a ref to the button that owns it. */
    anchor: React.RefObject<HTMLElement | null>;
    /** Width of the card. */
    width?: string;
    /**
     * Which edge of the card lines up with the anchor's. `end` for a trigger
     * at the trailing edge of its row, so the card hangs back over the content
     * rather than out into the margin.
     */
    align?: "start" | "center" | "end";
  };
  /** Height cap for the window, popover and sheet shapes. */
  maxHeight?: string;
  /**
   * Size the surface to what it holds rather than to the screen — a short
   * settings surface, a form, a confirmation. In the sheet shape this is
   * `SurfaceSheet`'s `fitContent` (see sheet.tsx: it stands at no detent and
   * never grows past the screen); a popover is content-sized under its cap
   * already, so it needs nothing; a window keeps `maxHeight`.
   */
  fitContent?: boolean;
  /**
   * Detents for the sheet shape, as fractions of the viewport, lowest first;
   * the sheet opens at the first and a drag carries it to the top. Overrides
   * `maxHeight` there; the other shapes ignore it.
   */
  snapPoints?: number[];
  /** Padding on the scroll area, for content that wants to bleed wider. */
  contentClassName?: string;
  /** The scroll container, for content that needs to scroll a row into view. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

/**
 * Popover mode — the card hanging off the button that opened it.
 *
 * A Base UI Popover rather than a Drawer: it is positioned against an anchor,
 * it flips and shifts to stay on screen, and it dismisses on an outside press
 * the way a menu does. The shell, header and scroll area are the other shapes'.
 *
 * Not marked as a bezel layer, unlike the drawer viewport: that mark is for
 * full-screen fixed boxes, which Safari samples its chrome colour from. A
 * popover is small, inset and anchored, and `position: fixed` inside the
 * bezel's fixed <body> resolves to the same box either way.
 */
function SurfacePopoverShape({
  open,
  onOpenChange,
  popover,
  maxHeight,
  children,
}: Pick<
  AdaptiveSurfaceProps,
  "open" | "onOpenChange" | "popover" | "maxHeight" | "children"
>) {
  const anchor = popover?.anchor;
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        // The anchor is our owner's own button, not a Base UI trigger, so Base
        // UI reads a press on it as an outside press: it would close here and
        // the button's own click would reopen in the same gesture. Leave that
        // press to the button.
        if (
          !next &&
          details.reason === "outside-press" &&
          anchor?.current?.contains(details.event.target as Node)
        ) {
          details.cancel();
          return;
        }
        onOpenChange(next);
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align={popover?.align ?? "start"}
          sideOffset={8}
          collisionPadding={12}
          className="z-[60]"
        >
          <Popover.Popup
            // Focus goes back to the button that opened it, which is the
            // anchor: without a Base UI trigger there is nothing else to
            // hand it to.
            finalFocus={anchor}
            style={{
              width: popover?.width ?? "min(92vw, 300px)",
              maxHeight: maxHeight ?? "min(70vh, 520px)",
            }}
            className={cn(
              SHELL,
              // Same glass, a smaller radius: a popover is a card, not a sheet.
              "z-[61] rounded-2xl origin-[var(--transform-origin)]",
              "transition-[opacity,transform] duration-150 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Panel mode — the same drawer as the sheet, entering from the trailing edge. */
function SurfacePanel({
  open,
  onOpenChange,
  children,
}: Pick<AdaptiveSurfaceProps, "open" | "onOpenChange" | "children">) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="right"
      // No overlay: no scroll lock, no focus trap, and an outside press stays
      // the page's. A panel that closed on every touch could not be used.
      modal={false}
      disablePointerDismissal
    >
      <Drawer.Portal>
        <SurfaceViewport modal={false}>
          <Drawer.Popup
            data-surface-popup=""
            style={surfaceMotionVars(EDGE_GAP)}
            className={cn(
              SHELL,
              // Tablet: a taller, roomier column than a phone sheet affords.
              "pointer-events-auto absolute z-[61] bottom-3 right-3 top-3 w-[min(94vw,var(--surface-panel-w,440px))]"
            )}
          >
            {/* A mouse press in here is a press, not the start of a drag —
                see the same note in sheet.tsx. A touch swipe still dismisses. */}
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </SurfaceViewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function AdaptiveSurface({
  presentation,
  id,
  open,
  onOpenChange,
  title,
  actions,
  closeLabel,
  windowWidth,
  popover,
  maxHeight,
  fitContent,
  snapPoints,
  contentClassName,
  scrollRef,
  children,
}: AdaptiveSurfaceProps) {
  const mode = useSurfaceMode(presentation);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  // Memoised: the surface re-renders whenever its owner does, and its content
  // is the whole picker grid.
  const value = useMemo(
    () => ({ mode, isWindow: mode === "window", close }),
    [mode, close]
  );

  const body = (
    <SurfaceBody
      title={title}
      actions={actions}
      closeLabel={closeLabel}
      onClose={close}
      titleAs={
        mode === "window"
          ? undefined
          : mode === "popover"
            ? Popover.Title
            : Drawer.Title
      }
      contentClassName={contentClassName}
      scrollRef={scrollRef}
    >
      {children}
    </SurfaceBody>
  );

  return (
    <SurfaceContext.Provider value={value}>
      {mode === "window" ? (
        <SurfaceWindow
          id={id}
          open={open}
          onOpenChange={onOpenChange}
          width={windowWidth}
          maxHeight={maxHeight}
        >
          {body}
        </SurfaceWindow>
      ) : mode === "panel" ? (
        <SurfacePanel open={open} onOpenChange={onOpenChange}>
          {body}
        </SurfacePanel>
      ) : mode === "popover" ? (
        <SurfacePopoverShape
          open={open}
          onOpenChange={onOpenChange}
          popover={popover}
          maxHeight={maxHeight}
        >
          {body}
        </SurfacePopoverShape>
      ) : (
        <SurfaceSheet
          id={id}
          open={open}
          onOpenChange={onOpenChange}
          height={maxHeight}
          fitContent={fitContent}
          snapPoints={snapPoints}
        >
          {body}
        </SurfaceSheet>
      )}
    </SurfaceContext.Provider>
  );
}
