import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface HeaderZoneProps {
  children: ReactNode;
  className?: string;
}

/**
 * HeaderZone - Fixed-height header region for consistent page layout.
 *
 * Enforces a stable content-start position across all index/list pages
 * and the home page. Children should structure themselves as:
 * 1. A fixed-height top slot (e.g. nav/system identifier)
 * 2. A `flex-1` title area centered vertically
 */
export function HeaderZone({ children, className }: HeaderZoneProps) {
  return (
    <div className={cn("h-60 flex flex-col", className)}>{children}</div>
  );
}
