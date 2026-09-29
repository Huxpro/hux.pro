"use client";

import { LoadingIndicator } from "@/systems/skin/components/loading-indicator";
import dynamic from "next/dynamic";

// =============================================================================
// LynxFrame — SSR-safe boundary around the Lynx Player
//
// <lynx-view> and its runtime instantiate Web Workers the moment their module
// is imported, so the player can't touch the server. `next/dynamic` with
// `ssr: false` defers the whole module (and its side-effect imports) to the
// client, showing a quiet loading state until the runtime is live.
// =============================================================================

const LynxPlayer = dynamic(() => import("./lynx-player"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/80 material:hidden" />
      {/* Android's app-loading state: the Expressive indicator, contained. */}
      <LoadingIndicator contained className="hidden material:inline-block" />
    </div>
  ),
});

export function LynxFrame({ url }: { url: string }) {
  return <LynxPlayer url={url} />;
}
