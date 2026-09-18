"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { HEADER_BUTTON } from "./sheet";
import { useWindowDraggable } from "./window";

// =============================================================================
// SurfaceBody — the title bar, the scroll area and the footer under it.
//
// The one thing every shape puts inside its shell, so a surface reads as the
// same object whichever direction it arrived from. Separate from both the
// shell primitives (sheet.tsx, window.tsx) and the viewport policy
// (adaptive-surface.tsx), because a surface whose shape is chosen by a gesture
// rather than by the viewport still wants this exact chrome.
//
// It asks the window whether it may be dragged rather than being told: in a
// draggable window the header is the handle, and in a sheet or a panel nothing
// is — the drawer moves those.
// =============================================================================

export interface SurfaceBodyProps {
  /** Shown in the header, left of the close button. */
  title: React.ReactNode;
  /** Extra controls in the header, between the title and close. */
  actions?: React.ReactNode;
  closeLabel: string;
  onClose: () => void;
  /**
   * The element the title renders as. Drawers pass `Drawer.Title` so the
   * dialog is labelled; the close button stays outside it, where it belongs.
   */
  titleAs?: React.ElementType;
  /** Padding on the scroll area, for content that wants to bleed wider. */
  contentClassName?: string;
  /** The scroll container, for content that needs to scroll a row into view. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * A fixed strip below the scroll area — a status line, a destructive action.
   * It does not scroll away with the content.
   */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function SurfaceHeader({
  title,
  actions,
  closeLabel,
  onClose,
  draggable,
  titleAs: TitleAs = "div",
}: Pick<SurfaceBodyProps, "title" | "actions" | "closeLabel" | "onClose"> & {
  draggable: boolean;
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

export function SurfaceBody({
  title,
  actions,
  closeLabel,
  onClose,
  titleAs,
  contentClassName,
  scrollRef,
  footer,
  children,
}: SurfaceBodyProps) {
  const draggable = useWindowDraggable();

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
      {footer && <div className="shrink-0">{footer}</div>}
    </>
  );
}
