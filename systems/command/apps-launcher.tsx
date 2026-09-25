"use client";

import { AppTile } from "@/components/apps";
import { APPS } from "@/lib/apps";
import { appTitle, runtimeLabel } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { BUILTIN_APPS, useOptionalWindows, useUnifiedWindows } from "@/systems/windows";
import { Command } from "cmdk";
import { Link2 } from "lucide-react";
import { useCommand } from "./provider";
import { useCompactViewport } from "./use-compact-viewport";

// =============================================================================
// CommandAppsStrip — Spotlight-style horizontal app launcher
//
// One presentation for browse *and* search: a tight horizontal icon strip
// (scrolls when the catalog overflows). cmdk filters items in place; when
// nothing matches the group hides entirely (no empty Apps section).
// No group heading — the icons speak for themselves.
// =============================================================================

export function CommandAppsStrip({ onLaunch }: { onLaunch: () => void }) {
  const windows = useOptionalWindows();
  const { locale } = useLocale();
  const { openLoadBundle } = useCommand();
  const compact = useCompactViewport();
  // Unified windows: the site's own features and pages are apps too, first.
  const unified = useUnifiedWindows();
  const apps = unified ? [...BUILTIN_APPS, ...APPS] : APPS;
  const itemClass = cn(
    "group/app shrink-0 rounded-xl",
    "flex flex-col items-center justify-center",
    // Phone: ~5.3 columns so iPhone 16 Pro (402 CSS px) shows five tiles
    // and a sliver of the sixth — enough to hint the strip scrolls.
    // Desktop keeps the original 4.25rem pitch.
    compact
      ? "w-[calc((100%-8px)/5.3)] max-w-[4.25rem] px-0.5 py-1.5"
      : "w-[4.25rem] px-1 py-1.5",
    "cursor-pointer transition-colors",
    "text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground",
    "hover:bg-accent/25",
  );
  if (!windows || apps.length === 0) return null;

  return (
    <Command.Group>
      <div
        className={cn(
          // Fixed-pitch icon strip: tight on desktop, scrolls when needed.
          "no-scrollbar flex gap-0.5 overflow-x-auto px-1.5 py-1.5",
        )}
      >
        {apps.map((app) => {
          const kind = runtimeLabel(app);
          return (
            <Command.Item
              key={`app-${app.id}`}
              value={`app-${app.id}`}
              keywords={[
                app.title,
                appTitle(app, "zh"),
                app.id,
                "app",
                "apps",
                "应用",
                kind,
                app.runtime ?? "web",
                ...(app.keywords ?? []),
              ]}
              onSelect={() => {
                windows.openApp(app);
                onLaunch();
              }}
              className={itemClass}
            >
              <AppTile app={app} size="md" revealBadge showLabel />
            </Command.Item>
          );
        })}
        <Command.Item
          key="app-load-bundle"
          value="app-load-bundle"
          keywords={[
            "lynx",
            "bundle",
            "url",
            "over the air",
            "ota",
            "load",
            "app",
            "apps",
          ]}
          onSelect={() => {
            // Stay inside the palette chrome — morph into the Load Bundle panel.
            openLoadBundle();
          }}
          className={itemClass}
        >
          <span className="flex w-full flex-col items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[22.5%] border border-dashed border-border/70 bg-muted/30 text-muted-foreground">
              <Link2 className="h-5 w-5" />
            </span>
            <span className="mt-1.5 block max-w-16 truncate text-center text-[11px] leading-tight text-muted-foreground">
              {locale === "zh" ? "加载包" : "Load…"}
            </span>
          </span>
        </Command.Item>
      </div>
    </Command.Group>
  );
}

/** @deprecated Use {@link CommandAppsStrip} — single strip for browse + search. */
export const CommandAppsGrid = CommandAppsStrip;
/** @deprecated Use {@link CommandAppsStrip} — list view removed. */
export const CommandAppsList = CommandAppsStrip;
