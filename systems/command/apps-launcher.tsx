"use client";

import { AppTile } from "@/components/apps";
import { APPS } from "@/lib/apps";
import { runtimeLabel } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useOptionalWindows } from "@/systems/windows";
import { Command } from "cmdk";
import { Link2 } from "lucide-react";

// =============================================================================
// Command Apps surfaces — Spotlight-style dual-purpose launcher
//
// Two dedicated presentations for the same catalog:
//   1. AppsGrid   — empty-query browse mode: icon springboard (Launchpad-ish)
//   2. AppsList   — filtered search mode: compact icon + title rows
//
// Both launch through WindowProvider when available.
// =============================================================================

const itemClass = cn(
  "rounded-lg text-sm cursor-pointer transition-colors",
  "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
  "hover:bg-accent/25",
);

export function CommandAppsGrid({ onLaunch }: { onLaunch: () => void }) {
  const windows = useOptionalWindows();
  const { locale } = useLocale();
  if (!windows || APPS.length === 0) return null;

  return (
    <Command.Group
      heading={t(locale, "appsGroup")}
      className="[&_[cmdk-group-heading]]:px-2"
    >
      {/* cmdk still owns keyboard selection; we only restyle the items into a
          springboard grid so empty-query ⌘K doubles as an app launcher. */}
      <div className="grid grid-cols-4 gap-1 px-1 pb-1 sm:grid-cols-5">
        {APPS.map((app) => {
          const kind = runtimeLabel(app);
          return (
            <Command.Item
              key={`app-grid-${app.id}`}
              value={`app-${app.id}`}
              keywords={[
                app.title,
                app.id,
                "app",
                "apps",
                "应用",
                kind,
                app.runtime ?? "web",
              ]}
              onSelect={() => {
                windows.openApp(app);
                onLaunch();
              }}
              className={cn(
                itemClass,
                "group/app flex flex-col items-center justify-center gap-0 px-1 py-2",
                "data-[selected=true]:bg-accent/50",
              )}
            >
              <AppTile app={app} size="md" revealBadge showLabel />
            </Command.Item>
          );
        })}
        <Command.Item
          key="app-load-bundle-grid"
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
            const url = window.prompt(
              "Lynx .web.bundle URL (over-the-air)",
            );
            if (url) windows.openBundleUrl(url.trim());
            onLaunch();
          }}
          className={cn(
            itemClass,
            "flex flex-col items-center justify-center gap-0 px-1 py-2",
          )}
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

export function CommandAppsList({ onLaunch }: { onLaunch: () => void }) {
  const windows = useOptionalWindows();
  const { locale } = useLocale();
  if (!windows || APPS.length === 0) return null;

  return (
    <Command.Group heading={t(locale, "appsGroup")}>
      {APPS.map((app) => {
        const kind = runtimeLabel(app);
        return (
          <Command.Item
            key={`app-list-${app.id}`}
            value={`app-${app.id}`}
            keywords={[
              app.title,
              app.id,
              "app",
              "apps",
              "应用",
              kind,
              app.runtime ?? "web",
            ]}
            onSelect={() => {
              windows.openApp(app);
              onLaunch();
            }}
            className={cn(itemClass, "group/app flex items-center gap-3 px-3 py-2")}
          >
            <AppTile app={app} size="sm" showLabel={false} revealBadge />
            <span className="flex-1 truncate">{app.title}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
              {kind}
            </span>
          </Command.Item>
        );
      })}
      <Command.Item
        key="app-load-bundle-list"
        value="app-load-bundle"
        keywords={["lynx", "bundle", "url", "over the air", "ota", "load"]}
        onSelect={() => {
          const url = window.prompt(
            "Lynx .web.bundle URL (over-the-air)",
          );
          if (url) windows.openBundleUrl(url.trim());
          onLaunch();
        }}
        className={cn(itemClass, "flex items-center gap-3 px-3 py-2.5")}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[22.5%] border border-dashed border-border/70 bg-muted/30 text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1">{t(locale, "appsLoadBundle")}</span>
      </Command.Item>
    </Command.Group>
  );
}
