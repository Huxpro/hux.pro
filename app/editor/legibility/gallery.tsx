"use client";

// =============================================================================
// Gallery — every wallpaper at once, each under its own resolved policy.
//
// A tile is an `.ink-scope`: it carries the CSS variables the provider would
// write for that wallpaper, so its ladder and relief are derived locally from
// the very same stylesheet rules. Which means a slider on the policy moves all
// forty tiles at once, and a wallpaper that reads badly is visible in a row
// with thirty-nine that read fine.
// =============================================================================

import { cn } from "@/lib/utils";
import {
  getSunEventGradient,
  getWeatherGradient,
} from "@/systems/ambient/lib/gradient";
import { legibilityCssVars, type LegibilityVars, type Theme } from "@/systems/ambient/lib/legibility";
import type { WallpaperProfile } from "@/systems/ambient/lib/wallpaper-profile";
import { WALLPAPER_PROFILES } from "@/systems/ambient/lib/wallpaper-profiles";
import { BUILT_IN_WALLPAPERS, type Wallpaper } from "@/systems/ambient/lib/wallpaper";
import type { WeatherCondition } from "@/systems/ambient/lib/weather";
import type { CSSProperties } from "react";

export type WeatherScene =
  | { kind: "weather"; condition: WeatherCondition; isDay: boolean }
  | { kind: "sun"; event: "sunrise" | "sunset" };

export type Scene = { kind: "image"; id: string } | WeatherScene;

export const WEATHER_CONDITIONS: WeatherCondition[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "thunder",
];

export const WEATHER_SCENES: WeatherScene[] = [
  ...WEATHER_CONDITIONS.flatMap((condition) => [
    { kind: "weather" as const, condition, isDay: true },
    { kind: "weather" as const, condition, isDay: false },
  ]),
  { kind: "sun", event: "sunrise" },
  { kind: "sun", event: "sunset" },
];

export function sceneKey(scene: Scene): string {
  if (scene.kind === "image") return `image:${scene.id}`;
  if (scene.kind === "sun") return `sun:${scene.event}`;
  return `weather:${scene.condition}:${scene.isDay ? "day" : "night"}`;
}

export function sceneLabel(scene: Scene): string {
  if (scene.kind === "image") return BUILT_IN_WALLPAPERS.find((w) => w.id === scene.id)?.name ?? scene.id;
  if (scene.kind === "sun") return scene.event;
  return `${scene.condition} · ${scene.isDay ? "day" : "night"}`;
}

export function sceneProfile(scene: Scene, theme: Theme): WallpaperProfile | null {
  if (scene.kind === "image") {
    const wp = BUILT_IN_WALLPAPERS.find((w) => w.id === scene.id);
    if (!wp) return null;
    const key = wp[theme].src.replace(/^\/wallpapers\//, "").replace(/\.webp$/, "");
    return WALLPAPER_PROFILES.images[key] ?? null;
  }
  const key =
    scene.kind === "sun"
      ? `${scene.event}/${theme}`
      : `${scene.condition}/${scene.isDay ? "day" : "night"}/${theme}`;
  return WALLPAPER_PROFILES.weather[key] ?? null;
}

function sceneBackground(scene: Scene, theme: Theme): string {
  if (scene.kind === "image") {
    const wp = BUILT_IN_WALLPAPERS.find((w) => w.id === scene.id) as Wallpaper;
    const asset = wp[theme];
    return `url("${asset.thumb}"), linear-gradient(${asset.base}, ${asset.base})`;
  }
  if (scene.kind === "sun") return getSunEventGradient({ event: scene.event, theme }).backgroundImage;
  return getWeatherGradient({ condition: scene.condition, isDay: scene.isDay, theme }).backgroundImage;
}

export function GalleryTile({
  scene,
  theme,
  vars,
  selected,
  onSelect,
}: {
  scene: Scene;
  theme: Theme;
  vars: LegibilityVars;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = {
    ...legibilityCssVars(vars),
    backgroundImage: sceneBackground(scene, theme),
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "ink-scope group relative aspect-[16/10] w-full overflow-hidden rounded-lg text-left",
        "ring-1 ring-border/50 transition-shadow hover:ring-border",
        selected && "ring-2 ring-foreground/60",
        vars.flip && "ink-flip",
      )}
      style={style}
    >
      <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-0.5 pt-3">
        <span className="text-[9px] font-mono tracking-wider text-muted-foreground">λhux</span>
        <span className="font-serif text-base tracking-tight text-foreground">good evening.</span>
        <span className="text-[10px] text-muted-foreground">you were reading</span>
      </div>
      <div className="absolute inset-x-3 bottom-3 rounded-md border border-border/50 bg-glass px-2 py-1.5 backdrop-blur-xl">
        <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
          writing
        </div>
        <div className="flex items-baseline justify-between text-[10px]">
          <span className="text-foreground">Ink at an alpha</span>
          <span className="font-mono text-muted-foreground">sep</span>
        </div>
      </div>
      <span className="ink-flat absolute left-2 top-2 rounded bg-black/35 px-1 py-0.5 text-[9px] font-mono text-white ring-1 ring-white/25">
        {sceneLabel(scene)}
        {vars.flip && " · flip"}
        {vars.relief > 0 && ` · r${vars.relief.toFixed(1)}`}
        {vars.inkBoost > 0 && ` · +${vars.inkBoost}`}
      </span>
    </button>
  );
}
