"use client";

import { SystemNav } from "@/components/ui/system-nav";
import { useMounted } from "@/components/ui/use-mounted";
import { cn } from "@/lib/utils";
import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * The back capsule, kept within reach once the page has scrolled past it.
 *
 * A reader three screens into an article had no way up but the palette: the
 * back link rode away with the masthead. iOS keeps its back button in the
 * navigation bar for the same reason. This is the same capsule
 * (`SystemNav`), pinned at the top left, level with the Dock's pills, and
 * only while the one in the masthead is out of view, so there is never a
 * second copy on screen.
 *
 * It does not carry the `site-identifier` view-transition name: the masthead's
 * copy does, and a name must be unique in the document.
 */
export function FloatingBack({
  anchor,
  href,
  path,
}: {
  /** The in-flow back link; this shows while it is off screen. */
  anchor: RefObject<HTMLElement | null>;
  href: string;
  path: string;
}) {
  const [shown, setShown] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    const el = anchor.current;
    if (!el) return;
    // Viewport-relative, so it holds whichever element scrolls (window, or
    // vitre's container on iOS).
    const io = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [anchor]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden={!shown}
      inert={!shown}
      className={cn(
        "system-chrome fixed z-40",
        // Level with the Dock's pills (systems/dock/components/dock.tsx), at
        // the column's left edge where there is a column, the gutter where
        // there is not.
        "top-[max(env(safe-area-inset-top),0.5rem)]",
        "left-[max(var(--page-gutter),calc((100vw-var(--page-col))/2+var(--page-gutter)))]",
        "transition-[opacity,translate] duration-200 ease-out",
        shown ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
      )}
    >
      {/* Over running text, not the wallpaper: the overlay glass (the peek's),
          so a line of prose behind it cannot read through the label. */}
      <SystemNav
        href={href}
        path={path}
        identifier={false}
        className="bg-glass-overlay shadow-raised hover:bg-glass-overlay"
      />
    </div>,
    document.body
  );
}
