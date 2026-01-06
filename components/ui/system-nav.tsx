"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { cn } from "@/lib/utils";
import Link from "next/link";
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
 */
export function SystemNav({ href, path, hoverText = "cd ..", className }: SystemNavProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Determine display text: show path normally, scramble to hoverText on hover
  const displayText = isHovered ? hoverText : path;

  return (
    <Link
      href={href}
      className={cn(
        "inline-block font-mono text-xs tracking-wide",
        "text-muted-foreground hover:text-foreground",
        "transition-colors duration-200",
        // Ensure pointer events work during animation
        "pointer-events-auto cursor-pointer",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TextScramble
        key={displayText}
        trigger={true}
        duration={0.4}
        speed={0.02}
        characterSet="λabcdefghijklmnopqrstuvwxyz/.~-_"
        as="span"
        className="inline-block pointer-events-none"
      >
        {displayText}
      </TextScramble>
    </Link>
  );
}
