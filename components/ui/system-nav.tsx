"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { cn } from "@/lib/utils";
import { Link } from "next-view-transitions";
import { useState } from "react";

interface SystemNavProps {
  href: string;
  /** The destination path to show by default (e.g., "/writing", "/docs"). Use "λhux" for root. */
  path: string;
  /** The hover state text, defaults to "cd .." */
  hoverText?: string;
  className?: string;
}

/**
 * System UI Navigation Component
 *
 * Consistent navigation element following the System UI design language:
 * - Monospace font
 * - Shows destination path by default (e.g., "/docs", "λhux")
 * - Scrambles to "cd .." on hover
 * - Click navigates immediately (not blocked by animation)
 * - Mobile optimized: larger touch target (44px min), touch feedback
 */
export function SystemNav({
  href,
  path,
  hoverText = "cd ..",
  className,
}: SystemNavProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Determine display text: show path normally, scramble to hoverText on hover
  const displayText = isHovered ? hoverText : path;

  return (
    <Link
      href={href}
      className={cn(
        // Visual styling (unchanged)
        "font-mono text-xs tracking-wide",
        "text-muted-foreground hover:text-foreground",
        "transition-colors duration-200",
        // Ensure pointer events work during animation
        "pointer-events-auto cursor-pointer",
        // OS chrome: no text selection / callout; press lands instantly.
        "system-chrome pressable",
        // Mobile touch optimization
        // Larger touch target with negative margin to maintain visual position
        "relative inline-flex items-center justify-start",
        "min-h-[44px] min-w-[44px]", // Apple HIG minimum touch target
        "-ml-3 pl-3 pr-3 -mt-2 pt-2 -mb-2 pb-2", // Expand touch area without moving visual
        "rounded-lg", // Rounded for touch feedback area
        // Touch feedback
        "active:bg-foreground/5 active:scale-[0.98]",
        "transition-all duration-150",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span data-view-transition="site-identifier">
        <TextScramble
          trigger={true}
          duration={0.4}
          speed={0.02}
          characterSet="λabcdefghijklmnopqrstuvwxyz/.~-_"
          as="span"
          className="inline-block pointer-events-none"
        >
          {displayText}
        </TextScramble>
      </span>
    </Link>
  );
}
