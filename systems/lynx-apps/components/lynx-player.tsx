"use client";

import { Go, GoConfigProvider } from "@lynx-js/go-web";
import { useTheme } from "@/services";
import { useMemo } from "react";
import type { LynxApp } from "../lib/apps";

/**
 * Lynx Player — go-web in preview-only mode, loading the example's web bundle
 * via <lynx-view> (not a third-party iframe "app").
 */
export function LynxPlayer({ app }: { app: LynxApp }) {
  const { theme } = useTheme();

  const config = useMemo(
    () => ({
      exampleBasePath: "/lynx-examples",
      defaultTab: "web" as const,
      useDark: () => theme === "dark",
    }),
    [theme],
  );

  // Prefer the polished entry for multi-bundle examples
  const defaultEntryName =
    app.id === "bankcards"
      ? "final"
      : app.id === "animation"
        ? "keyframe_spring"
        : undefined;

  return (
    <div className="lynx-player h-full w-full min-h-0 overflow-hidden bg-background">
      <GoConfigProvider config={config}>
        <Go
          example={app.id}
          defaultFile={app.defaultFile}
          defaultEntryName={defaultEntryName}
          mode="preview"
          defaultTab="web"
          webPreviewMode="responsive"
          designWidth={390}
          designHeight={720}
        />
      </GoConfigProvider>
    </div>
  );
}
