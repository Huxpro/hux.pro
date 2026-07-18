"use client";

// The two side-effect imports that (a) register the <lynx-view> custom element
// and its background-thread runtime and (b) bring in element styles. Both spin
// up Web Workers at import time, so this module must only ever load in the
// browser — it's reached exclusively through the `ssr: false` dynamic import in
// lynx-frame.tsx.
import "@lynx-js/web-elements/index.css";
import "@lynx-js/web-core/client";

import { useEffect, useRef, useState } from "react";
import type { LynxViewElement } from "@lynx-js/web-core/client";

// =============================================================================
// LynxPlayer — a Lynx Player: renders a `.web.bundle` via <lynx-view>
//
// This is the Lynx-runtime analogue of the web iframe. `@lynx-js/web-core`
// runs the bundle's script on a background Web Worker and paints its element
// tree into the <lynx-view> host on the main thread — the same dual-thread
// model Lynx uses on-device, faithfully reproduced in the browser.
// =============================================================================

export default function LynxPlayer({ url }: { url: string }) {
  const ref = useRef<LynxViewElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onError = (e: Event) => {
      // The element fires a CustomEvent on load/runtime failure.
      const detail = (e as CustomEvent).detail;
      setError(
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "The Lynx bundle failed to load."),
      );
    };
    el.addEventListener("error", onError);
    return () => el.removeEventListener("error", onError);
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-foreground/80">
          Couldn&apos;t start the Lynx app
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <lynx-view
      ref={ref}
      url={url}
      // Fill the window body; the bundle drives its own internal layout.
      style={{ display: "block", height: "100%", width: "100%" }}
    />
  );
}
