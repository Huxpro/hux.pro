"use client";

import { GLASS_PANEL } from "@/lib/glass";
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

// Peeks sit at the `raised` elevation — the same low lift as the FAB and the
// Live Activity pill, one level below the `overlay` surfaces (command palette,
// Live Activity expanded). Surfaces just use the `shadow-raised` utility
// directly (see the elevation spec in globals.css); there's no separate peek
// shadow token.

/**
 * Unified content width for every hover-peek surface — link card, video /
 * image poster, writing card, details fallback, and the stacked deck. A
 * cursor-following preview wants to read clearly without feeling like a
 * modal: 24rem / 384px fits a 16:9 poster (384×216) and a comfortable text
 * measure, and reads as roomy for an OG card. One width → the peeks feel
 * like one system. (Matches the `sm` step of the media size scale.)
 */
export const PEEK_W = "w-96"; // 24rem · 384px

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
          // `shadow-raised` lift breathe.
        >
          <div
            className={cn(
              // Translucent lifted surface. No shadow here on purpose: the
              // shadow belongs to whatever is the *visible* surface.
              // Panel-as-card peeks (writing / details) add `shadow-raised`
              // themselves; peeks that strip this chrome (deck / single card /
              // video) let their inner card/thumb cast the shadow — so the
              // deck, an irregular rotated stack, never gets a rectangular
              // container shadow around it.
              GLASS_PANEL,
              // Default cap fits the unified peek width (PEEK_W = 384); peeks
              // no longer need to lift a narrower default.
              "p-3 max-w-md",
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
