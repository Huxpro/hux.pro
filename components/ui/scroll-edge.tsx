import { cn } from "@/lib/utils";

// =============================================================================
// Scroll edge — the Liquid Glass pocket at a clipped edge.
//
// Pre-glass, a scroll fade was `from-background`: an opaque slab of page
// colour painted over the cutoff. That assumed the page was a solid card,
// and reads as a muddy patch once the surface behind is wallpaper or Clear
// glass (see docs/system-glass.md).
//
// The replacement sits ON the transparent surface. It paints with a glass
// token — so Tinted / Clear / wallpaper tint all follow along — plus a short
// blur, masked so the frost is strongest at the outer edge and gone inward.
// Same show/hide contract as the old overlay: the caller owns visibility.
// =============================================================================

export type ScrollEdge = "left" | "right" | "top" | "bottom";

const MASK: Record<ScrollEdge, string> = {
  left: "linear-gradient(to right, black, transparent)",
  right: "linear-gradient(to left, black, transparent)",
  top: "linear-gradient(to bottom, black, transparent)",
  bottom: "linear-gradient(to top, black, transparent)",
};

const POS: Record<ScrollEdge, string> = {
  left: "inset-y-0 left-0 w-6",
  right: "inset-y-0 right-0 w-6",
  top: "inset-x-0 top-0 h-7",
  bottom: "inset-x-0 bottom-0 h-7",
};

export function ScrollEdgeFade({
  edge,
  visible = true,
  className,
}: {
  edge: ScrollEdge;
  /** When false, the pocket is kept mounted and faded out (so it can
   *  transition). Defaults to visible. */
  visible?: boolean;
  className?: string;
}) {
  const mask = MASK[edge];
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute",
        POS[edge],
        // Glass fill + blur, not `--background`. The mask is what makes the
        // pocket a falloff rather than a pane.
        "bg-glass backdrop-blur-md",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  );
}
