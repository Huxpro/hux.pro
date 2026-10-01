import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * The well every lab surface is drawn in: the specimens' ground from the labs
 * themselves (`bg-muted/40`, a rounded well), filling whatever height its
 * host gives it (the home widget's body, a card on the /lab index).
 *
 * A surface is a lab at a glance, and it is live: it reads the same system
 * the lab lays open (the log, the icon config, the wallpaper's legibility,
 * the one light), so it is never a picture of the lab, only a small one.
 * It takes no taps of its own; the host is the way in.
 */
export function SurfaceFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl bg-muted/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
