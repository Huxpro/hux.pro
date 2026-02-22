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
 * 1. Nav element at top (auto height)
 * 2. Title area using `flex-1 flex flex-col justify-center pb-12`
 *    for optical vertical centering (~40-45% from top)
 */
export function HeaderZone({ children, className }: HeaderZoneProps) {
  return (
    <div className={cn("h-60 flex flex-col", className)}>{children}</div>
  );
}
