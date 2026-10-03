"use client";

import type { AppLink } from "@/lib/app-icon-core";
import { appTitle } from "@/lib/app-icon-core";
import { useLocale } from "@/services";
import { LynxFrame } from "./lynx-frame";
import { WebFrame } from "./web-frame";
import { NightmareLabView } from "@/app/lab/nightmare/view";

// =============================================================================
// AppFrame: picks the right runtime host for an app
//
//   runtime "web"  → <iframe> (WebFrame)
//   runtime "lynx" → the Lynx Player (LynxFrame), pointed at the .web.bundle
//
// Both fill the window body, and the chrome around them is identical: one
// window, two runtimes.
// =============================================================================

/**
 * The ground an app sits on, which belongs with the runtime that decides it: a
 * Lynx view paints on black, a web page on the site's background. Both window
 * shapes ask here rather than each keeping their own copy of the rule.
 */
export function appGround(app: AppLink): string {
  if (app.id === "nightmare") return "bg-black";
  return (app.runtime ?? "web") === "lynx" ? "bg-black" : "bg-background";
}

export function AppFrame({ app }: { app: AppLink }) {
  const { locale } = useLocale();
  if (app.id === "nightmare") {
    return <NightmareLabView embedded />;
  }
  if ((app.runtime ?? "web") === "lynx") {
    return <LynxFrame url={app.bundleUrl ?? app.url} />;
  }
  return <WebFrame url={app.url} title={appTitle(app, locale)} />;
}
