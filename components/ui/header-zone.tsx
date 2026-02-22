import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

interface HeaderZoneProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * HeaderZone - Fixed-height header region for consistent page layout.
 *
 * Enforces a stable content-start position across all index/list pages
 * and the home page. Children should structure themselves as:
 * 1. A fixed-height top slot (e.g. nav/system identifier)
 * 2. A `flex-1` title area centered vertically
 */
export function HeaderZone({ children, className, style }: HeaderZoneProps) {
  return (
    <div className={cn("h-60 flex flex-col", className)} style={style}>
      {children}
    </div>
  );
}
