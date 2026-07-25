"use client";

import { APP_ICONS, iconFillsTile } from "@/lib/apps";
import type { AppLink } from "@/lib/app-icon-core";
import { resolveAppIconSrc } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { AppBadgeFor } from "@/systems/windows";

// =============================================================================
// AppTile — shared home-screen icon visual
//
// One tile art path for the App Folder, ⌘K Apps launcher, and any future
// surface that needs the OS-style icon (+ optional runtime badge + label).
// =============================================================================

export type AppTileSize = "sm" | "md" | "lg";

const TILE_PX: Record<AppTileSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

const RADIUS: Record<AppTileSize, string> = {
  sm: "rounded-[22.5%]",
  md: "rounded-[22.5%]",
  lg: "rounded-[22.5%]",
};

const PAD: Record<AppTileSize, string> = {
  sm: "p-1",
  md: "p-2",
  lg: "p-3",
};

const BADGE: Record<AppTileSize, number> = {
  sm: 12,
  md: 16,
  lg: 20,
};

const LABEL: Record<AppTileSize, string> = {
  sm: "mt-1 max-w-14 text-[10px]",
  md: "mt-1.5 max-w-16 text-[11px]",
  lg: "mt-1.5 max-w-18 text-[11px]",
};

export function AppTile({
  app,
  size = "lg",
  showLabel = true,
  revealBadge = false,
  className,
}: {
  app: AppLink;
  size?: AppTileSize;
  showLabel?: boolean;
  /** Force the runtime badge visible (jiggle-edit, drag clone, always-on). */
  revealBadge?: boolean;
  className?: string;
}) {
  const entry = APP_ICONS[app.id];
  const fills = iconFillsTile(entry);
  const src = resolveAppIconSrc(app, APP_ICONS);
  const px = TILE_PX[size];

  return (
    <span className={cn("flex w-full flex-col items-center", className)}>
      <span className="relative block" style={{ width: px, height: px }}>
        <span
          className={cn(
            "block overflow-hidden",
            RADIUS[size],
            "border border-black/8 dark:border-white/12",
            // Padded glyphs need a white plate; full-bleed icons bring their
            // own background (a plate would fringe the rounded clip).
            !fills && "bg-white",
            "transition-transform duration-200 group-hover/app:scale-105",
          )}
          style={{ width: px, height: px }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny local static asset; next/image adds nothing at these sizes
            <img
              src={src}
              alt=""
              draggable={false}
              className={cn(
                "h-full w-full",
                fills ? "object-cover" : cn("object-contain", PAD[size]),
              )}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-neutral-400"
              style={{ fontSize: Math.max(12, px * 0.35) }}
            >
              {app.title.charAt(0)}
            </span>
          )}
        </span>
        <AppBadgeFor
          app={app}
          size={BADGE[size]}
          className={cn(
            "pointer-events-none absolute -bottom-1 -right-1",
            "transition-all duration-200",
            "group-hover/app:opacity-100 group-hover/app:scale-100",
            "group-focus-visible/app:opacity-100 group-focus-visible/app:scale-100",
            revealBadge ? "opacity-100 scale-100" : "opacity-0 scale-90",
          )}
        />
      </span>
      {showLabel && (
        <span
          className={cn(
            "block truncate text-center leading-tight text-muted-foreground",
            LABEL[size],
          )}
        >
          {app.title}
        </span>
      )}
    </span>
  );
}
