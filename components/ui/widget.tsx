"use client";

import { cn } from "@/lib/utils";
import { gradientTracker } from "@/systems/ambient/lib/ios-gradient-tracker";
import { EDGE_FADE_MASK, isIOSSafariBrowser } from "@/systems/ambient/lib/platform";
import { useOptionalWeather } from "@/systems/ambient/provider";
import { useOptionalDevtool } from "@/systems/devtool";
import { ArrowRight } from "lucide-react";
import { Link } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// Widget Primitives (shadcn-like compound components)
// =============================================================================

/**
 * WidgetShell - The outer container with consistent card styling.
 *
 * In "widget" gradient mode each card renders a gradient overlay using
 * the pre-computed displayedGradient from the provider context.
 * All transition logic is centralized — zero per-widget state machines.
 *
 * On desktop browsers the overlay uses background-attachment:fixed so every
 * widget "samples" the same viewport-sized gradient (hole-punch effect).
 * On iOS Safari where fixed-attachment is broken, a centralized tracker
 * batch-updates background-position via direct DOM writes (zero React
 * re-renders, no layout thrashing).
 *
 * Soft edging uses the same viewport-relative mask as the adaptive-mode
 * full-page gradient, applied via the same tracker for consistent
 * viewport-aligned fading.
 */

const WIDGET_GRADIENT_STYLE_DESKTOP: React.CSSProperties = {
  backgroundAttachment: "fixed",
  backgroundSize: "100vw 100vh",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

export function WidgetShell({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const weather = useOptionalWeather();
  const devtool = useOptionalDevtool();
  const shellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isIOSSafari] = useState(isIOSSafariBrowser);

  const isWidgetMode = weather?.gradientMode === "widget";
  const displayedGradient = weather?.displayedGradient ?? "";
  const isTransitioning = weather?.isGradientTransitioning ?? false;
  const softEdgingEnabled = weather?.softEdgingEnabled ?? true;
  const isDevtoolEnabled = devtool?.isEnabled ?? false;

  const showOverlay = isWidgetMode && !!displayedGradient;
  const isGradientVisible = showOverlay && !isTransitioning;

  const shouldApplySoftEdging =
    softEdgingEnabled && (isIOSSafari || isDevtoolEnabled);

  // iOS Safari: tracker handles background positioning (simulating fixed).
  // Soft edging: tracker handles viewport-relative mask positioning.
  // Both use the same batch read-write pattern for zero layout thrashing.
  const needsTracker = isIOSSafari || shouldApplySoftEdging;

  useEffect(() => {
    if (!needsTracker || !showOverlay) return;
    const shell = shellRef.current;
    const overlay = overlayRef.current;
    if (!shell || !overlay) return;
    return gradientTracker.register(shell, overlay, {
      positionBackground: isIOSSafari,
      edgeMask: shouldApplySoftEdging ? EDGE_FADE_MASK : undefined,
    });
  }, [needsTracker, showOverlay, isIOSSafari, shouldApplySoftEdging]);

  // On desktop (non-iOS) without tracker, use CSS background-attachment: fixed.
  // When tracker is active it handles positioning, so skip the static style.
  const overlayStyle: React.CSSProperties = {
    backgroundImage: displayedGradient,
    ...(needsTracker ? undefined : WIDGET_GRADIENT_STYLE_DESKTOP),
  };

  return (
    <div
      ref={shellRef}
      className={cn(
        "group relative rounded-2xl overflow-hidden",
        "border border-border/50",
        "transition-all duration-300",
        isWidgetMode
          ? "bg-transparent backdrop-blur-sm hover:bg-white/5 dark:hover:bg-white/5"
          : "bg-card/50 backdrop-blur-xl hover:border-border hover:bg-card/70",
        className
      )}
      style={style}
    >
      {showOverlay && (
        <div
          ref={overlayRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 -z-10",
            "transition-opacity duration-700 ease-in-out",
            isGradientVisible ? "opacity-70 dark:opacity-85" : "opacity-0"
          )}
          style={overlayStyle}
        />
      )}
      {children}
    </div>
  );
}

/**
 * WidgetHeader - Header bar with flexible content slots
 */
export function WidgetHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-5 pt-5 pb-4 flex items-center justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * WidgetTitle - Consistent title typography
 */
export function WidgetTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-xs font-mono uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * WidgetBody - Content area wrapper
 */
export function WidgetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

/**
 * WidgetLink - Navigation arrow link for header
 */
export function WidgetLink({
  href,
  label = "View all",
  variant = "icon",
}: {
  href: string;
  label?: string;
  variant?: "icon" | "text";
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center"
    >
      {variant === "icon" ? <ArrowRight className="h-3 w-3" /> : "→"}
    </Link>
  );
}

/**
 * WidgetStatus - Pulsing status indicator (e.g., for "currently working at")
 */
export function WidgetStatus({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}
