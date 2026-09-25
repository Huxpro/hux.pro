"use client";

import { cn } from "@/lib/utils";
import { useDraggable } from "@/systems/draggable";
import { AnimatePresence, motion } from "framer-motion";
import { createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { SHELL } from "./sheet";

// =============================================================================
// SurfaceWindow — the floating shell every desktop surface is made of.
//
// The sibling of <SurfaceSheet>: one is a surface docked to an edge, this one
// is a surface that floats free. Not a drawer — it springs in the way
// `systems/windows` opens an app from its shelf icon, and drags by its header
// through the shared `useDraggable` hook, so it inherits the devtool's
// per-instance drag settings like every other draggable thing on the site.
//
// Like the sheet, it is a shell around whatever it is given, not a layout of
// its own. <AdaptiveSurface> composes it with <SurfaceBody> when the viewport
// asks for a window; the devtool composes it directly, because for the devtool
// the shape is a thing the developer chose with a gesture rather than
// something the viewport decided (see systems/devtool/dock.tsx).
// =============================================================================

/**
 * The curve a window arrives on: the one `systems/windows` opens an app from
 * its shelf icon with. Shared so the things that claim to be the same gesture
 * are the same numbers rather than three comments saying they should be.
 */
export const WINDOW_SPRING = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.7,
} as const;

/**
 * Whether the window hosting this content can be dragged, so its header can
 * be the handle. Null outside a window: a sheet and a panel are moved by the
 * drawer, never by a header.
 */
const SurfaceWindowContext = createContext<boolean | null>(null);

/** True when this content sits in a draggable window. False anywhere else. */
export function useWindowDraggable(): boolean {
  return useContext(SurfaceWindowContext) ?? false;
}

export interface SurfaceWindowProps {
  /** Draggable instance key. Register it in `DRAGGABLE_INSTANCES`. */
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Width of the floating window. */
  width?: string;
  maxHeight?: string;
  /**
   * Where the window rests before any drag. Centred near the top by default;
   * `top-right` is for a surface that must not sit over the thing it is about.
   */
  placement?: "center" | "top-right";
  /** Paint layer; 60 by default, level with the other secondary surfaces.
   *  Raised for a surface that must come up over a higher layer (the
   *  devtool over the About). */
  zIndex?: number;
  className?: string;
  children: React.ReactNode;
}

export function SurfaceWindow({
  id,
  open,
  onOpenChange,
  width,
  maxHeight,
  placement = "center",
  zIndex,
  className,
  children,
}: SurfaceWindowProps) {
  // Destructured up front: reading `drag.*` inside the JSX trips the
  // react-hooks/refs rule, since the same object also carries `contentRef`.
  const {
    isEnabled: isDraggable,
    contentRef,
    dragControls,
    motionStyle,
    onDragStart,
    onDragEnd,
    startDrag,
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
        <div
          className={cn(
            "pointer-events-none fixed inset-0 z-[60] flex items-start",
            placement === "top-right"
              ? "justify-end p-4"
              : "justify-center pt-[12vh]"
          )}
          style={zIndex !== undefined ? { zIndex } : undefined}
        >
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
                ? (e: React.PointerEvent) =>
                    startDrag(e, undefined, "[data-drag-handle]")
                : undefined
            }
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
            transition={WINDOW_SPRING}
            style={{
              ...(isDraggable ? motionStyle : {}),
              width: width ?? "min(92vw, 560px)",
              maxHeight: maxHeight ?? "76vh",
            }}
            className={cn(SHELL, "pointer-events-auto relative z-[61]", className)}
          >
            <SurfaceWindowContext.Provider value={isDraggable}>
              {children}
            </SurfaceWindowContext.Provider>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
