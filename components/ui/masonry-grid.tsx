"use client";

import { cn } from "@/lib/utils";
import { Children, useEffect, useState, type ReactNode } from "react";

/**
 * Two-column masonry grid that distributes children round-robin (left, right,
 * left, right …) on desktop, and stacks them in natural order on mobile.
 */
export function MasonryGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const items = Children.toArray(children).filter(Boolean);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Mobile: single column, natural order
  if (!desktop) {
    return <div className={cn("flex flex-col gap-4", className)}>{items}</div>;
  }

  // Desktop: round-robin two-column masonry
  return (
    <div className={cn("grid grid-cols-2 gap-4 items-start", className)}>
      <div className="flex flex-col gap-4">
        {items.filter((_, i) => i % 2 === 0)}
      </div>
      <div className="flex flex-col gap-4">
        {items.filter((_, i) => i % 2 === 1)}
      </div>
    </div>
  );
}
