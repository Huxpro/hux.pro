"use client";

import type { AppLink } from "@/lib/app-icon-core";
import { LynxFrame } from "./lynx-frame";
import { WebFrame } from "./web-frame";

// =============================================================================
// AppFrame — picks the right runtime host for an app
//
//   runtime "web"  → <iframe> (WebFrame)
//   runtime "lynx" → the Lynx Player (LynxFrame), pointed at the .web.bundle
//
// Both fill the window body; the chrome around them is identical, which is the
// whole idea — one window, two runtimes.
// =============================================================================

export function AppFrame({ app }: { app: AppLink }) {
  if ((app.runtime ?? "web") === "lynx") {
    return <LynxFrame url={app.bundleUrl ?? app.url} />;
  }
  return <WebFrame url={app.url} title={app.title} />;
}
