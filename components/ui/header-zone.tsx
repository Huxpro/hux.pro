import { cn } from "@/lib/utils";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export const TITLE_POETIC =
  "font-serif text-3xl sm:text-4xl tracking-tight";

export const TITLE_READER =
  "font-sans text-xl sm:text-2xl font-medium leading-tight";

interface HeaderZoneProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  heightClassName?: string;
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
export function HeaderZone({
  children,
  heightClassName = "h-44 sm:h-48",
  className,
  style,
  ...rest
}: HeaderZoneProps) {
  return (
    <div
      className={cn("flex flex-col", heightClassName, className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
