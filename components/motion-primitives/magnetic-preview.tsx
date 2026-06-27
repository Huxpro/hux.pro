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
          className="overflow-hidden rounded-lg"
        >
          <div
            className={cn(
              "rounded-lg border border-border/60 bg-popover/95 backdrop-blur-sm shadow-lg",
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
