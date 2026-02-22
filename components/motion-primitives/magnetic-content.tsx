"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useInputCapability } from "@/services";
import { Cursor } from "./cursor";

export interface MagneticContentProps {
  /** The content to display in the cursor-following panel */
  content: React.ReactNode;
  /** Optional URL — makes the entire area a link */
  href?: string;
  /** Whether to open href in new tab (default: true) */
  external?: boolean;
  /** Optional click handler — alternative to href for custom interactions (e.g. unfold media) */
  onClick?: (e: React.MouseEvent) => void;
  /** Whether to show the magnetic cursor (default: true). Click/href behavior is unaffected. */
  enabled?: boolean;
  /** Whether to hide native cursor on hover when magnetic content is shown (default: true). */
  hideNativeCursor?: boolean;
  /** Additional className for the wrapper */
  className?: string;
  /** Additional className for the cursor panel */
  cursorClassName?: string;
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

export function MagneticContent({
  content,
  href,
  external = true,
  onClick,
  enabled = true,
  hideNativeCursor = true,
  className,
  cursorClassName,
  children,
}: MagneticContentProps) {
  const { magneticPreviewEnabled } = useInputCapability();
  const showCursor = enabled && magneticPreviewEnabled;

  const cursorElement = showCursor ? (
    <Cursor
      attachToParent
      variants={defaultVariants}
      transition={defaultTransition}
      springConfig={defaultSpringConfig}
      className="overflow-hidden"
    >
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-popover/95 backdrop-blur-sm shadow-lg",
          "p-3 max-w-xs",
          cursorClassName,
        )}
      >
        {content}
      </div>
    </Cursor>
  ) : null;

  const inner = (
    <>
      {children}
      {cursorElement}
    </>
  );

  const cursorHideClass =
    showCursor && hideNativeCursor ? "[&:hover]:cursor-none" : "";

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  // onClick takes priority over href
  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleButtonKeyDown}
        className={cn(cursorHideClass, className)}
      >
        {inner}
      </div>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cn("block", cursorHideClass, className)}
      >
        {inner}
      </a>
    );
  }

  return (
    <div className={cn(cursorHideClass, className)}>{inner}</div>
  );
}
