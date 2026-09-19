"use client";

import { APP_ICONS, iconFillsTile } from "@/lib/apps";
import type { AppLink } from "@/lib/app-icon-core";
import { appTitle, resolveAppIconSrc } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { AppBadgeFor } from "@/systems/windows/components/app-badge";

import { TYPE } from "@/lib/typography";
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
  md: "mt-1.5 max-w-16",
  lg: "mt-1.5 max-w-18",
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
  const { locale } = useLocale();
  const label = appTitle(app, locale);
  const entry = APP_ICONS[app.id];
  const fills = iconFillsTile(entry);
  const src = resolveAppIconSrc(app, APP_ICONS);
  const px = TILE_PX[size];

  return (
    <span className={cn("flex w-full flex-col items-center overflow-visible", className)}>
      <span className="relative block overflow-visible" style={{ width: px, height: px }}>
        {/* Scale a wrapper *outside* the rounded clip so overflow:hidden +
            transform don't shear the squircle (or the badge that hangs off
            the corner) against a clipping ancestor. */}
        <span
          className={cn(
            "block origin-center",
            "transition-transform duration-200",
            "group-hover/app:scale-105 group-focus-visible/app:scale-105",
          )}
        >
          <span
            className={cn(
              "relative block overflow-hidden",
              RADIUS[size],
              "border border-black/8 dark:border-white/12",
              // Padded glyphs need a white plate; full-bleed icons bring their
              // own background (a plate would fringe the rounded clip).
              !fills && "bg-white",
              // Touch-down dim, iOS-style: a dark wash over the art the
              // instant the icon is pressed, easing off on release. Driven by
              // the enclosing `group/app` link's `:active` (which is
              // `pressable`, so the wash lands on the press frame).
              "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit]",
              "after:bg-black/0 after:transition-colors after:duration-200",
              "group-active/app:after:bg-black/30 group-active/app:after:duration-0",
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
              <span
                className="flex h-full w-full items-center justify-center font-mono text-neutral-400"
                style={{ fontSize: Math.max(12, px * 0.35) }}
              >
                {label.charAt(0)}
              </span>
            )}
          </span>
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
            "block truncate text-center select-none",
            TYPE.appLabel,
            LABEL[size],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
