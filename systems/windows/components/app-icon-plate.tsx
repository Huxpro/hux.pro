"use client";

import { appTitle, resolveAppIconSrc, type AppLink } from "@/lib/app-icon-core";
import { APP_ICONS, iconFillsTile } from "@/lib/apps";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { BuiltinMark } from "./builtin-mark";

// =============================================================================
// AppIconPlate — an app's icon at any size, with the site's one rule about it
//
// Full-bleed art fills its tile and brings its own ground; a glyph gets a plate
// under it and a little padding, so a dark mark stays visible on a dark page;
// an app with no icon at all shows its initial. That rule was being written out
// again wherever an app is drawn small — the minimized dock pill, the window
// menu's header — and the copies were already differing in what a missing icon
// looks like. The size and anything around it (the dock's runtime badge) stay
// with the caller; only the rule lives here.
// =============================================================================

export function AppIconPlate({
  app,
  className,
  textClassName,
}: {
  app: AppLink;
  /** The size, and the corner: `h-6 w-6 rounded-[7px]` and so on. */
  className?: string;
  /** Size of the initial, for the app that has no icon. */
  textClassName?: string;
}) {
  const { locale } = useLocale();
  const src = resolveAppIconSrc(app, APP_ICONS);
  const fills = iconFillsTile(APP_ICONS[app.id]);

  if (!src && app.runtime === "native" && app.surface) {
    return (
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-[7px] bg-white",
          className,
        )}
      >
        <BuiltinMark surface={app.surface} className="h-[58%] w-[58%]" />
      </span>
    );
  }

  if (!src) {
    return (
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-[7px] bg-muted font-mono text-muted-foreground",
          className,
          textClassName,
        )}
      >
        {appTitle(app, locale).charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local static asset
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn(
        "overflow-hidden rounded-[7px]",
        fills ? "object-cover" : "bg-white object-contain p-0.5",
        className,
      )}
    />
  );
}
