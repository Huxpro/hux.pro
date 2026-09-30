import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { shapePath, type ShapeName } from "../lib/shapes";

/**
 * A Material 3 Expressive shape filled with a colour role, with content
 * centred on it — the weather's condition glyph on a `Sunny` or a cookie,
 * the way Android's own weather widget draws it. The shape is an SVG behind
 * the content, so it scales with the element and never clips what's on it.
 */
export function ExpressiveShape({
  shape,
  className,
  fill = "var(--md-primary-container)",
  children,
}: {
  shape: ShapeName;
  /** Size and colour (`text-*` colours the content). */
  className?: string;
  /** Any CSS colour; a Material role by default. */
  fill?: string;
  children?: ReactNode;
}) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
      >
        <path d={shapePath(shape)} fill={fill} />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
