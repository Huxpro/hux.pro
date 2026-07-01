"use client";

import { cn } from "@/lib/utils";
import { useInputCapability } from "@/services";
import React, { useEffect, useState } from "react";
import { Cursor } from "./cursor";

export interface MagneticPreviewProps {
  /** Content for the cursor-following preview panel. */
  preview: React.ReactNode;
  /** Whether preview is active. Default: true. Set to false to temporarily suppress. */
  enabled?: boolean;
  /** Hide native cursor when preview is shown. Default: false. */
  hideNativeCursor?: boolean;
  /** Additional class for the preview panel. */
  panelClassName?: string;
  /** Additional class for the wrapper div. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Unified soft shadow for every hover-peek surface (writing post, works
 * card / video / details / stacked deck). Deliberately lighter than the old
 * `shadow-2xl shadow-black/20`: enough to lift a white card off a white page
 * in light mode, quiet enough not to feel heavy in dark mode. Exported so the
 * works peeks (which strip the panel chrome and supply their own on the card)
 * stay in visual sync with the shared panel here.
 */
export const PEEK_SHADOW = "shadow-xl shadow-black/15";

const defaultVariants = {
  initial: { opacity: 0, scale: 0.9, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: 8 },
};

const defaultTransition = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0.1,
};

const defaultSpringConfig = {
  bounce: 0.01,
};

export function MagneticPreview({
  preview,
  enabled = true,
  hideNativeCursor = false,
  panelClassName,
  className,
  children,
}: MagneticPreviewProps) {
  const { magneticPreviewEnabled } = useInputCapability();
  // Cursor follows the live pointer position, so it cannot match the SSR
  // HTML on hydration. Gate it behind a mount flag so it only appears
  // after hydration on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showPreview = mounted && enabled && magneticPreviewEnabled;

  return (
    <div
      className={cn(
        showPreview && hideNativeCursor && "[&:hover]:cursor-none",
        className,
      )}
    >
      {children}
      {showPreview && (
        <Cursor
          attachToParent
          variants={defaultVariants}
          transition={defaultTransition}
          springConfig={defaultSpringConfig}
          // Intentionally NOT clipped. This wrapper used to carry
          // `overflow-hidden rounded-lg`, which sheared the panel's soft
          // shadow off at the rounded edge — that's why every peek but the
          // stacked deck looked flat. Each peek surface rounds its OWN
          // content (the panel/card carry their own `overflow-hidden`), so
          // the wrapper doesn't need to; leaving it unclipped lets the
          // unified `PEEK_SHADOW` breathe.
        >
          <div
            className={cn(
              // Translucent lifted surface — matches the Dock Live Activity
              // expanded panel recipe (bg-card/70 + backdrop-blur-xl +
              // border + a soft shadow). In dark mode popover/card are
              // *darker* than the page bg, so the lift comes from the shadow
              // + border, not from "see-through-ness" — the blur is what
              // makes it feel alive.
              "rounded-lg border border-border/50 bg-card/70 backdrop-blur-xl",
              PEEK_SHADOW,
              "p-3 max-w-xs",
              panelClassName,
            )}
          >
            {preview}
          </div>
        </Cursor>
      )}
    </div>
  );
}
