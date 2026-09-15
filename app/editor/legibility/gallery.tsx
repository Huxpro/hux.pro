"use client";

// =============================================================================
// Gallery — every wallpaper at once, each under its own resolved policy.
//
// A tile is an `.ink-scope`: it carries the CSS variables the provider would
// write for that wallpaper, so its ladder and relief are derived locally from
// the very same stylesheet rules. Which means a slider on the policy moves all
// forty tiles at once, and a wallpaper that reads badly is visible in a row
// with thirty-nine that read fine.
//
// Weather tiles are scenes: a condition at a time of day (noon, one in the
// morning, sunrise, sunset) for the visitor's coordinates, derived by the
// same `deriveWeatherScene` the page uses and profiled the same way
// (`profileFromScene`; Classic keeps its measured table). The tile paints the
// style's CSS gradient — for the Sky that is the Gradient it falls back to,
// the same palette without the shader's texture.
// =============================================================================

import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getWeatherStyleGradient } from "@/systems/ambient/lib/gradient";
import {
  legibilityCssVars,
  profileFromScene,
  type LegibilityVars,
  type Theme,
} from "@/systems/ambient/lib/legibility";
import type { AmbientPhase } from "@/systems/ambient/lib/phase";
import { deriveWeatherScene, type WeatherScene } from "@/systems/ambient/lib/scene";
import { startOfLocalDay } from "@/systems/ambient/lib/solar";
import type { WallpaperProfile } from "@/systems/ambient/lib/wallpaper-profile";
import { WALLPAPER_PROFILES } from "@/systems/ambient/lib/wallpaper-profiles";
import {
  BUILT_IN_WALLPAPERS,
  WALLPAPER_LOOK_FAMILY,
  WALLPAPER_OPACITY,
  type Wallpaper,
  type WeatherStyle,
} from "@/systems/ambient/lib/wallpaper";
import { getWeatherConditionLabel, type WeatherCondition } from "@/systems/ambient/lib/weather";
import type { CSSProperties } from "react";

export type SceneTime = "day" | "night" | "sunrise" | "sunset";

export type Scene =
  | { kind: "image"; id: string }
  | { kind: "weather"; condition: WeatherCondition; time: SceneTime };

export const WEATHER_CONDITIONS: WeatherCondition[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "thunder",
];

export const WEATHER_SCENES: Scene[] = [
  ...WEATHER_CONDITIONS.flatMap((condition) => [
    { kind: "weather" as const, condition, time: "day" as const },
    { kind: "weather" as const, condition, time: "night" as const },
  ]),
  { kind: "weather", condition: "clear", time: "sunrise" },
  { kind: "weather", condition: "clear", time: "sunset" },
];

/** What the lab needs to know to derive a weather scene at another time. */
export interface SkyContext {
  style: WeatherStyle;
  lat?: number;
  lon?: number;
  /** Any instant of the day whose sky is shown; the day is taken from local midnight. */
  dayMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
}

export function sceneKey(scene: Scene): string {
  if (scene.kind === "image") return `image:${scene.id}`;
  return `weather:${scene.condition}:${scene.time}`;
}

const TIME_LABEL: Record<Locale, Record<SceneTime, string>> = {
  en: { day: "day", night: "night", sunrise: "sunrise", sunset: "sunset" },
  zh: { day: "白天", night: "夜晚", sunrise: "日出", sunset: "日落" },
};

export function sceneLabel(scene: Scene, locale: Locale = "en"): string {
  if (scene.kind === "image") return BUILT_IN_WALLPAPERS.find((w) => w.id === scene.id)?.name ?? scene.id;
  if (scene.time === "sunrise" || scene.time === "sunset") return TIME_LABEL[locale][scene.time];
  const condition = locale === "zh" ? getWeatherConditionLabel(scene.condition, locale) : scene.condition;
  return `${condition} · ${TIME_LABEL[locale][scene.time]}`;
}

