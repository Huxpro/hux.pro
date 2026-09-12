"use client";

import { cn } from "@/lib/utils";
import { t, useLocale, useTheme } from "@/services";
import { useWeather } from "@/systems/ambient";
import { ArrowLeft } from "lucide-react";
import {
  getWallpaperPairsBySource,
  resolveWallpaperSrc,
  type WallpaperAppearance,
  type WallpaperPair,
} from "../lib";
import { useWallpaper } from "../provider";

// =============================================================================
// WallpaperPanel — secondary ⌘K window for picking a wallpaper.
//
// Weather and image are the two kinds. Image tiles are light/dark pairs;
// appearance Auto follows the site theme. Responsive 2/3-col grid.
// =============================================================================

function preload(src: string) {
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = src;
}

function AppearanceSwitch({
  value,
  onChange,
}: {
  value: WallpaperAppearance;
  onChange: (value: WallpaperAppearance) => void;
}) {
  const { locale } = useLocale();
  const options: { value: WallpaperAppearance; label: string }[] = [
    { value: "auto", label: t(locale, "wallpaperAuto") },
    { value: "light", label: t(locale, "themeLight") },
    { value: "dark", label: t(locale, "themeDark") },
  ];

  return (
    <div className="flex w-full overflow-hidden rounded-lg border border-border/60 sm:w-auto">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors sm:flex-none",
            value === option.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function WeatherTile({ selected }: { selected: boolean }) {
  const { locale } = useLocale();
  const { gradient, gradientMode, setGradientMode } = useWeather();
  const { selectWeather } = useWallpaper();

  const modes = [
    { value: "full" as const, label: t(locale, "wallpaperGradientFull") },
    { value: "widget" as const, label: t(locale, "wallpaperGradientWidget") },
    { value: "off" as const, label: t(locale, "stateOff") },
  ];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={selectWeather}
        className={cn(
          "group relative w-full overflow-hidden rounded-xl border text-left",
          "aspect-[16/7] sm:aspect-[16/6]",
          "transition-all duration-200",
          selected
            ? "border-foreground/60 ring-2 ring-foreground/40"
            : "border-border/50 hover:border-border"
        )}
        aria-pressed={selected}
      >
        <div
          className="absolute inset-0"
          style={gradient ? { backgroundImage: gradient } : undefined}
        />
        <div className="absolute inset-0 bg-background/20" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <div>
            <div className="text-sm font-medium text-foreground">
              {t(locale, "wallpaperWeather")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t(locale, "wallpaperWeatherHint")}
            </div>
          </div>
        </div>
      </button>

      {selected && (
        <div className="flex flex-wrap gap-1.5">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setGradientMode(mode.value)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider",
                "transition-colors",
                gradientMode === mode.value
                  ? "border-foreground/50 bg-accent text-accent-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={gradientMode === mode.value}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageTile({ pair }: { pair: WallpaperPair }) {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const { kind, imageId, appearance, selectImage } = useWallpaper();
  const selected = kind === "image" && imageId === pair.id;
  const name = locale === "zh" ? pair.nameZh : pair.name;

  const lightThumb = pair.light.thumb;
  const darkThumb = pair.dark.thumb;
  const preview =
    appearance === "auto"
      ? null
      : resolveWallpaperSrc(pair, appearance, theme, { thumb: true });

  return (
    <button
      type="button"
      onClick={() => selectImage(pair.id)}
      onMouseEnter={() => {
        preload(pair.light.src);
        preload(pair.dark.src);
      }}
      className={cn(
        "group flex flex-col gap-1.5 text-left",
        "rounded-xl outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50"
      )}
      aria-pressed={selected}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border",
          "aspect-[4/3] sm:aspect-[5/4]",
          "transition-all duration-200",
          selected
            ? "border-foreground/60 ring-2 ring-foreground/40"
            : "border-border/50 group-hover:border-border"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightThumb}
              alt=""
              className="absolute inset-0 h-full w-1/2 object-cover object-left"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={darkThumb}
              alt=""
              className="absolute inset-y-0 right-0 h-full w-1/2 object-cover object-right"
            />
          </>
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <div className="truncate text-[12px] font-medium text-foreground">
          {name}
        </div>
        <div className="truncate text-[10px] font-mono text-muted-foreground">
          {pair.release}
        </div>
      </div>
    </button>
  );
}

function PairGrid({
  title,
  pairs,
}: {
  title: string;
  pairs: WallpaperPair[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {pairs.map((pair) => (
          <ImageTile key={pair.id} pair={pair} />
        ))}
      </div>
    </div>
  );
}

export function WallpaperPanel({ onBack }: { onBack: () => void }) {
  const { locale } = useLocale();
  const { kind, appearance, setAppearance } = useWallpaper();
  const macos = getWallpaperPairsBySource("macos");
  const ios = getWallpaperPairsBySource("ios");

  return (
    <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            "text-muted-foreground transition-colors",
            "hover:bg-accent/40 hover:text-foreground"
          )}
          aria-label={t(locale, "backToSearch")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <div className="text-sm font-medium text-foreground">
            {t(locale, "wallpaperPickerTitle")}
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {t(locale, "wallpaperPickerHint")}
          </div>
        </div>
        <div className="w-full sm:ml-auto sm:w-auto">
          <AppearanceSwitch value={appearance} onChange={setAppearance} />
        </div>
      </div>

      <div className="max-h-[min(58vh,520px)] space-y-4 overflow-y-auto pr-0.5">
        <WeatherTile selected={kind === "weather"} />
        <PairGrid title={t(locale, "wallpaperMacOS")} pairs={macos} />
        <PairGrid title={t(locale, "wallpaperIOS")} pairs={ios} />
      </div>
    </div>
  );
}
