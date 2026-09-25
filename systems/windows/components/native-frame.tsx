"use client";

import type { AppLink, NativeSurface } from "@/lib/app-icon-core";
import {
  MusicSurface,
  PromptSurface,
  WallpaperSurface,
  WatchSurface,
  WritingSurface,
} from "./native-surfaces";

const SURFACES: Record<NativeSurface, () => React.ReactNode> = {
  watch: () => <WatchSurface />,
  music: () => <MusicSurface />,
  wallpaper: () => <WallpaperSurface />,
  writing: () => <WritingSurface />,
  prompt: () => <PromptSurface />,
};

/**
 * NativeFrame — an in-process app. Same window as a web iframe or a Lynx
 * player; the body is a surface the site already has.
 */
export function NativeFrame({ app }: { app: AppLink }) {
  const surface = app.surface;
  if (!surface) return null;
  return SURFACES[surface]();
}
