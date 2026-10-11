"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

import { TYPE } from "@/lib/typography";
interface SystemNavProps {
  href: string;
  /** The destination path to show by default (e.g., "/writing", "/docs"). Use "λhux" for root. */
  path: string;
  /** The hover state text, defaults to "cd .." */
  hoverText?: string;
  /**
   * Carry the `site-identifier` view-transition name. Only one element per
   * page may; a second copy of the back button (the pinned one) passes false.
   */
  identifier?: boolean;
  className?: string;
  /** React 19 takes `ref` as a prop. */
  ref?: React.Ref<HTMLAnchorElement>;
}

/**
 * The back button: a glass capsule, a chevron, and where it goes.
 *
 * It used to be the path alone, mono text with nothing around it, which read
 * as a label until a pointer found it (and a finger never did). The capsule is
 * the same glass every other floating control on the site wears (the command
 * bar, the Ask ball, a Live Activity), so it reads as a thing to press without
 * a new visual word; the chevron says which way.
 *
 * - Shows the destination (`λhux`, `/writing`, `/docs`) and scrambles to
 *   `cd ..` on hover. The click navigates at once.
 * - Drawn 36px tall; `hit-area` gives it the site's 48px touch target
 *   (app/globals.css, "Touch target").
 */
export function SystemNav({
  href,
  path,
  hoverText = "cd ..",
  identifier = true,
  className,
  ref,
}: SystemNavProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Determine display text: show path normally, scramble to hoverText on hover
  const displayText = isHovered ? hoverText : path;

  return (
    <Link
      ref={ref}
      href={href}
      className={cn(
        TYPE.nav,
        "text-muted-foreground hover:text-foreground active:text-foreground",
        // Ensure pointer events work during animation
        "pointer-events-auto cursor-pointer",
        // OS chrome: no text selection / callout; press lands instantly.
        "system-chrome pressable hit-area",
        // The capsule. Glass, so it follows Tinted / Clear with the rest of
        // the floating chrome (docs/system-glass.md).
        "inline-flex h-9 items-center gap-1 rounded-full pl-2 pr-3.5",
        "border border-border/50 bg-glass backdrop-blur-xl",
        "hover:bg-glass-hover active:bg-glass-strong active:scale-[0.97]",
        // The properties are named rather than `all`: the reader's type size
        // drives this element's `margin-bottom` (the gap over the article
        // title, app/globals.css), and `transition-all` put that margin in the
        // transition set -- so changing the size snapped the type and then
        // slid the whole page for another 150ms. `scale` is listed because
        // Tailwind v4 compiles `scale-*` to the `scale` property.
        "transition-[color,background-color,scale] duration-150",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ChevronLeft aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span data-view-transition={identifier ? "site-identifier" : undefined}>
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
