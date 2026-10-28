"use client";

import { AppTile } from "@/components/apps";
import { APPS } from "@/lib/apps";
import { appTitle, runtimeLabel } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useOptionalWindows } from "@/systems/windows";
import { Command, useCommandState } from "cmdk";
import { Link2 } from "lucide-react";
import { useCommand } from "./provider";
import { exactKeywords, scorePaletteItem } from "./search-filter";
import { useCompactViewport } from "./use-compact-viewport";

// CommandAppsStrip: Spotlight-style horizontal app launcher
//
// One presentation for browse *and* search: a tight horizontal icon strip
// (scrolls when the catalog overflows). cmdk filters items in place; when
// nothing matches the group hides entirely (no empty Apps section).
// No group heading; the icons are enough on their own.
// =============================================================================

const LOAD_BUNDLE_VALUE = "app-load-bundle";
const LOAD_BUNDLE_KEYWORDS = [
  "bundle",
  "url",
  "over the air",
  "ota",
  "load",
  ...exactKeywords(["app", "apps", "应用", "lynx"]),
];

export function CommandAppsStrip({ onLaunch }: { onLaunch: () => void }) {
  const windows = useOptionalWindows();
  const { locale } = useLocale();
  const { openLoadBundle } = useCommand();
  const compact = useCompactViewport();
  const search = useCommandState((state) => state.search);
  const appItems = APPS.map((app) => ({
    app,
    value: `app-${app.id}`,
    keywords: [
      app.title,
      appTitle(app, "zh"),
      app.id,
      ...(app.keywords ?? []),
      ...exactKeywords([
        "app",
        "apps",
        "应用",
        runtimeLabel(app),
        app.runtime ?? "web",
      ]),
    ],
  }));
  const visibleApps = search.trim()
    ? appItems.filter(({ value, keywords }) =>
        scorePaletteItem(value, search, keywords),
      )
    : appItems;
  const showLoadBundle =
    !search.trim() ||
    scorePaletteItem(LOAD_BUNDLE_VALUE, search, LOAD_BUNDLE_KEYWORDS) > 0;
  const itemClass = cn(
    "group/app shrink-0 rounded-xl",
    "flex flex-col items-center justify-center",
    // Phone: ~5.3 columns so iPhone 16 Pro (402 CSS px) shows five tiles
    // and a sliver of the sixth, enough to hint that the strip scrolls.
    // Desktop keeps the original 4.25rem pitch.
    compact
      ? "w-[calc((100%-8px)/5.3)] max-w-[4.25rem] px-0.5 py-1.5"
      : "w-[4.25rem] px-1 py-1.5",
    "cursor-pointer transition-colors",
    "text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground",
    "hover:bg-accent/25",
  );
  if (!windows || (visibleApps.length === 0 && !showLoadBundle)) return null;

  return (
    <Command.Group>
      <div
        className={cn(
          // Fixed-pitch icon strip: tight on desktop, scrolls when needed.
          "no-scrollbar flex gap-0.5 overflow-x-auto px-1.5 py-1.5",
        )}
      >
        {visibleApps.map(({ app, value, keywords }) => {
          return (
            <Command.Item
              key={`app-${app.id}`}
              value={value}
              keywords={keywords}
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
        {showLoadBundle && (
          <Command.Item
            key={LOAD_BUNDLE_VALUE}
            value={LOAD_BUNDLE_VALUE}
            keywords={LOAD_BUNDLE_KEYWORDS}
            onSelect={() => {
              // Stay inside the palette chrome and morph into the Load Bundle panel.
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
        )}
      </div>
    </Command.Group>
  );
}

/** @deprecated Use {@link CommandAppsStrip}, the single strip for browse + search. */
export const CommandAppsGrid = CommandAppsStrip;
/** @deprecated Use {@link CommandAppsStrip}. The list view was removed. */
export const CommandAppsList = CommandAppsStrip;
