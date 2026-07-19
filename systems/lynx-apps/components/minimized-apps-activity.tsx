"use client";

import appIconSnapshot from "@/content/app-icons.json";
import { AppKindInfo, kindForWindow } from "@/components/home/app-kind-info";
import type { AppIconSnapshot } from "@/lib/app-icon-core";
import { LiveActivity, useDock } from "@/systems/dock";
import { useLocale, type Locale } from "@/services";
import { ExternalLink, Maximize2, X } from "lucide-react";
import { getLynxApp } from "../lib/apps";
import type { OpenAppWindow } from "../lib/types";
import { useLynxApps } from "../provider";

const ICONS = appIconSnapshot as AppIconSnapshot;

function windowTitle(win: OpenAppWindow, locale: Locale): string {
  if (win.kind === "lynx") {
    const app = getLynxApp(win.appId);
    if (app) return locale === "zh" ? app.title.zh : app.title.en;
  }
  return win.title;
}

function windowIcon(win: OpenAppWindow): string | undefined {
  return ICONS[win.appId]?.file ?? (win.kind === "lynx" ? "/app-icons/lynx.png" : undefined);
}

function MinimizedAppActivity({ win }: { win: OpenAppWindow }) {
  const { locale } = useLocale();
  const { restoreWindow, closeWindow } = useLynxApps();
  const { close } = useDock();
  const title = windowTitle(win, locale);
  const icon = windowIcon(win);
  const kind = kindForWindow(win.kind, win.appId);
  const activityId = `app-${win.instanceId}`;

  const restore = () => {
    close();
    restoreWindow(win.instanceId);
  };

  return (
    <LiveActivity
      id={activityId}
      openLabel={`Open ${title}`}
      collapseLabel="Collapse"
      pill={
        <>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- dock pill art
            <img
              src={icon}
              alt=""
              className="h-6 w-6 rounded-[7px] object-cover shrink-0"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-muted text-[10px] font-mono text-muted-foreground shrink-0">
              {title.charAt(0)}
            </span>
          )}
          <span className="max-w-24 truncate text-xs font-medium text-foreground/80">
            {title}
          </span>
        </>
      }
      title={
        <span className="truncate text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      }
    >
      <div className="flex flex-col gap-3 px-5 pb-4">
        <AppKindInfo kind={kind} />

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={restore}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Maximize2 className="h-4 w-4 opacity-60" strokeWidth={2.25} />
            Restore
          </button>
          {win.kind === "web" && win.url && (
            <a
              href={win.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => close()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4 opacity-60" strokeWidth={2.25} />
              Open in browser
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              close();
              closeWindow(win.instanceId);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4 opacity-60" strokeWidth={2.25} />
            Close
          </button>
        </div>
      </div>
    </LiveActivity>
  );
}

/**
 * Parks minimized floating app windows as dock Live Activities
 * (top-of-screen pills → restore / more-info panel).
 */
export function MinimizedAppsActivity() {
  const { windows } = useLynxApps();
  const minimized = windows.filter((w) => w.minimized);

  if (minimized.length === 0) return null;

  return (
    <>
      {minimized.map((win) => (
        <MinimizedAppActivity key={win.instanceId} win={win} />
      ))}
    </>
  );
}
