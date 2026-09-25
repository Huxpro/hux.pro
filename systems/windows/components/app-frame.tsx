"use client";

import type { AppLink } from "@/lib/app-icon-core";
import { appTitle } from "@/lib/app-icon-core";
import { useLocale } from "@/services";
import { LynxFrame } from "./lynx-frame";
import { NativeFrame } from "./native-frame";
import { WebFrame } from "./web-frame";

// =============================================================================
// AppFrame — picks the right runtime host for an app
//
//   runtime "web"    → <iframe> (WebFrame)
//   runtime "lynx"   → the Lynx Player (LynxFrame), pointed at the .web.bundle
//   runtime "native" → an in-process surface (NativeFrame)
//
// All three fill the window body; the chrome around them is identical.
// =============================================================================

/**
 * The ground an app sits on, which belongs with the runtime that decides it: a
 * Lynx view paints on black, a web page on the site's background. Both window
 * shapes ask here rather than each keeping their own copy of the rule.
 */
export function appGround(app: AppLink): string {
  const runtime = app.runtime ?? "web";
  if (runtime === "lynx" || app.surface === "watch") return "bg-black";
  return "bg-background";
}

export function AppFrame({ app }: { app: AppLink }) {
  const { locale } = useLocale();
  const runtime = app.runtime ?? "web";
  if (runtime === "lynx") {
    return <LynxFrame url={app.bundleUrl ?? app.url} />;
  }
  if (runtime === "native") return <NativeFrame app={app} />;
  return <WebFrame url={app.url} title={appTitle(app, locale)} />;
}
