"use client";

import { MousePointer2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Media } from "@/lib/log";

/**
 * The editor's inspect handle on a piece of media.
 *
 * One overlay, used by the strip, the feed grid, the leftover renderer,
 * and anything else a commit prints — so inspect mode can keep the same
 * attachment object /works uses, instead of swapping in a different
 * layout just to host the handle.
 */
export function InspectableMedia({
  media,
  inspecting,
  selected,
  inline = false,
  onInspect,
  children,
}: {
  media: Media;
  inspecting: boolean;
  selected: boolean;
  inline?: boolean;
  onInspect?: (media: Media) => void;
  children: ReactNode;
}) {
  if (!inspecting) return <>{children}</>;

  return (
    <div
      data-editor-interactive
      className={cn(
        "relative group/media",
        inline ? "inline-flex rounded-md" : "rounded-lg",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 ring-inset transition",
          inline ? "rounded-md" : "rounded-lg",
          selected
            ? "ring-2 ring-sky-500/70 bg-sky-500/[0.04]"
            : "ring-0 group-hover/media:ring-1 group-hover/media:ring-sky-500/35",
        )}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onInspect?.(media);
        }}
        className={cn(
          "absolute right-1.5 top-1.5 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-background/90 text-muted-foreground shadow-sm transition-opacity hover:text-foreground focus:opacity-100",
          selected
            ? "opacity-100 border-sky-500/70 text-sky-600 ring-1 ring-inset ring-sky-500/35 dark:text-sky-400"
            : "opacity-0 group-hover/media:opacity-100 group-focus-within/media:opacity-100",
        )}
        title="Inspect media"
        aria-label="Inspect media"
      >
        <MousePointer2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