const minutesOf = (ms: number | undefined, fallback: number) => {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return fallback;
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/** Minutes past local midnight a scene time stands for, on the context's day. */
export function sceneMinutes(time: SceneTime, ctx: Pick<SkyContext, "sunriseMs" | "sunsetMs">): number {
  const sr = minutesOf(ctx.sunriseMs, 6 * 60 + 30);
  const ss = minutesOf(ctx.sunsetMs, 18 * 60 + 30);
  switch (time) {
    case "sunrise":
      return sr;
    case "sunset":
      return ss;
    case "day":
      return Math.round((sr + ss) / 2);
    case "night":
      return 60;
  }
}

/** The ambient phase Classic paints at a scene time. */
export function scenePhase(time: SceneTime): AmbientPhase {
  switch (time) {
    case "sunrise":
      return "sunrise";
    case "sunset":
      return "sunset";
    case "day":
      return "afternoon";
    case "night":
      return "night";
  }
}

export function deriveSceneAt(
  scene: Extract<Scene, { kind: "weather" }>,
  theme: Theme,
  ctx: SkyContext,
): WeatherScene {
  const nowMs = startOfLocalDay(ctx.dayMs) + sceneMinutes(scene.time, ctx) * 60_000;
  return deriveWeatherScene({
    nowMs,
    lat: ctx.lat,
    lon: ctx.lon,
    weather: { condition: scene.condition, sunriseMs: ctx.sunriseMs, sunsetMs: ctx.sunsetMs },
    theme,
  });
}

export function sceneProfile(scene: Scene, theme: Theme, ctx: SkyContext): WallpaperProfile | null {
  if (scene.kind === "image") {
    const wp = BUILT_IN_WALLPAPERS.find((w) => w.id === scene.id);
    if (!wp) return null;
    const key = wp[theme].src.replace(/^\/wallpapers\//, "").replace(/\.webp$/, "");
    return WALLPAPER_PROFILES.images[key] ?? null;
  }
  if (ctx.style === "classic") {
    const key =
      scene.time === "sunrise" || scene.time === "sunset"
        ? `${scene.time}/${theme}`
        : `${scene.condition}/${scene.time}/${theme}`;
    return WALLPAPER_PROFILES.weather[key] ?? null;
  }
  return profileFromScene({
    scene: deriveSceneAt(scene, theme, ctx),
    style: ctx.style,
    opacity: WALLPAPER_OPACITY[WALLPAPER_LOOK_FAMILY[ctx.style]][theme],
    theme,
  });
}

function sceneBackground(scene: Scene, theme: Theme, ctx: SkyContext): string {
  if (scene.kind === "image") {
    const wp = BUILT_IN_WALLPAPERS.find((w) => w.id === scene.id) as Wallpaper;
    const asset = wp[theme];
    return `url("${asset.thumb}"), linear-gradient(${asset.base}, ${asset.base})`;
  }
  return getWeatherStyleGradient(ctx.style, deriveSceneAt(scene, theme, ctx), scenePhase(scene.time));
}

export function GalleryTile({
  scene,
  theme,
  vars,
  selected,
  onSelect,
  locale = "en",
  ctx,
}: {
  scene: Scene;
  theme: Theme;
  vars: LegibilityVars;
  selected: boolean;
  onSelect: () => void;
  locale?: Locale;
  ctx: SkyContext;
}) {
  const wash = scene.kind === "weather" ? WALLPAPER_OPACITY[WALLPAPER_LOOK_FAMILY[ctx.style]][theme] : 1;
  const style = {
    ...legibilityCssVars(vars),
    backgroundImage: sceneBackground(scene, theme, ctx),
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "ink-scope group relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-background text-left",
        "ring-1 ring-border/50 transition-shadow hover:ring-border",
        selected && "ring-2 ring-foreground/60",
        vars.flip && "ink-flip",
      )}
    >
      {/* The wash styles paint below full strength over the page, as the
          provider's layer does; the tile composites the same way. */}
      <div aria-hidden className="absolute inset-0" style={{ ...style, opacity: wash }} />
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
        {sceneLabel(scene, locale)}
        {vars.flip && " · flip"}
        {vars.flipMid && !vars.flip && " · flip·mid"}
        {vars.relief > 0 && ` · r${vars.relief.toFixed(1)}`}
        {vars.inkBoost > 0 && ` · +${vars.inkBoost}`}
        {vars.bareBoost > 0 && `+${vars.bareBoost}`}
      </span>
    </button>
  );
}
