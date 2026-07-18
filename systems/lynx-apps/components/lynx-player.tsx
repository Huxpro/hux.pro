"use client";

import { useEffect, useId, useState } from "react";
import type { LynxApp } from "../lib/apps";

type ExampleMetadata = {
  templateFiles?: Array<{
    name: string;
    file: string;
    webFile?: string;
  }>;
};

function preferredEntryName(app: LynxApp): string | undefined {
  if (app.id === "bankcards") return "final";
  if (app.id === "animation") return "keyframe_spring";
  return undefined;
}

/**
 * Lynx Player — hosts a same-origin `.web.bundle` in `<lynx-view>` directly.
 * Avoids `@lynx-js/go-web` chrome (and Semi UI global styles) so example CSS
 * is not crushed by host overrides.
 */
export function LynxPlayer({ app }: { app: LynxApp }) {
  const reactId = useId();
  const groupId = Math.abs(
    Array.from(reactId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
  );
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@lynx-js/web-core/client")
      .then(() => {
        if (!cancelled) setRuntimeReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load Lynx runtime");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/lynx-examples/${app.id}/example-metadata.json`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const meta = (await res.json()) as ExampleMetadata;
        const prefer = preferredEntryName(app);
        const entry =
          (prefer
            ? meta.templateFiles?.find((t) => t.name === prefer && t.webFile)
            : undefined) ??
          meta.templateFiles?.find((t) => t.webFile) ??
          meta.templateFiles?.[0];
        if (!entry?.webFile) throw new Error("No web bundle in metadata");
        if (!cancelled) {
          setSrc(
            `${window.location.origin}/lynx-examples/${app.id}/${entry.webFile}`,
          );
        }
      } catch {
        if (!cancelled) setError("Failed to load example bundle");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [app]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-mono text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!runtimeReady || !src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs font-mono text-muted-foreground">
        Loading Lynx…
      </div>
    );
  }

  return (
    <div className="lynx-player h-full w-full min-h-0 overflow-hidden bg-black">
      <lynx-view
        key={src}
        url={src}
        // Unique group per player instance so concurrent windows don't collide.
        lynx-group-id={groupId || 42}
        transform-vh={true}
        transform-vw={true}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          // Container-relative units for Lynx (matches go-web responsive mode).
          containerType: "size",
          ["--rpx-unit" as string]: "calc(100cqw / 750)",
          ["--vh-unit" as string]: "1cqh",
          ["--vw-unit" as string]: "1cqw",
        }}
      />
    </div>
  );
}
