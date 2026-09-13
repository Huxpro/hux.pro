import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

export const TITLE_POETIC =
  "font-serif text-3xl sm:text-4xl tracking-tight";

export const TITLE_READER =
  "font-sans text-xl sm:text-2xl font-medium leading-tight";

interface HeaderZoneProps {
  children: ReactNode;
  heightClassName?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * HeaderZone - Fixed-height header region for consistent page layout.
 *
 * Enforces a stable content-start position across index/list pages.
 * The homepage uses HomeStage instead (height-aware springboard).
 * Children should structure themselves as:
 * 1. A fixed-height top slot (e.g. nav/system identifier)
 * 2. A `flex-1` title area centered vertically
 */
export function HeaderZone({
  children,
  heightClassName = "h-44 sm:h-48",
  className,
  style,
}: HeaderZoneProps) {
  return (
    <div className={cn("flex flex-col", heightClassName, className)} style={style}>
      {children}
    </div>
  );
}
