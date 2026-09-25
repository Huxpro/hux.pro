"use client";

import type { AppLink } from "@/lib/app-icon-core";
import { appTitle } from "@/lib/app-icon-core";
import { useLocale } from "@/services";
import { LynxFrame } from "./lynx-frame";
import { PageFrame } from "./page-frame";
import { SystemAppFrame } from "./system-app-frame";
import { WebFrame } from "./web-frame";

// =============================================================================
// AppFrame — picks the right runtime host for an app
//
//   runtime "web"    → <iframe> (WebFrame)
//   runtime "lynx"   → the Lynx Player (LynxFrame), pointed at the .web.bundle
//   runtime "system" → a built-in's own component, in this document
//   runtime "page"   → a route of this site, shrunk (PageFrame)
//
// All fill the window body; the chrome around them is identical, which is the
// whole idea — one window, whatever runs in it.
// =============================================================================

/**
 * The ground an app sits on, which belongs with the runtime that decides it: a
 * Lynx view paints on black, a web page on the site's background. Both window
 * shapes ask here rather than each keeping their own copy of the rule.
 */
export function appGround(app: AppLink): string {
  const runtime = app.runtime ?? "web";
  // A stage is dark whatever the theme — a video letterboxes on black.
  if (runtime === "lynx" || app.system === "theater") return "bg-black";
  return "bg-background";
}

export function AppFrame({ app }: { app: AppLink }) {
  const { locale } = useLocale();
  if (app.runtime === "system") return <SystemAppFrame app={app} />;
  if (app.runtime === "page") return <PageFrame app={app} />;
  if ((app.runtime ?? "web") === "lynx") {
    return <LynxFrame url={app.bundleUrl ?? app.url} />;
  }
  return <WebFrame url={app.url} title={appTitle(app, locale)} />;
}
