"use client";

import { cn } from "@/lib/utils";
import { useDraggable } from "@/systems/draggable";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { Drawer } from "@base-ui/react/drawer";
import { useSurfaceMode, type SurfaceMode, type SurfacePresentation } from "./presentation";
import {
  EDGE_GAP,
  HEADER_BUTTON,
  SHELL,
  SurfaceSheet,
  SurfaceViewport,
  surfaceMotionVars,
} from "./sheet";

// =============================================================================
// AdaptiveSurface — one secondary surface, three shapes.
//
// Wraps the shape-per-viewport decision (see presentation.ts) behind a single
// component so a feature declares intent and stops thinking about it:
//
//   <AdaptiveSurface id="wallpaper" open={…} presentation={ADAPTIVE_PRESENTATION}>
//
// The three shapes share one glass shell, one header and one close affordance,
// so they read as the same object arriving from a different direction:
//
//   sheet   <SurfaceSheet> (sheet.tsx): a Base UI drawer from the bottom,
//           drag-to-dismiss, grabber, stacks the iOS way.
//   panel   the same drawer from the trailing edge, drag-to-dismiss.
//   window  a centred window that morphs in the way an app window does when it
//           opens from its shelf icon, and is draggable by its header.
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
  children: React.ReactNode;
}

function SurfaceHeader({
  title,
  actions,
  closeLabel,
  onClose,
  draggable,
  /**
   * The element the title renders as. Drawers pass `Drawer.Title` so the
   * dialog is labelled; the close button stays outside it, where it belongs.
   */
  titleAs: TitleAs = "div",
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  closeLabel: string;
  onClose: () => void;
  draggable?: boolean;
  titleAs?: React.ElementType;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 px-5 pb-2 pt-3",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
      data-drag-handle={draggable ? "" : undefined}
    >
      <TitleAs className="min-w-0 flex-1 truncate text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </TitleAs>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <button
          onClick={onClose}
          aria-label={closeLabel}
          className={cn(HEADER_BUTTON, "-mr-2")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** The title bar and the scroll area under it — the same in every shape. */
function SurfaceBody({
  title,
  actions,
  closeLabel,
  onClose,
  draggable,
  titleAs,
  contentClassName,
  scrollRef,
  children,
}: Pick<
  AdaptiveSurfaceProps,
  "title" | "actions" | "closeLabel" | "contentClassName" | "scrollRef" | "children"
> & {
  onClose: () => void;
  draggable?: boolean;
  titleAs?: React.ElementType;
}) {
  return (
    <>
      <SurfaceHeader
        title={title}
        actions={actions}
        closeLabel={closeLabel}
        onClose={onClose}
        draggable={draggable}
        titleAs={titleAs}
      />
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain",
          contentClassName ?? "px-4 pb-5"
        )}
      >
        {children}
      </div>
    </>
  );
}

/**
 * Window mode. Not a drawer: a free-floating panel that springs in the way
 * `systems/windows` opens an app, and drags by its header through the shared
 * `useDraggable` hook, so it inherits the devtool's per-instance drag settings.
 */
function SurfaceWindow({
  id,
  open,
  onOpenChange,
  title,
  actions,
  closeLabel,
  windowWidth,
  maxHeight,
  contentClassName,
  scrollRef,
  children,
}: Omit<AdaptiveSurfaceProps, "presentation">) {
  // Destructured up front: reading `drag.*` inside the JSX trips the
  // react-hooks/refs rule, since the same object also carries `contentRef`.
  const {
    isEnabled: isDraggable,
    contentRef,
    dragControls,
    motionStyle,
    onDragStart,
    onDragEnd,
    preventClickAfterDrag,
  } = useDraggable(id);

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        // This full-screen positioning box would otherwise be an invisible
        // wall over the page; only the window takes pointers.
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
          <motion.div
            ref={contentRef as React.RefObject<HTMLDivElement>}
            role="dialog"
            drag={isDraggable ? true : undefined}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            // Releasing a header drag over the content must not activate it —
            // the same guard the command palette uses.
            onClickCapture={preventClickAfterDrag}
            onPointerDown={
              isDraggable
                ? (e: React.PointerEvent) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest("[data-drag-handle]")) return;
                    dragControls.start(e);
                  }
                : undefined
            }
            // The same spring the window system opens an app with, so a surface
            // arriving here reads as the same gesture the shelf icons use.
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
            style={{
              ...(isDraggable ? motionStyle : {}),
              width: windowWidth ?? "min(92vw, 560px)",
              maxHeight: maxHeight ?? "76vh",
            }}
            className={cn(SHELL, "pointer-events-auto relative z-[61]")}
          >
            <SurfaceBody
              title={title}
              actions={actions}
              closeLabel={closeLabel}
              onClose={() => onOpenChange(false)}
              draggable={isDraggable}
              contentClassName={contentClassName}
              scrollRef={scrollRef}
            >
              {children}
            </SurfaceBody>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Panel mode — the same drawer, entering from the trailing edge. */
function SurfacePanel({
  open,
  onOpenChange,
  title,
  actions,
  closeLabel,
  contentClassName,
  scrollRef,
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

/** Sheet mode — the shared sheet primitive with this surface's title bar in it. */
function SurfaceSheetShape({
  id,
  open,
  onOpenChange,
  title,
  actions,
  closeLabel,
  maxHeight,
  snapPoints,
  contentClassName,
  scrollRef,
  children,
}: Omit<AdaptiveSurfaceProps, "presentation">) {
  return (
    <SurfaceSheet
      id={id}
      open={open}
      onOpenChange={onOpenChange}
      height={maxHeight}
      snapPoints={snapPoints}
    >
      <SurfaceBody
        title={title}
        actions={actions}
        closeLabel={closeLabel}
        onClose={() => onOpenChange(false)}
        titleAs={Drawer.Title}
        contentClassName={contentClassName}
        scrollRef={scrollRef}
      >
        {children}
      </SurfaceBody>
    </SurfaceSheet>
  );
}

export function AdaptiveSurface({
  presentation,
  ...props
}: AdaptiveSurfaceProps) {
  const mode = useSurfaceMode(presentation);
  const { onOpenChange } = props;
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  // Memoised: the surface re-renders whenever its owner does, and its content
  // is the whole picker grid.
  const value = useMemo(
    () => ({ mode, isWindow: mode === "window", close }),
    [mode, close]
  );

  return (
    <SurfaceContext.Provider value={value}>
      {mode === "window" ? (
        <SurfaceWindow {...props} />
      ) : mode === "panel" ? (
        <SurfacePanel {...props} />
      ) : (
        <SurfaceSheetShape {...props} />
      )}
    </SurfaceContext.Provider>
  );
}
