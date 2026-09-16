"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { Drawer } from "@base-ui/react/drawer";
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
//           opens from its shelf icon, and is draggable by its header. Centred
//           near the top unless `windowPlacement` says otherwise.
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
   * Where the window shape rests before any drag. Centred near the top by
   * default; `top-right` is for a surface that must not sit over the thing it
   * is about — the devtool panel, which exists to watch the page react.
   */
  windowPlacement?: "center" | "top-right";
  /** Height cap for window and sheet modes. */
  maxHeight?: string;
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
  /**
   * A fixed strip below the scroll area, in every shape — a status line, a
   * destructive action. It does not scroll away with the content.
   */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Panel mode — the same drawer as the sheet, entering from the trailing edge. */
function SurfacePanel({
  open,
  onOpenChange,
  title,
  actions,
  closeLabel,
  contentClassName,
  scrollRef,
  footer,
  children,
}: Omit<AdaptiveSurfaceProps, "presentation" | "id">) {
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
              <SurfaceBody
                title={title}
                actions={actions}
                closeLabel={closeLabel}
                onClose={() => onOpenChange(false)}
                titleAs={Drawer.Title}
                contentClassName={contentClassName}
                scrollRef={scrollRef}
                footer={footer}
              >
                {children}
              </SurfaceBody>
            </Drawer.Content>
          </Drawer.Popup>
        </SurfaceViewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function AdaptiveSurface({
  presentation,
  ...props
}: AdaptiveSurfaceProps) {
  const mode = useSurfaceMode(presentation);
  const {
    id,
    open,
    onOpenChange,
    title,
    actions,
    closeLabel,
    windowWidth,
    windowPlacement,
    maxHeight,
    snapPoints,
    contentClassName,
    scrollRef,
    footer,
    children,
  } = props;
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
      titleAs={mode === "window" ? undefined : Drawer.Title}
      contentClassName={contentClassName}
      scrollRef={scrollRef}
      footer={footer}
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
          placement={windowPlacement}
        >
          {body}
        </SurfaceWindow>
      ) : mode === "panel" ? (
        <SurfacePanel {...props} />
      ) : (
        <SurfaceSheet
          id={id}
          open={open}
          onOpenChange={onOpenChange}
          height={maxHeight}
          snapPoints={snapPoints}
        >
          {body}
        </SurfaceSheet>
      )}
    </SurfaceContext.Provider>
  );
}
