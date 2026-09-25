"use client";

import type { AppLink, SystemAppId } from "@/lib/app-icon-core";
import {
  ProvideSurfaceContext,
  useSurfaceMode,
  type SurfacePresentation,
} from "@/systems/surface";
import { createContext, useCallback, useContext } from "react";
import { useWindows } from "../provider";

// =============================================================================
// SystemAppFrame — the body of a built-in's window (`runtime: "system"`)
//
// No frame at all: a built-in is this site's own React, rendered in this
// document, so it shares every provider with the page — the music a window
// shows is the music the dock is playing, the wallpaper it picks is the one
// behind it. That is what makes it a *system* app rather than a web app that
// happens to live on the same origin.
//
// The window system does not import the features it hosts. The layout hands
// it their bodies (SystemAppBodies), the same way it hands the dock its
// activities, so windows stays below music / ambient / theater in the graph.
//
// The body is given the surface context too, answering as a window: content
// written for a surface asks "how much room am I in" through it, and a window
// is one more place that content can land.
// =============================================================================

export type SystemAppBodies = Partial<Record<SystemAppId, React.ComponentType>>;

const BodiesContext = createContext<SystemAppBodies>({});

export function SystemAppsProvider({
  bodies,
  children,
}: {
  bodies: SystemAppBodies;
  children: React.ReactNode;
}) {
  return <BodiesContext.Provider value={bodies}>{children}</BodiesContext.Provider>;
}

/** A window is a sheet on a phone — the content should hear that, too. */
const HOST_PRESENTATION: SurfacePresentation = { base: "sheet", sm: "window" };

export function SystemAppFrame({ app }: { app: AppLink }) {
  const bodies = useContext(BodiesContext);
  const { close } = useWindows();
  const mode = useSurfaceMode(HOST_PRESENTATION, { immediate: true });
  const onClose = useCallback(() => close(app.id), [close, app.id]);
  const Body = app.system ? bodies[app.system] : undefined;

  if (!Body) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
        {app.title} is not available here
      </div>
    );
  }
  return (
    <ProvideSurfaceContext mode={mode} close={onClose}>
      <Body />
    </ProvideSurfaceContext>
  );
}
