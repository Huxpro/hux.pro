"use client";

import { cn } from "@/lib/utils";
import { fixedBgTracker } from "@/systems/ambient/lib/fixed-bg-tracker";
import { EDGE_FADE_MASK, isIOSBrowser } from "@/systems/ambient/lib/platform";
import { useOptionalWeather } from "@/systems/ambient/provider";
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
 * Background positioning uses one of two mutually-exclusive strategies:
 *   - Desktop: CSS `background-attachment: fixed` (zero JS overhead)
 *   - iOS:     JS polyfill via fixedBgTracker (CSS is broken on all iOS browsers)
 *
 * Soft edging (viewport-relative mask) always goes through the tracker
 * regardless of platform, and can coexist with the CSS strategy on desktop.
 */
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
  const shellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const widgetGradientEnabled = weather?.widgetGradientEnabled ?? false;
  const displayedGradient = weather?.displayedGradient ?? "";
  const isTransitioning = weather?.isGradientTransitioning ?? false;
  const softEdgingEnabled = weather?.softEdgingEnabled ?? false;

  const showOverlay = widgetGradientEnabled && !!displayedGradient;
  const isGradientVisible = showOverlay && !isTransitioning;

  // background-attachment: fixed is broken on all iOS browsers.
  // When true  → JS polyfill positions the background (no CSS fixed).
  // When false → CSS fixed handles positioning (no JS polyfill).
  const [useTrackerForPositioning] = useState(isIOSBrowser);

  useEffect(() => {
    if (!showOverlay) return;
    if (!useTrackerForPositioning && !softEdgingEnabled) return;
    const shell = shellRef.current;
    const overlay = overlayRef.current;
    if (!shell || !overlay) return;
    return fixedBgTracker.register(shell, overlay, {
      positionBackground: useTrackerForPositioning,
      edgeMask: softEdgingEnabled ? EDGE_FADE_MASK : undefined,
    });
  }, [showOverlay, useTrackerForPositioning, softEdgingEnabled]);

  const overlayStyle: React.CSSProperties = {
    backgroundImage: displayedGradient,
    ...(!useTrackerForPositioning && {
      backgroundAttachment: "fixed",
      backgroundSize: "100vw 100vh",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }),
  };

  return (
    <div
      ref={shellRef}
      className={cn(
        "group relative rounded-2xl overflow-hidden",
        "border border-border/50",
        "transition-all duration-300",
        widgetGradientEnabled
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
