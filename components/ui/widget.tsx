"use client";

import { cn } from "@/lib/utils";
import { useOptionalWeather } from "@/systems/ambient/provider";
import { ArrowRight } from "lucide-react";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

// =============================================================================
// Widget Primitives (shadcn-like compound components)
// =============================================================================

/**
 * WidgetShell - The outer container with consistent card styling
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
  const [displayedGradient, setDisplayedGradient] = useState<string>("");
  const [isGradientTransitioning, setIsGradientTransitioning] = useState(false);

  const isWidgetGradientEnabled = weather?.gradientMode === "widget";
  const gradient = weather?.gradient ?? "";
  const isFetching = weather?.isFetching ?? false;

  useEffect(() => {
    if (isFetching) return;
    if (gradient === displayedGradient) return;
    if (!gradient) return;

    if (!displayedGradient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayedGradient(gradient);
      return;
    }

    setIsGradientTransitioning(true);

    const timeout = setTimeout(() => {
      setDisplayedGradient(gradient);
      requestAnimationFrame(() => {
        setIsGradientTransitioning(false);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [gradient, displayedGradient, isFetching]);

  const isGradientVisible = isWidgetGradientEnabled && !isGradientTransitioning;
  const widgetGradientStyle = displayedGradient
    ? {
        backgroundImage: displayedGradient,
        // Keep viewport scale to preserve the same visual "hole-punch" feel.
        backgroundSize: "100vw 100vh",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }
    : undefined;

  return (
    <div
      className={cn(
        "group relative isolate rounded-2xl overflow-hidden",
        "bg-card/50 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300",
        "hover:border-border hover:bg-card/70",
        isWidgetGradientEnabled && "bg-transparent hover:bg-transparent",
        className
      )}
      style={style}
    >
      {displayedGradient && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0",
            "transition-opacity duration-700 ease-in-out",
            isGradientVisible ? "opacity-70 dark:opacity-85" : "opacity-0"
          )}
          style={widgetGradientStyle}
        />
      )}
      <div className="relative z-10">{children}</div>
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
